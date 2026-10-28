"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { guard, actionError } from "@/lib/guard";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { createProjectFromDeal } from "@/lib/workflow";
import { docNo, nextSeq, SEQ_START } from "@/lib/sequences";
import { dateVal, moneyValue, s, optional } from "@/lib/forms";
import type { ActionResult } from "@/lib/forms";

type RawItem = { description?: string; category?: string; quantity?: number | string; unit?: string; unitPrice?: number | string };

function parseItems(raw: string): Array<{ description: string; category: string; quantity: number; unit: string; unitPrice: number; amount: number; sortOrder: number }> {
  let parsed: RawItem[] = [];
  try {
    const json = JSON.parse(raw || "[]");
    if (Array.isArray(json)) parsed = json;
  } catch {
    parsed = [];
  }
  return parsed
    .map((item, index) => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
      return {
        description: String(item.description ?? "").trim(),
        category: String(item.category ?? "LABOR"),
        quantity,
        unit: String(item.unit ?? "ea"),
        unitPrice,
        amount: Math.round(quantity * unitPrice * 100) / 100,
        sortOrder: index,
      };
    })
    .filter((i) => i.description && i.quantity > 0);
}

function totals(items: Array<{ amount: number }>, discount: number, taxRate: number) {
  const subtotal = Math.round(items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(taxable * (taxRate / 100) * 100) / 100;
  const total = Math.round((taxable + taxAmount) * 100) / 100;
  return { subtotal, taxAmount, total };
}

function refresh(id?: string) {
  revalidatePath("/crm/estimates");
  revalidatePath("/crm/dashboard");
  revalidatePath("/crm/leads");
  revalidatePath("/crm/projects");
  revalidatePath("/crm/reports");
  if (id) revalidatePath(`/crm/estimates/${id}`);
}

async function syncLead(leadId: string | null, total: number, status: string) {
  if (!leadId) return;
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead || ["WON", "LOST"].includes(lead.status)) return;
  await db.lead.update({
    where: { id: leadId },
    data: {
      estimatedValue: total || lead.estimatedValue,
      status: lead.status === "NEW" || lead.status === "CONTACTED" || lead.status === "QUALIFIED" || lead.status === "SITE_VISIT" ? "ESTIMATE" : lead.status,
      nextFollowUp: new Date(Date.now() + 3 * 86_400_000),
    },
  });
  await db.activity.create({
    data: { customerId: lead.customerId, leadId, type: "ESTIMATE", title: `Estimate ${status.toLowerCase()} — ${total.toLocaleString("en-US", { style: "currency", currency: "USD" })}` },
  });
}

