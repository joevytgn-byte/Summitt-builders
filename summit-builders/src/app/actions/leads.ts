"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { guard, actionError } from "@/lib/guard";
import { canEditLead } from "@/lib/access";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { docNo, nextSeq, SEQ_START } from "@/lib/sequences";
import { createProjectFromDeal } from "@/lib/workflow";
import { dateVal, optional, moneyValue, s } from "@/lib/forms";
import type { ActionResult } from "@/lib/forms";

function refreshLeadViews(id?: string) {
  revalidatePath("/crm/leads");
  revalidatePath("/crm/pipeline");
  revalidatePath("/crm/dashboard");
  revalidatePath("/crm/customers");
  revalidatePath("/crm/reports");
  if (id) revalidatePath(`/crm/leads/${id}`);
}

async function winAutomation(user: { id: string; name: string }, leadId: string) {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { customer: true, service: true },
  });
  if (!lead || lead.status !== "WON") return null;
  const accepted = await db.estimate.findFirst({
    where: { leadId, status: "ACCEPTED" },
    orderBy: { createdAt: "desc" },
  });
  try {
    const result = await createProjectFromDeal({
      customerId: lead.customerId,
      name: lead.title,
      description: lead.description,
      contractValue: accepted?.total ?? lead.estimatedValue,
      serviceId: lead.serviceId,
      projectType: lead.projectType,
      address: lead.customer.serviceAddress,
      estimateId: accepted?.id ?? null,
      actorName: user.name,
    });
    if (result.created) {
      await recordAudit({
        user, action: "CREATE", module: "Projects", recordId: result.project.id,
        recordLabel: `${result.project.projectNo} auto-created from ${lead.leadNo}`,
        newValue: `${result.project.name} · ${result.project.contractValue}`,
      });
    }
    return result.project;
  } catch (e) {
    console.error("Won-deal automation failed", e);
    return null;
  }
}

