"use server";

import { revalidatePath } from "next/cache";
import { startOfDay, endOfDay } from "date-fns";
import { db } from "@/lib/db";
import { guard, actionError } from "@/lib/guard";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { docNo, nextSeq, SEQ_START } from "@/lib/sequences";
import { dateVal, int, optional, s } from "@/lib/forms";
import type { ActionResult } from "@/lib/forms";

function refresh(id?: string) {
  revalidatePath("/crm/jobs");
  revalidatePath("/crm/calendar");
  revalidatePath("/crm/dashboard");
  revalidatePath("/crm/projects");
  revalidatePath("/crm/reports");
  if (id) revalidatePath(`/crm/jobs/${id}`);
}

function toMinutes(value: string | null) {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

function fmtMins(mins: number) {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

async function conflictFor(employeeIds: string[], date: Date, startTime: string, durationMins: number, excludeJobId?: string) {
  if (!employeeIds.length || !startTime) return null;
  const start = toMinutes(startTime);
  if (start === null) return null;
  const end = start + Math.max(15, durationMins || 240);
  const sameDay = await db.job.findMany({
    where: {
      scheduledDate: { gte: startOfDay(date), lte: endOfDay(date) },
      status: { not: "CANCELLED" },
      ...(excludeJobId ? { id: { not: excludeJobId } } : {}),
      assignments: { some: { employeeId: { in: employeeIds } } },
    },
    include: { assignments: { include: { employee: { select: { id: true, firstName: true, lastName: true } } } } },
  });
  for (const job of sameDay) {
    const otherStart = toMinutes(job.startTime);
    if (otherStart === null) continue;
    const otherEnd = otherStart + (job.durationMins || 240);
    if (start < otherEnd && otherStart < end) {
      const conflictEmp = job.assignments.find((a) => employeeIds.includes(a.employeeId))?.employee;
      return `${conflictEmp?.firstName ?? "A crew member"} ${conflictEmp?.lastName ?? ""} is already booked on ${job.jobNo} (${job.startTime}–${fmtMins(otherEnd)}). Choose another time or crew.`.replace("  ", " ");
    }
  }
  return null;
}

async function updateProjectProgressFromJobs(projectId: string | null) {
  if (!projectId) return;
  const [project, jobs] = await Promise.all([
    db.project.findUnique({ where: { id: projectId } }),
    db.job.findMany({ where: { projectId, status: { not: "CANCELLED" } }, select: { status: true } }),
  ]);
  if (!project || !jobs.length) return;
  const completed = jobs.filter((j) => j.status === "COMPLETED").length;
  const progress = Math.round((completed / jobs.length) * 100);
  if (progress > project.progress) {
    await db.project.update({ where: { id: projectId }, data: { progress } });
  }
}

function crewFromForm(formData: FormData) {
  return [...new Set(formData.getAll("crewIds").map(String).filter(Boolean))];
}

export async function createJob(formData: FormData): Promise<ActionResult> {
  const g = await guard("jobs");
  if (!g.ok) return { ok: false, error: g.error };
  if (g.user.role === "FIELD") return { ok: false, error: "Field crew cannot create jobs." };
  try {
    const customerId = s(formData, "customerId");
    const jobType = s(formData, "jobType");
    if (!customerId) return { ok: false, error: "Select a customer." };
    if (!jobType) return { ok: false, error: "Enter a job type." };
    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { ok: false, error: "Customer not found." };
    const projectId = optional(formData, "projectId");
    const project = projectId ? await db.project.findUnique({ where: { id: projectId } }) : null;
    const scheduledDate = dateVal(formData, "scheduledDate");
    const startTime = s(formData, "startTime");
    const durationMins = Math.max(15, int(formData, "durationMins", 240));
    const crew = crewFromForm(formData);
    const status = scheduledDate ? s(formData, "status", "SCHEDULED") || "SCHEDULED" : "UNSCHEDULED";

    if (scheduledDate && startTime) {
      const conflict = await conflictFor(crew, scheduledDate, startTime, durationMins);
      if (conflict) return { ok: false, error: conflict };
    }

    const job = await db.$transaction(async (tx) => {
      const jobNo = docNo("JOB", await nextSeq(tx, "job", SEQ_START.job));
      return tx.job.create({
        data: {
          jobNo, projectId, customerId,
          address: s(formData, "address") || project?.serviceAddress || customer.serviceAddress,
          jobType,
          description: optional(formData, "description"),
          scheduledDate, startTime: startTime || null, durationMins,
          managerId: optional(formData, "managerId") ?? project?.managerId ?? null,
          dispatcherId: optional(formData, "dispatcherId"),
          priority: s(formData, "priority", "MEDIUM") || "MEDIUM",
          status, notes: optional(formData, "notes"),
          assignments: crew.length ? { create: crew.map((employeeId) => ({ employeeId })) } : undefined,
        },
      });
    });

    await db.activity.create({ data: { customerId, type: "JOB", title: `${job.jobNo} scheduled — ${jobType}`, description: scheduledDate ? `${scheduledDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${startTime}` : "Unscheduled", actorName: g.user.name } });
    await recordAudit({ user: g.user, action: "CREATE", module: "Jobs", recordId: job.id, recordLabel: `${job.jobNo} ${jobType}`, newValue: `${status}${scheduledDate ? ` · ${scheduledDate.toISOString().slice(0, 10)}` : ""}` });
    await notify({
      employeeIds: [...crew, ...(job.managerId ? [job.managerId] : []), ...(job.dispatcherId ? [job.dispatcherId] : [])],
      type: "JOB",
      title: `Job scheduled — ${job.jobNo}`,
      body: `${jobType} · ${customer.company ?? customer.name}${scheduledDate ? ` · ${scheduledDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${startTime}` : ""}`,
      link: `/crm/jobs/${job.id}`,
    });
    refresh(job.id);
    return { ok: true, id: job.id, message: `${job.jobNo} created.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateJob(formData: FormData): Promise<ActionResult> {
  const g = await guard("jobs");
  if (!g.ok) return { ok: false, error: g.error };
  if (g.user.role === "FIELD") return { ok: false, error: "Field crew can update status but not job details." };
  try {
    const id = s(formData, "id");
    const existing = await db.job.findUnique({ where: { id }, include: { assignments: true, customer: true } });
    if (!existing) return { ok: false, error: "Job not found." };
    const customerId = s(formData, "customerId", existing.customerId) || existing.customerId;
    const scheduledDate = dateVal(formData, "scheduledDate");
    const startTime = s(formData, "startTime");
    const durationMins = Math.max(15, int(formData, "durationMins", existing.durationMins));
    const crew = crewFromForm(formData);
    const status = s(formData, "status", existing.status) || existing.status;
    if (scheduledDate && startTime) {
      const conflict = await conflictFor(crew, scheduledDate, startTime, durationMins, id);
      if (conflict) return { ok: false, error: conflict };
    }
    const rescheduled = existing.scheduledDate?.toISOString().slice(0, 10) !== scheduledDate?.toISOString().slice(0, 10) || existing.startTime !== (startTime || null);

    await db.$transaction(async (tx) => {
      await tx.jobAssignment.deleteMany({ where: { jobId: id } });
      await tx.job.update({
        where: { id },
        data: {
          customerId, projectId: optional(formData, "projectId"),
          address: s(formData, "address", existing.address) || existing.address,
          jobType: s(formData, "jobType", existing.jobType) || existing.jobType,
          description: optional(formData, "description"),
          scheduledDate, startTime: startTime || null, durationMins,
          managerId: optional(formData, "managerId"), dispatcherId: optional(formData, "dispatcherId"),
          priority: s(formData, "priority", existing.priority) || existing.priority,
          status: scheduledDate ? status : status === "SCHEDULED" ? "UNSCHEDULED" : status,
          notes: optional(formData, "notes"),
          completionNotes: optional(formData, "completionNotes"),
          completedAt: status === "COMPLETED" ? existing.completedAt ?? new Date() : existing.completedAt,
          assignments: crew.length ? { create: crew.map((employeeId) => ({ employeeId })) } : undefined,
        },
      });
    });

    await recordAudit({ user: g.user, action: "UPDATE", module: "Jobs", recordId: id, recordLabel: `${existing.jobNo} ${existing.jobType}`, previousValue: `${existing.status} · ${existing.startTime ?? "TBD"}`, newValue: `${status} · ${startTime || "TBD"}` });
    if (status === "COMPLETED") await updateProjectProgressFromJobs(existing.projectId);
    if (rescheduled) {
      await db.activity.create({ data: { customerId, type: "JOB", title: `${existing.jobNo} rescheduled`, description: scheduledDate ? `${scheduledDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${startTime}` : "Back to unscheduled", actorName: g.user.name } });
      await notify({ employeeIds: crew, type: "JOB", title: `Schedule change — ${existing.jobNo}`, body: `${existing.jobType}${scheduledDate ? ` · ${scheduledDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${startTime}` : ""}`, link: `/crm/jobs/${id}` });
    }
    refresh(id);
    return { ok: true, id, message: `${existing.jobNo} updated.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateJobStatus(jobId: string, status: string): Promise<ActionResult> {
  const g = await guard("jobs");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const job = await db.job.findUnique({ where: { id: jobId }, include: { customer: true, assignments: true } });
    if (!job) return { ok: false, error: "Job not found." };
    if (g.user.role === "FIELD" && !job.assignments.some((a) => a.employeeId === g.user.employeeId)) {
      return { ok: false, error: "You can only update jobs assigned to you." };
    }
    await db.job.update({
      where: { id: jobId },
      data: {
        status,
        completedAt: status === "COMPLETED" ? job.completedAt ?? new Date() : job.completedAt,
        scheduledDate: status === "UNSCHEDULED" ? null : job.scheduledDate,
        startTime: status === "UNSCHEDULED" ? null : job.startTime,
      },
    });
    await db.activity.create({ data: { customerId: job.customerId, type: "JOB", title: `${job.jobNo} moved to ${status.replace(/_/g, " ").toLowerCase()}`, actorName: g.user.name } });
    await recordAudit({ user: g.user, action: "STATUS", module: "Jobs", recordId: jobId, recordLabel: `${job.jobNo} ${job.jobType}`, previousValue: job.status, newValue: status });
    if (status === "COMPLETED") {
      await updateProjectProgressFromJobs(job.projectId);
      await notify({ employeeIds: [job.managerId, job.dispatcherId].filter(Boolean) as string[], type: "JOB", title: `Job completed — ${job.jobNo}`, body: `${job.jobType} · ${job.customer.company ?? job.customer.name}`, link: `/crm/jobs/${jobId}` });
    }
    refresh(jobId);
    return { ok: true, message: `${job.jobNo} marked ${status.replace(/_/g, " ").toLowerCase()}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function scheduleJob(jobId: string, dateStr: string, startTime: string, durationMins?: number): Promise<ActionResult> {
  const g = await guard("jobs");
  if (!g.ok) return { ok: false, error: g.error };
  if (g.user.role === "FIELD") return { ok: false, error: "Field crew cannot schedule jobs." };
  try {
    const job = await db.job.findUnique({ where: { id: jobId }, include: { assignments: true, customer: true } });
    if (!job) return { ok: false, error: "Job not found." };
    const parsed = new Date(`${dateStr}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: "Invalid date." };
    const duration = durationMins || job.durationMins;
    const crew = job.assignments.map((a) => a.employeeId);
    const conflict = await conflictFor(crew, parsed, startTime, duration, jobId);
    if (conflict) return { ok: false, error: conflict };
    const status = ["UNSCHEDULED", "RESCHEDULED", "CANCELLED"].includes(job.status) ? "SCHEDULED" : job.status;

    await db.job.update({
      where: { id: jobId },
      data: { scheduledDate: startOfDay(parsed), startTime, durationMins: duration, status },
    });
    await db.activity.create({ data: { customerId: job.customerId, type: "JOB", title: `${job.jobNo} scheduled for ${parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, description: `Start ${startTime}`, actorName: g.user.name } });
    await recordAudit({ user: g.user, action: "UPDATE", module: "Jobs", recordId: jobId, recordLabel: `${job.jobNo} scheduled`, previousValue: job.scheduledDate?.toISOString().slice(0, 10) ?? "Unscheduled", newValue: `${dateStr} ${startTime}` });
    await notify({ employeeIds: crew, type: "JOB", title: `Job scheduled — ${job.jobNo}`, body: `${job.jobType} · ${parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${startTime}`, link: `/crm/jobs/${jobId}` });
    refresh(jobId);
    return { ok: true, message: `${job.jobNo} scheduled.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function assignCrew(jobId: string, employeeIds: string[]): Promise<ActionResult> {
  const g = await guard("jobs");
  if (!g.ok) return { ok: false, error: g.error };
  if (g.user.role === "FIELD") return { ok: false, error: "Field crew cannot reassign jobs." };
  try {
    const job = await db.job.findUnique({ where: { id: jobId }, include: { customer: true } });
    if (!job) return { ok: false, error: "Job not found." };
    if (job.scheduledDate && job.startTime) {
      const conflict = await conflictFor(employeeIds, job.scheduledDate, job.startTime, job.durationMins, jobId);
      if (conflict) return { ok: false, error: conflict };
    }
    await db.$transaction(async (tx) => {
      await tx.jobAssignment.deleteMany({ where: { jobId } });
      if (employeeIds.length) {
        await tx.jobAssignment.createMany({ data: employeeIds.map((employeeId) => ({ jobId, employeeId })) });
      }
    });
    await recordAudit({ user: g.user, action: "ASSIGN", module: "Jobs", recordId: jobId, recordLabel: `${job.jobNo} crew updated`, newValue: `${employeeIds.length} crew members` });
    await notify({ employeeIds, type: "JOB", title: `Assigned to job ${job.jobNo}`, body: `${job.jobType} · ${job.customer.company ?? job.customer.name}`, link: `/crm/jobs/${jobId}` });
    refresh(jobId);
    return { ok: true, message: "Crew updated." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function completeJob(formData: FormData): Promise<ActionResult> {
  const g = await guard("jobs");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const jobId = s(formData, "jobId");
    const job = await db.job.findUnique({ where: { id: jobId }, include: { assignments: true, customer: true } });
    if (!job) return { ok: false, error: "Job not found." };
    if (g.user.role === "FIELD" && !job.assignments.some((a) => a.employeeId === g.user.employeeId)) {
      return { ok: false, error: "You can only complete jobs assigned to you." };
    }
    await db.job.update({ where: { id: jobId }, data: { status: "COMPLETED", completedAt: new Date(), completionNotes: optional(formData, "completionNotes") } });
    await updateProjectProgressFromJobs(job.projectId);
    await db.activity.create({ data: { customerId: job.customerId, type: "JOB", title: `${job.jobNo} completed`, description: optional(formData, "completionNotes") ?? undefined, actorName: g.user.name } });
    await recordAudit({ user: g.user, action: "STATUS", module: "Jobs", recordId: jobId, recordLabel: `${job.jobNo} completed`, previousValue: job.status, newValue: "COMPLETED" });
    await notify({ employeeIds: [job.managerId, job.dispatcherId].filter(Boolean) as string[], type: "JOB", title: `Job completed — ${job.jobNo}`, body: `${job.jobType} · ${job.customer.company ?? job.customer.name}`, link: `/crm/jobs/${jobId}` });
    refresh(jobId);
    return { ok: true, message: "Job marked complete." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function scheduleJobFromForm(formData: FormData): Promise<ActionResult> {
  const jobId = s(formData, "jobId");
  const dateStr = s(formData, "scheduledDate");
  const startTime = s(formData, "startTime", "08:00") || "08:00";
  const durationMins = Math.max(15, int(formData, "durationMins", 240));
  if (!dateStr) return { ok: false, error: "Choose a scheduled date." };
  return scheduleJob(jobId, dateStr, startTime, durationMins);
}

export async function assignCrewFromForm(formData: FormData): Promise<ActionResult> {
  const jobId = s(formData, "jobId");
  const employeeIds = [...new Set(formData.getAll("crewIds").map(String).filter(Boolean))];
  return assignCrew(jobId, employeeIds);
}