export async function createEstimate(formData: FormData): Promise<ActionResult> {
  const g = await guard("estimates");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const customerId = s(formData, "customerId");
    const title = s(formData, "title");
    if (!customerId) return { ok: false, error: "Select a customer." };
    if (!title) return { ok: false, error: "Give the estimate a title." };
    const items = parseItems(s(formData, "items"));
    if (!items.length) return { ok: false, error: "Add at least one line item with a description and quantity." };
    const discount = moneyValue(formData, "discount");
    const taxRate = Math.max(0, Number(s(formData, "taxRate", "0")) || 0);
    const { subtotal, taxAmount, total } = totals(items, discount, taxRate);
    const leadId = optional(formData, "leadId");
    const validUntil = dateVal(formData, "validUntil") ?? new Date(Date.now() + 30 * 86_400_000);
    const status = s(formData, "status", "DRAFT") || "DRAFT";

    const estimate = await db.$transaction(async (tx) => {
      const estimateNo = docNo("EST", await nextSeq(tx, "estimate", SEQ_START.estimate));
      return tx.estimate.create({
        data: {
          estimateNo, customerId, leadId, title, status, validUntil, subtotal, discount, taxRate, taxAmount, total,
          notes: optional(formData, "notes"), createdById: g.user.id,
          sentAt: status === "SENT" ? new Date() : null,
          items: { create: items },
        },
      });
    });

    await syncLead(leadId, total, status);
    await db.activity.create({ data: { customerId, leadId, type: "ESTIMATE", title: `${estimate.estimateNo} created — ${title}`, description: `${total.toLocaleString("en-US", { style: "currency", currency: "USD" })}`, actorName: g.user.name } });
    await recordAudit({ user: g.user, action: "CREATE", module: "Estimates", recordId: estimate.id, recordLabel: `${estimate.estimateNo} ${title}`, newValue: `${total.toFixed(2)} · ${status}` });
    refresh(estimate.id);
    return { ok: true, id: estimate.id, message: `${estimate.estimateNo} saved as ${status.toLowerCase()}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateEstimate(formData: FormData): Promise<ActionResult> {
  const g = await guard("estimates");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const id = s(formData, "id");
    const existing = await db.estimate.findUnique({ where: { id }, include: { customer: true } });
    if (!existing) return { ok: false, error: "Estimate not found." };
    const items = parseItems(s(formData, "items"));
    if (!items.length) return { ok: false, error: "Add at least one line item." };
    const discount = moneyValue(formData, "discount");
    const taxRate = Math.max(0, Number(s(formData, "taxRate", "0")) || 0);
    const { subtotal, taxAmount, total } = totals(items, discount, taxRate);
    const status = s(formData, "status", existing.status) || existing.status;
    const validUntil = dateVal(formData, "validUntil") ?? existing.validUntil;

    await db.$transaction(async (tx) => {
      await tx.estimateItem.deleteMany({ where: { estimateId: id } });
      await tx.estimate.update({
        where: { id },
        data: {
          title: s(formData, "title", existing.title) || existing.title,
          customerId: s(formData, "customerId", existing.customerId) || existing.customerId,
          leadId: optional(formData, "leadId"), status, validUntil, subtotal, discount, taxRate, taxAmount, total,
          notes: optional(formData, "notes"),
          sentAt: status === "SENT" && !existing.sentAt ? new Date() : existing.sentAt,
          decidedAt: ["ACCEPTED", "REJECTED"].includes(status) && !existing.decidedAt ? new Date() : existing.decidedAt,
          approvedById: status === "ACCEPTED" ? existing.approvedById ?? g.user.id : existing.approvedById,
          items: { create: items },
        },
      });
    });

    await syncLead(existing.leadId, total, status);
    await recordAudit({ user: g.user, action: "UPDATE", module: "Estimates", recordId: id, recordLabel: `${existing.estimateNo} ${existing.title}`, previousValue: `${existing.total.toFixed(2)} · ${existing.status}`, newValue: `${total.toFixed(2)} · ${status}` });
    refresh(id);
    return { ok: true, id, message: `${existing.estimateNo} updated.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateEstimateStatus(estimateId: string, status: string): Promise<ActionResult> {
  const g = await guard("estimates");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const existing = await db.estimate.findUnique({ where: { id: estimateId }, include: { customer: true } });
    if (!existing) return { ok: false, error: "Estimate not found." };
    const now = new Date();
    await db.estimate.update({
      where: { id: estimateId },
      data: {
        status,
        sentAt: status === "SENT" && !existing.sentAt ? now : existing.sentAt,
        decidedAt: ["ACCEPTED", "REJECTED"].includes(status) ? now : existing.decidedAt,
        approvedById: status === "ACCEPTED" ? g.user.id : existing.approvedById,
      },
    });
    await db.activity.create({
      data: {
        customerId: existing.customerId, leadId: existing.leadId, type: "ESTIMATE",
        title: `Estimate ${existing.estimateNo} marked ${status.toLowerCase()}`,
        description: `${existing.total.toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
        actorName: g.user.name,
      },
    });
    await recordAudit({ user: g.user, action: "STATUS", module: "Estimates", recordId: estimateId, recordLabel: `${existing.estimateNo} ${existing.title}`, previousValue: existing.status, newValue: status });
    if (status === "ACCEPTED") {
      await notify({
        roles: ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER"], type: "ESTIMATE",
        title: `Estimate accepted — ${existing.customer.company ?? existing.customer.name}`,
        body: `${existing.estimateNo} · ${existing.total.toLocaleString("en-US", { style: "currency", currency: "USD" })}. Ready to convert to a project.`,
        link: `/crm/estimates/${estimateId}`,
      });
    }
    if (status === "REJECTED") {
      await notify({
        roles: ["SALES_MANAGER"], type: "ESTIMATE",
        title: `Estimate rejected — ${existing.customer.company ?? existing.customer.name}`,
        body: `${existing.estimateNo} · Follow up to capture the lost reason.`,
        link: `/crm/estimates/${estimateId}`,
      });
    }
    refresh(estimateId);
    return { ok: true, id: estimateId, message: `Estimate marked ${status.toLowerCase()}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function convertEstimateToProject(formData: FormData): Promise<ActionResult> {
  const g = await guard("estimates");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const estimateId = s(formData, "estimateId");
    const estimate = await db.estimate.findUnique({ where: { id: estimateId }, include: { customer: true, project: true } });
    if (!estimate) return { ok: false, error: "Estimate not found." };
    if (estimate.project) return { ok: true, id: estimate.project.id, message: `Already converted to ${estimate.project.projectNo}.` };
    if (["REJECTED", "EXPIRED"].includes(estimate.status)) return { ok: false, error: "Rejected or expired estimates cannot be converted. Revise the estimate first." };

    const result = await createProjectFromDeal({
      customerId: estimate.customerId,
      name: s(formData, "name") || estimate.title,
      description: `Converted from estimate ${estimate.estimateNo}.`,
      contractValue: estimate.total,
      serviceId: null,
      projectType: "Residential",
      address: estimate.customer.serviceAddress,
      estimateId: estimate.id,
      managerId: optional(formData, "managerId"),
      actorName: g.user.name,
    });

    const startDate = dateVal(formData, "startDate");
    const expectedEnd = dateVal(formData, "expectedEnd");
    if (startDate || expectedEnd) {
      await db.project.update({ where: { id: result.project.id }, data: { startDate, expectedEnd } });
    }
    if (estimate.status !== "ACCEPTED") {
      await db.estimate.update({ where: { id: estimate.id }, data: { status: "ACCEPTED", decidedAt: estimate.decidedAt ?? new Date(), approvedById: estimate.approvedById ?? g.user.id } });
    }
    if (estimate.leadId) {
      await db.lead.update({ where: { id: estimate.leadId }, data: { status: "WON", wonAt: new Date(), lostAt: null, lostReason: null } });
    }
    await recordAudit({ user: g.user, action: "CREATE", module: "Projects", recordId: result.project.id, recordLabel: `${result.project.projectNo} from ${estimate.estimateNo}`, newValue: `Contract: ${estimate.total}` });
    refresh(estimate.id);
    revalidatePath("/crm/projects");
    return { ok: true, id: result.project.id, message: `Project ${result.project.projectNo} created with kickoff job.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function reviseEstimate(estimateId: string): Promise<ActionResult> {
  const g = await guard("estimates");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const existing = await db.estimate.findUnique({ where: { id: estimateId }, include: { items: true } });
    if (!existing) return { ok: false, error: "Estimate not found." };
    const newEstimate = await db.$transaction(async (tx) => {
      const estimateNo = docNo("EST", await nextSeq(tx, "estimate", SEQ_START.estimate));
      return tx.estimate.create({
        data: {
          estimateNo, customerId: existing.customerId, leadId: existing.leadId, title: `${existing.title} (revised)`,
          status: "DRAFT", validUntil: new Date(Date.now() + 30 * 86_400_000),
          subtotal: existing.subtotal, discount: existing.discount, taxRate: existing.taxRate, taxAmount: existing.taxAmount, total: existing.total,
          notes: existing.notes, createdById: g.user.id,
          items: {
            create: existing.items.map((i) => ({
              description: i.description, category: i.category, quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice, amount: i.amount, sortOrder: i.sortOrder,
            })),
          },
        },
      });
    });
    await db.estimate.update({ where: { id: estimateId }, data: { status: "REVISED" } });
    await recordAudit({ user: g.user, action: "CREATE", module: "Estimates", recordId: newEstimate.id, recordLabel: `Revision of ${existing.estimateNo}`, newValue: newEstimate.estimateNo });
    refresh(newEstimate.id);
    return { ok: true, id: newEstimate.id, message: `Revision ${newEstimate.estimateNo} created.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}