export async function createLead(formData: FormData): Promise<ActionResult> {
  const g = await guard("leads");
  if (!g.ok) return { ok: false, error: g.error };
  const user = g.user;
  try {
    const customerId = s(formData, "customerId");
    const title = s(formData, "title");
    if (!customerId) return { ok: false, error: "Select a customer for this lead." };
    if (!title) return { ok: false, error: "Give the lead a short title." };
    const assignedToId = user.role === "SALES_REP" ? user.employeeId : optional(formData, "assignedToId");
    const status = s(formData, "status", "NEW") || "NEW";
    const nextFollowUp = dateVal(formData, "nextFollowUp");
    const value = moneyValue(formData, "estimatedValue");

    const lead = await db.$transaction(async (tx) => {
      const leadNo = docNo("LD", await nextSeq(tx, "lead", SEQ_START.lead));
      return tx.lead.create({
        data: {
          leadNo,
          customerId,
          title,
          source: s(formData, "source", "Manual") || "Manual",
          serviceId: optional(formData, "serviceId"),
          projectType: s(formData, "projectType", "Residential") || "Residential",
          estimatedValue: value,
          assignedToId,
          priority: s(formData, "priority", "MEDIUM") || "MEDIUM",
          status,
          description: optional(formData, "description"),
          notes: optional(formData, "notes"),
          nextFollowUp,
          lastContactAt: status !== "NEW" ? new Date() : null,
          createdById: user.id,
        },
        include: { customer: true },
      });
    });

    await db.activity.create({
      data: {
        customerId, leadId: lead.id, type: "LEAD",
        title: `${lead.leadNo} created — ${title}`,
        description: `${lead.source} lead · ${lead.priority.toLowerCase()} priority`,
        actorName: user.name,
      },
    });
    await recordAudit({ user, action: "CREATE", module: "Leads", recordId: lead.id, recordLabel: `${lead.leadNo} ${title}`, newValue: `Status: ${status}` });
    if (assignedToId && assignedToId !== user.employeeId) {
      await notify({
        employeeIds: [assignedToId], type: "LEAD",
        title: `New lead assigned — ${lead.customer.name}`,
        body: `${lead.leadNo} · ${title}`,
        link: `/crm/leads/${lead.id}`,
      });
    }
    refreshLeadViews(lead.id);
    return { ok: true, id: lead.id, message: `${lead.leadNo} created.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateLead(formData: FormData): Promise<ActionResult> {
  const g = await guard("leads");
  if (!g.ok) return { ok: false, error: g.error };
  const user = g.user;
  try {
    const id = s(formData, "id");
    const existing = await db.lead.findUnique({ where: { id }, include: { customer: true } });
    if (!existing) return { ok: false, error: "Lead not found." };
    if (!canEditLead(user, existing)) return { ok: false, error: "You can only edit leads assigned to you." };

    const status = s(formData, "status", existing.status) || existing.status;
    const statusChanged = status !== existing.status;
    const winning = status === "WON" && existing.status !== "WON";
    const losing = status === "LOST" && existing.status !== "LOST";
    const nextFollowUp = dateVal(formData, "nextFollowUp");
    const now = new Date();

    const data: Record<string, unknown> = {
      title: s(formData, "title", existing.title) || existing.title,
      source: s(formData, "source", existing.source) || existing.source,
      serviceId: optional(formData, "serviceId"),
      projectType: s(formData, "projectType", existing.projectType) || existing.projectType,
      estimatedValue: moneyValue(formData, "estimatedValue"),
      assignedToId: user.role === "SALES_REP" ? existing.assignedToId : optional(formData, "assignedToId"),
      priority: s(formData, "priority", existing.priority) || existing.priority,
      status,
      description: optional(formData, "description"),
      notes: optional(formData, "notes"),
      nextFollowUp,
      lastContactAt: existing.lastContactAt ?? (status !== "NEW" ? now : null),
      responseMins: existing.responseMins ?? (existing.status === "NEW" && status !== "NEW" ? Math.max(1, Math.round((now.getTime() - existing.createdAt.getTime()) / 60_000)) : null),
      wonAt: winning ? now : existing.wonAt,
      lostAt: losing ? now : existing.lostAt,
      lostReason: status === "LOST" ? optional(formData, "lostReason") ?? existing.lostReason : null,
    };

    await db.lead.update({ where: { id }, data });
    await recordAudit({
      user, action: statusChanged ? "STATUS" : "UPDATE", module: "Leads", recordId: id,
      recordLabel: `${existing.leadNo} ${existing.title}`,
      previousValue: statusChanged ? existing.status : `Value: ${existing.estimatedValue}`,
      newValue: statusChanged ? status : `Value: ${data.estimatedValue}`,
    });
    if (statusChanged) {
      await db.activity.create({
        data: {
          customerId: existing.customerId, leadId: id, type: "STATUS",
          title: `Lead status changed to ${status.replace(/_/g, " ").toLowerCase()}`,
          actorName: user.name,
        },
      });
    }

    let message = `${existing.leadNo} updated.`;
    if (winning) {
      const project = await winAutomation(user, id);
      if (project) message = `Deal won. Project ${project.projectNo} and a kickoff job were created.`;
      await notify({
        roles: ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER"], type: "SALES",
        title: `Deal won — ${existing.customer.name}`,
        body: `${existing.leadNo} · ${existing.title} · ${existing.estimatedValue.toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
        link: `/crm/leads/${id}`,
      });
    }
    if (losing) {
      await notify({
        roles: ["SALES_MANAGER"], type: "SALES",
        title: `Deal lost — ${existing.customer.name}`,
        body: `${existing.leadNo} · ${optional(formData, "lostReason") ?? "No reason recorded"}`,
        link: `/crm/leads/${id}`,
      });
    }
    refreshLeadViews(id);
    return { ok: true, id, message };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateLeadStatus(leadId: string, status: string, lostReason?: string): Promise<ActionResult> {
  const g = await guard("leads");
  if (!g.ok) return { ok: false, error: g.error };
  const user = g.user;
  try {
    const existing = await db.lead.findUnique({ where: { id: leadId }, include: { customer: true } });
    if (!existing) return { ok: false, error: "Lead not found." };
    if (!canEditLead(user, existing)) return { ok: false, error: "You can only update leads assigned to you." };
    if (existing.status === status) return { ok: true, message: "No change." };

    const now = new Date();
    await db.lead.update({
      where: { id: leadId },
      data: {
        status,
        wonAt: status === "WON" ? now : existing.wonAt,
        lostAt: status === "LOST" ? now : existing.lostAt,
        lostReason: status === "LOST" ? lostReason ?? null : null,
        lastContactAt: existing.lastContactAt ?? (status !== "NEW" ? now : null),
        responseMins: existing.responseMins ?? (existing.status === "NEW" && status !== "NEW" ? Math.max(1, Math.round((now.getTime() - existing.createdAt.getTime()) / 60_000)) : null),
      },
    });
    await db.activity.create({
      data: {
        customerId: existing.customerId, leadId, type: "STATUS",
        title: `Lead moved from ${existing.status.replace(/_/g, " ").toLowerCase()} to ${status.replace(/_/g, " ").toLowerCase()}`,
        actorName: user.name,
      },
    });
    await recordAudit({ user, action: "STATUS", module: "Leads", recordId: leadId, recordLabel: `${existing.leadNo} ${existing.title}`, previousValue: existing.status, newValue: status });

    let message = `Lead moved to ${status.replace(/_/g, " ").toLowerCase()}.`;
    if (status === "WON") {
      const project = await winAutomation(user, leadId);
      if (project) message = `Deal won. Project ${project.projectNo} is ready for scheduling.`;
      await notify({
        roles: ["ADMIN", "SALES_MANAGER"], type: "SALES",
        title: `Deal won — ${existing.customer.name}`,
        body: `${existing.leadNo} · ${existing.title}`,
        link: `/crm/leads/${leadId}`,
      });
    }
    if (status === "LOST") {
      await notify({
        roles: ["SALES_MANAGER"], type: "SALES",
        title: `Deal lost — ${existing.customer.name}`,
        body: `${existing.leadNo} · ${lostReason || "No reason recorded"}`,
        link: `/crm/leads/${leadId}`,
      });
    }
    refreshLeadViews(leadId);
    return { ok: true, id: leadId, message };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function assignLead(leadId: string, employeeId: string): Promise<ActionResult> {
  const g = await guard("leads");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const lead = await db.lead.findUnique({ where: { id: leadId }, include: { customer: true } });
    if (!lead) return { ok: false, error: "Lead not found." };
    const emp = employeeId ? await db.employee.findUnique({ where: { id: employeeId } }) : null;
    await db.lead.update({ where: { id: leadId }, data: { assignedToId: employeeId || null } });
    await db.activity.create({
      data: {
        customerId: lead.customerId, leadId, type: "ASSIGN",
        title: emp ? `Lead assigned to ${emp.firstName} ${emp.lastName}` : "Lead unassigned",
        actorName: g.user.name,
      },
    });
    await recordAudit({ user: g.user, action: "ASSIGN", module: "Leads", recordId: leadId, recordLabel: `${lead.leadNo} ${lead.title}`, newValue: emp ? `${emp.firstName} ${emp.lastName}` : "Unassigned" });
    if (emp?.id) {
      await notify({ employeeIds: [emp.id], type: "LEAD", title: `Lead assigned — ${lead.customer.name}`, body: `${lead.leadNo} · ${lead.title}`, link: `/crm/leads/${leadId}` });
    }
    refreshLeadViews(leadId);
    return { ok: true, message: "Assignment updated." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function addLeadNote(formData: FormData): Promise<ActionResult> {
  const g = await guard("leads");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const leadId = s(formData, "leadId");
    const note = s(formData, "note");
    if (!note) return { ok: false, error: "Write a note first." };
    const lead = await db.lead.findUnique({ where: { id: leadId }, include: { customer: true } });
    if (!lead) return { ok: false, error: "Lead not found." };
    const stamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    await db.lead.update({ where: { id: leadId }, data: { notes: `${lead.notes ? `${lead.notes}\n\n` : ""}[${stamp}] ${note}` } });
    await db.activity.create({ data: { customerId: lead.customerId, leadId, type: "NOTE", title: note, actorName: g.user.name } });
    await recordAudit({ user: g.user, action: "UPDATE", module: "Leads", recordId: leadId, recordLabel: `${lead.leadNo} note added`, newValue: note.slice(0, 180) });
    refreshLeadViews(leadId);
    return { ok: true, message: "Note added." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function createFollowUp(formData: FormData): Promise<ActionResult> {
  const g = await guard("leads");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const leadId = optional(formData, "leadId");
    const customerId = optional(formData, "customerId");
    const dueAt = dateVal(formData, "dueAt");
    const subject = s(formData, "subject");
    if (!dueAt) return { ok: false, error: "Choose a follow-up date." };
    if (!subject) return { ok: false, error: "Add a subject." };
    const assignedToId = g.user.role === "SALES_REP" ? g.user.employeeId : optional(formData, "assignedToId") ?? g.user.employeeId;
    const followUp = await db.followUp.create({
      data: { leadId, customerId, dueAt, subject, notes: optional(formData, "notes"), assignedToId, status: "PENDING" },
    });
    if (leadId) await db.lead.update({ where: { id: leadId }, data: { nextFollowUp: dueAt } });
    await db.activity.create({
      data: { leadId, customerId, type: "FOLLOW_UP", title: `Follow-up scheduled: ${subject}`, description: `Due ${dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, actorName: g.user.name },
    });
    await recordAudit({ user: g.user, action: "CREATE", module: "Follow-ups", recordId: followUp.id, recordLabel: subject, newValue: dueAt.toISOString().slice(0, 10) });
    if (assignedToId && assignedToId !== g.user.employeeId) {
      await notify({ employeeIds: [assignedToId], type: "FOLLOW_UP", title: `Follow-up assigned: ${subject}`, body: `Due ${dueAt.toLocaleDateString("en-US")}`, link: leadId ? `/crm/leads/${leadId}` : "/crm/leads" });
    }
    refreshLeadViews(leadId ?? undefined);
    return { ok: true, id: followUp.id, message: "Follow-up scheduled." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function completeFollowUp(followUpId: string): Promise<ActionResult> {
  const g = await guard("leads");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const followUp = await db.followUp.findUnique({ where: { id: followUpId } });
    if (!followUp) return { ok: false, error: "Follow-up not found." };
    await db.followUp.update({ where: { id: followUpId }, data: { status: "DONE", completedAt: new Date() } });
    if (followUp.leadId) {
      const next = await db.followUp.findFirst({ where: { leadId: followUp.leadId, status: "PENDING" }, orderBy: { dueAt: "asc" } });
      await db.lead.update({ where: { id: followUp.leadId }, data: { nextFollowUp: next?.dueAt ?? null, lastContactAt: new Date() } });
    }
    await recordAudit({ user: g.user, action: "UPDATE", module: "Follow-ups", recordId: followUpId, recordLabel: followUp.subject, previousValue: "PENDING", newValue: "DONE" });
    refreshLeadViews(followUp.leadId ?? undefined);
    return { ok: true, message: "Follow-up marked complete." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function convertLeadToProject(formData: FormData): Promise<ActionResult> {
  const g = await guard("leads");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const leadId = s(formData, "leadId");
    const lead = await db.lead.findUnique({ where: { id: leadId }, include: { customer: true } });
    if (!lead) return { ok: false, error: "Lead not found." };
    const managerId = optional(formData, "managerId");
    const value = moneyValue(formData, "contractValue") || lead.estimatedValue;
    const startDate = dateVal(formData, "startDate");
    const expectedEnd = dateVal(formData, "expectedEnd");

    await db.lead.update({
      where: { id: leadId },
      data: { status: "WON", wonAt: lead.wonAt ?? new Date(), lostAt: null, lostReason: null },
    });
    const result = await createProjectFromDeal({
      customerId: lead.customerId,
      name: s(formData, "name") || lead.title,
      description: lead.description,
      contractValue: value,
      serviceId: lead.serviceId,
      projectType: lead.projectType,
      address: lead.customer.serviceAddress,
      managerId,
      actorName: g.user.name,
    });
    if (startDate || expectedEnd) {
      await db.project.update({ where: { id: result.project.id }, data: { startDate, expectedEnd } });
    }
    await recordAudit({ user: g.user, action: "CREATE", module: "Projects", recordId: result.project.id, recordLabel: `${result.project.projectNo} from ${lead.leadNo}`, newValue: `Contract: ${value}` });
    refreshLeadViews(leadId);
    revalidatePath("/crm/projects");
    return { ok: true, id: result.project.id, message: `Project ${result.project.projectNo} created.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function deleteLead(leadId: string): Promise<ActionResult> {
  const g = await guard("leads");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN", "SALES_MANAGER"].includes(g.user.role)) return { ok: false, error: "Only management can archive leads." };
  try {
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { ok: false, error: "Lead not found." };
    await db.lead.update({ where: { id: leadId }, data: { status: "LOST", lostAt: new Date(), lostReason: lead.lostReason ?? "Archived by management" } });
    await recordAudit({ user: g.user, action: "ARCHIVE", module: "Leads", recordId: leadId, recordLabel: `${lead.leadNo} archived` });
    refreshLeadViews(leadId);
    return { ok: true, message: "Lead archived as lost." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}
