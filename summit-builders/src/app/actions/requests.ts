"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { guard, actionError } from "@/lib/guard";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { docNo, nextSeq, SEQ_START } from "@/lib/sequences";
import { dateVal, s, optional } from "@/lib/forms";
import type { ActionResult } from "@/lib/forms";

const LEAD_STATUS_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "SITE_VISIT", "ESTIMATE", "NEGOTIATION", "WON"];
const REQUEST_TO_LEAD: Record<string, string> = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  QUALIFIED: "QUALIFIED",
  SITE_VISIT_SCHEDULED: "SITE_VISIT",
  ESTIMATE_PENDING: "ESTIMATE",
};

function refresh(id?: string) {
  revalidatePath("/crm/requests");
  revalidatePath("/crm/leads");
  revalidatePath("/crm/dashboard");
  revalidatePath("/crm/customers");
  if (id) revalidatePath(`/crm/customers/${id}`);
}

export async function createRequest(formData: FormData): Promise<ActionResult> {
  const g = await guard("requests");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const customerId = s(formData, "customerId");
    const description = s(formData, "description");
    if (!customerId) return { ok: false, error: "Select a customer." };
    if (!description) return { ok: false, error: "Describe the requested work." };
    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { ok: false, error: "Customer not found." };

    const serviceId = optional(formData, "serviceId");
    const service = serviceId ? await db.service.findUnique({ where: { id: serviceId } }) : null;
    const urgency = s(formData, "urgency", "NORMAL") || "NORMAL";
    const status = s(formData, "status", "NEW") || "NEW";
    const source = s(formData, "source", "Manual") || "Manual";
    const assignedToId = optional(formData, "assignedToId") ?? (g.user.role === "SALES_REP" ? g.user.employeeId : null);
    const preferredDate = dateVal(formData, "preferredDate");
    const address = s(formData, "address") || customer.serviceAddress;
    const city = s(formData, "city") || customer.city;
    const state = s(formData, "state", customer.state) || customer.state;
    const zip = s(formData, "zip") || customer.zip;

    const result = await db.$transaction(async (tx) => {
      const requestNo = docNo("SR", await nextSeq(tx, "request", SEQ_START.request));
      const request = await tx.serviceRequest.create({
        data: {
          requestNo, customerId, source, serviceId, projectType: s(formData, "projectType", "Residential") || "Residential",
          description, urgency, status, assignedToId, preferredDate, address, city, state, zip,
          notes: optional(formData, "notes"), estimatedSize: optional(formData, "estimatedSize"),
        },
      });
      const leadNo = docNo("LD", await nextSeq(tx, "lead", SEQ_START.lead));
      const lead = await tx.lead.create({
        data: {
          leadNo, customerId, title: `${service?.name ?? "Service"} — ${customer.name}`,
          source, serviceId, projectType: s(formData, "projectType", "Residential") || "Residential",
          estimatedValue: 0, assignedToId, priority: urgency === "NORMAL" ? "MEDIUM" : urgency === "URGENT" ? "HIGH" : "CRITICAL",
          status: REQUEST_TO_LEAD[status] ?? "NEW", description, notes: optional(formData, "notes"),
          lastContactAt: status !== "NEW" ? new Date() : null, createdById: g.user.id,
        },
      });
      await tx.serviceRequest.update({ where: { id: request.id }, data: { leadId: lead.id } });
      await tx.activity.create({
        data: {
          customerId, leadId: lead.id, type: "REQUEST",
          title: `${requestNo} created — ${service?.name ?? "Service request"}`,
          description: `${source} · ${urgency.toLowerCase()} urgency`,
          actorName: g.user.name,
        },
      });
      return { request, lead };
    });

    await recordAudit({ user: g.user, action: "CREATE", module: "Service Requests", recordId: result.request.id, recordLabel: `${result.request.requestNo} ${customer.name}`, newValue: `Lead ${result.lead.leadNo}` });
    await notify({
      roles: ["SALES_MANAGER"], employeeIds: assignedToId ? [assignedToId] : [], type: "REQUEST",
      title: `New service request — ${customer.company ?? customer.name}`,
      body: `${result.request.requestNo} · ${service?.name ?? "Service"} · ${urgency.toLowerCase()}`,
      link: `/crm/requests?q=${result.request.requestNo}`,
    });
    refresh(customerId);
    return { ok: true, id: result.request.id, message: `${result.request.requestNo} created with lead ${result.lead.leadNo}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateRequest(formData: FormData): Promise<ActionResult> {
  const g = await guard("requests");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const id = s(formData, "id");
    const existing = await db.serviceRequest.findUnique({ where: { id }, include: { lead: true, customer: true } });
    if (!existing) return { ok: false, error: "Service request not found." };
    if (g.user.role === "SALES_REP" && existing.assignedToId !== g.user.employeeId && existing.lead?.assignedToId !== g.user.employeeId) {
      return { ok: false, error: "You can only update requests assigned to you." };
    }
    const status = s(formData, "status", existing.status) || existing.status;
    const assignedToId = optional(formData, "assignedToId");
    const urgency = s(formData, "urgency", existing.urgency) || existing.urgency;
    const preferredDate = dateVal(formData, "preferredDate");
    const serviceId = optional(formData, "serviceId");
    const address = s(formData, "address", existing.address) || existing.address;
    const city = s(formData, "city", existing.city) || existing.city;
    const zip = s(formData, "zip", existing.zip) || existing.zip;

    await db.serviceRequest.update({
      where: { id },
      data: {
        status, assignedToId, urgency, preferredDate, serviceId,
        description: s(formData, "description", existing.description) || existing.description,
        notes: optional(formData, "notes"), address, city, zip,
        projectType: s(formData, "projectType", existing.projectType) || existing.projectType,
      },
    });

    if (existing.lead) {
      const mapped = REQUEST_TO_LEAD[status];
      if (mapped) {
        const currentIndex = LEAD_STATUS_ORDER.indexOf(existing.lead.status);
        const nextIndex = LEAD_STATUS_ORDER.indexOf(mapped);
        if (existing.lead.status !== "WON" && existing.lead.status !== "LOST" && nextIndex > currentIndex) {
          await db.lead.update({
            where: { id: existing.lead.id },
            data: {
              status: mapped,
              lastContactAt: existing.lead.lastContactAt ?? new Date(),
              responseMins: existing.lead.responseMins ?? (existing.lead.status === "NEW" ? Math.max(1, Math.round((Date.now() - existing.lead.createdAt.getTime()) / 60_000)) : null),
            },
          });
        }
      }
    }

    if (existing.status !== status || existing.assignedToId !== assignedToId) {
      await db.activity.create({
        data: {
          customerId: existing.customerId, leadId: existing.leadId, type: "STATUS",
          title: existing.status !== status ? `Service request moved to ${status.replace(/_/g, " ").toLowerCase()}` : "Service request reassigned",
          actorName: g.user.name,
        },
      });
    }
    await recordAudit({
      user: g.user, action: existing.status !== status ? "STATUS" : "UPDATE", module: "Service Requests", recordId: id,
      recordLabel: `${existing.requestNo} ${existing.customer.name}`,
      previousValue: existing.status, newValue: status,
    });
    if (assignedToId && assignedToId !== existing.assignedToId) {
      await notify({ employeeIds: [assignedToId], type: "REQUEST", title: `Request assigned — ${existing.customer.name}`, body: `${existing.requestNo} · ${status.replace(/_/g, " ").toLowerCase()}`, link: `/crm/requests?q=${existing.requestNo}` });
    }
    refresh(existing.customerId);
    return { ok: true, id, message: `${existing.requestNo} updated.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateRequestStatus(requestId: string, status: string): Promise<ActionResult> {
  const g = await guard("requests");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const request = await db.serviceRequest.findUnique({ where: { id: requestId }, include: { lead: true, customer: true } });
    if (!request) return { ok: false, error: "Service request not found." };
    await db.serviceRequest.update({ where: { id: requestId }, data: { status } });
    const mapped = REQUEST_TO_LEAD[status];
    if (request.lead && mapped) {
      const currentIndex = LEAD_STATUS_ORDER.indexOf(request.lead.status);
      const nextIndex = LEAD_STATUS_ORDER.indexOf(mapped);
      if (request.lead.status !== "WON" && request.lead.status !== "LOST" && nextIndex > currentIndex) {
        await db.lead.update({ where: { id: request.lead.id }, data: { status: mapped, lastContactAt: new Date() } });
      }
    }
    await recordAudit({ user: g.user, action: "STATUS", module: "Service Requests", recordId: requestId, recordLabel: `${request.requestNo} ${request.customer.name}`, previousValue: request.status, newValue: status });
    await db.activity.create({ data: { customerId: request.customerId, leadId: request.leadId, type: "STATUS", title: `Service request moved to ${status.replace(/_/g, " ").toLowerCase()}`, actorName: g.user.name } });
    refresh(request.customerId);
    return { ok: true, message: `Request moved to ${status.replace(/_/g, " ").toLowerCase()}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function addRequestNote(formData: FormData): Promise<ActionResult> {
  const g = await guard("requests");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const requestId = s(formData, "requestId");
    const note = s(formData, "note");
    if (!note) return { ok: false, error: "Write a note first." };
    const request = await db.serviceRequest.findUnique({ where: { id: requestId }, include: { customer: true } });
    if (!request) return { ok: false, error: "Service request not found." };
    await db.serviceRequest.update({ where: { id: requestId }, data: { notes: `${request.notes ? `${request.notes}\n\n` : ""}${note}` } });
    await db.activity.create({ data: { customerId: request.customerId, leadId: request.leadId, type: "NOTE", title: note, actorName: g.user.name } });
    await recordAudit({ user: g.user, action: "UPDATE", module: "Service Requests", recordId: requestId, recordLabel: `${request.requestNo} note added`, newValue: note.slice(0, 160) });
    refresh(request.customerId);
    return { ok: true, message: "Note added." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function cancelRequest(requestId: string): Promise<ActionResult> {
  return updateRequestStatus(requestId, "CANCELLED");
}
