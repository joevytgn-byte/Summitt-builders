"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { guard, actionError } from "@/lib/guard";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { docNo, nextSeq, SEQ_START } from "@/lib/sequences";
import { dateVal, int, moneyValue, optional, s } from "@/lib/forms";
import type { ActionResult } from "@/lib/forms";

function refresh(id?: string) {
  revalidatePath("/crm/projects");
  revalidatePath("/crm/dashboard");
  revalidatePath("/crm/jobs");
  revalidatePath("/crm/calendar");
  revalidatePath("/crm/reports");
  if (id) revalidatePath(`/crm/projects/${id}`);
}

export async function createProject(formData: FormData): Promise<ActionResult> {
  const g = await guard("projects");
  if (!g.ok) return { ok: false, error: g.error };
  if (g.user.role === "FIELD") return { ok: false, error: "Field crew cannot create projects." };
  try {
    const name = s(formData, "name");
    const customerId = s(formData, "customerId");
    if (!name) return { ok: false, error: "Project name is required." };
    if (!customerId) return { ok: false, error: "Select a customer." };
    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { ok: false, error: "Customer not found." };

    const project = await db.$transaction(async (tx) => {
      const projectNo = docNo("PRJ", await nextSeq(tx, "project", SEQ_START.project));
      return tx.project.create({
        data: {
          projectNo, name, customerId,
          projectType: s(formData, "projectType", "Residential") || "Residential",
          serviceId: optional(formData, "serviceId"),
          serviceAddress: s(formData, "serviceAddress") || customer.serviceAddress,
          description: optional(formData, "description"),
          contractValue: moneyValue(formData, "contractValue"),
          startDate: dateVal(formData, "startDate"),
          expectedEnd: dateVal(formData, "expectedEnd"),
          managerId: optional(formData, "managerId"),
          status: s(formData, "status", "PENDING") || "PENDING",
          priority: s(formData, "priority", "MEDIUM") || "MEDIUM",
          progress: Math.max(0, Math.min(100, int(formData, "progress", 0))),
          notes: optional(formData, "notes"),
        },
      });
    });

    if (project.managerId) {
      await notify({
        employeeIds: [project.managerId], type: "PROJECT",
        title: `Project assigned — ${project.name}`,
        body: `${project.projectNo} · ${project.contractValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
        link: `/crm/projects/${project.id}`,
      });
    }
    await db.activity.create({ data: { customerId, type: "PROJECT", title: `${project.projectNo} created — ${name}`, actorName: g.user.name } });
    await recordAudit({ user: g.user, action: "CREATE", module: "Projects", recordId: project.id, recordLabel: `${project.projectNo} ${name}`, newValue: `${project.status} · ${project.contractValue}` });
    refresh(project.id);
    return { ok: true, id: project.id, message: `${project.projectNo} created.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateProject(formData: FormData): Promise<ActionResult> {
  const g = await guard("projects");
  if (!g.ok) return { ok: false, error: g.error };
  if (g.user.role === "FIELD") return { ok: false, error: "Field crew cannot edit projects." };
  try {
    const id = s(formData, "id");
    const existing = await db.project.findUnique({ where: { id }, include: { customer: true } });
    if (!existing) return { ok: false, error: "Project not found." };
    const status = s(formData, "status", existing.status) || existing.status;
    const progress = Math.max(0, Math.min(100, int(formData, "progress", existing.progress)));
    const now = new Date();

    const updated = await db.project.update({
      where: { id },
      data: {
        name: s(formData, "name", existing.name) || existing.name,
        projectType: s(formData, "projectType", existing.projectType) || existing.projectType,
        serviceId: optional(formData, "serviceId"),
        serviceAddress: s(formData, "serviceAddress", existing.serviceAddress) || existing.serviceAddress,
        description: optional(formData, "description"),
        contractValue: moneyValue(formData, "contractValue"),
        startDate: dateVal(formData, "startDate"),
        expectedEnd: dateVal(formData, "expectedEnd"),
        actualEnd: status === "COMPLETED" ? existing.actualEnd ?? now : existing.actualEnd,
        managerId: optional(formData, "managerId"),
        status,
        priority: s(formData, "priority", existing.priority) || existing.priority,
        progress: status === "COMPLETED" ? 100 : progress,
        notes: optional(formData, "notes"),
      },
    });

    await recordAudit({ user: g.user, action: existing.status !== status ? "STATUS" : "UPDATE", module: "Projects", recordId: id, recordLabel: `${existing.projectNo} ${existing.name}`, previousValue: `${existing.status} · ${existing.progress}%`, newValue: `${status} · ${updated.progress}%` });
    if (existing.status !== status) {
      await db.activity.create({ data: { customerId: existing.customerId, type: "PROJECT", title: `${existing.projectNo} moved to ${status.replace(/_/g, " ").toLowerCase()}`, actorName: g.user.name } });
      if (status === "DELAYED" || status === "ON_HOLD") {
        await notify({ roles: ["ADMIN", "SALES_MANAGER"], type: "PROJECT", title: `Project ${status.toLowerCase()} — ${existing.name}`, body: `${existing.projectNo} · ${existing.customer.name}`, link: `/crm/projects/${id}` });
      }
    }
    refresh(id);
    return { ok: true, id, message: `${existing.projectNo} updated.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateProjectStatus(projectId: string, status: string): Promise<ActionResult> {
  const g = await guard("projects");
  if (!g.ok) return { ok: false, error: g.error };
  if (g.user.role === "FIELD") return { ok: false, error: "Field crew cannot change project status." };
  try {
    const project = await db.project.findUnique({ where: { id: projectId }, include: { customer: true } });
    if (!project) return { ok: false, error: "Project not found." };
    await db.project.update({
      where: { id: projectId },
      data: {
        status,
        progress: status === "COMPLETED" ? 100 : project.progress,
        actualEnd: status === "COMPLETED" ? project.actualEnd ?? new Date() : project.actualEnd,
      },
    });
    await db.activity.create({ data: { customerId: project.customerId, type: "PROJECT", title: `${project.projectNo} moved to ${status.replace(/_/g, " ").toLowerCase()}`, actorName: g.user.name } });
    await recordAudit({ user: g.user, action: "STATUS", module: "Projects", recordId: projectId, recordLabel: `${project.projectNo} ${project.name}`, previousValue: project.status, newValue: status });
    if (status === "DELAYED") {
      await notify({ roles: ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER"], type: "PROJECT", title: `Project delayed — ${project.name}`, body: `${project.projectNo} · ${project.customer.name}`, link: `/crm/projects/${projectId}` });
    }
    refresh(projectId);
    return { ok: true, message: `Project marked ${status.replace(/_/g, " ").toLowerCase()}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateProjectProgress(projectId: string, progress: number): Promise<ActionResult> {
  const g = await guard("projects");
  if (!g.ok) return { ok: false, error: g.error };
  if (g.user.role === "FIELD") return { ok: false, error: "Field crew cannot update project progress." };
  try {
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) return { ok: false, error: "Project not found." };
    const value = Math.max(0, Math.min(100, Math.round(progress)));
    await db.project.update({ where: { id: projectId }, data: { progress: value, status: value === 100 ? "COMPLETED" : project.status, actualEnd: value === 100 ? project.actualEnd ?? new Date() : project.actualEnd } });
    await recordAudit({ user: g.user, action: "UPDATE", module: "Projects", recordId: projectId, recordLabel: `${project.projectNo} progress updated`, previousValue: `${project.progress}%`, newValue: `${value}%` });
    refresh(projectId);
    return { ok: true, message: `Progress updated to ${value}%.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function addProjectNote(formData: FormData): Promise<ActionResult> {
  const g = await guard("projects");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const projectId = s(formData, "projectId");
    const note = s(formData, "note");
    if (!note) return { ok: false, error: "Write a note first." };
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) return { ok: false, error: "Project not found." };
    const stamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    await db.project.update({ where: { id: projectId }, data: { notes: `${project.notes ? `${project.notes}\n\n` : ""}[${stamp}] ${note}` } });
    await db.activity.create({ data: { customerId: project.customerId, type: "NOTE", title: `Project note — ${project.projectNo}: ${note}`, actorName: g.user.name } });
    await recordAudit({ user: g.user, action: "UPDATE", module: "Projects", recordId: projectId, recordLabel: `${project.projectNo} note added`, newValue: note.slice(0, 160) });
    refresh(projectId);
    return { ok: true, message: "Project note added." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function setProjectProgress(formData: FormData): Promise<ActionResult> {
  const projectId = s(formData, "projectId");
  const progress = int(formData, "progress", 0);
  return updateProjectProgress(projectId, progress);
}
