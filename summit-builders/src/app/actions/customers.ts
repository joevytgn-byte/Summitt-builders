"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { guard, actionError } from "@/lib/guard";
import { recordAudit } from "@/lib/audit";
import { docNo, nextSeq, SEQ_START } from "@/lib/sequences";
import { s, optional } from "@/lib/forms";
import type { ActionResult } from "@/lib/forms";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(-10);
}

function refresh(id?: string) {
  revalidatePath("/crm/customers");
  revalidatePath("/crm/dashboard");
  revalidatePath("/crm/leads");
  revalidatePath("/crm/requests");
  if (id) revalidatePath(`/crm/customers/${id}`);
}

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  const g = await guard("customers");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const name = s(formData, "name");
    const phone = s(formData, "phone");
    const email = s(formData, "email");
    if (!name) return { ok: false, error: "Customer name is required." };
    if (!phone) return { ok: false, error: "A phone number is required." };

    const candidates = await db.customer.findMany({ select: { id: true, name: true, customerNo: true, phone: true, email: true } });
    const phoneKey = normalizePhone(phone);
    const emailKey = email.toLowerCase();
    const duplicate = candidates.find(
      (c) => (emailKey && c.email?.toLowerCase() === emailKey) || (phoneKey.length >= 7 && normalizePhone(c.phone) === phoneKey),
    );
    if (duplicate) {
      return { ok: false, error: `Possible duplicate: ${duplicate.name} (${duplicate.customerNo}) already uses this phone or email. Open that record instead.` };
    }

    const customer = await db.$transaction(async (tx) => {
      const customerNo = docNo("CUS", await nextSeq(tx, "customer", SEQ_START.customer));
      return tx.customer.create({
        data: {
          customerNo,
          name,
          company: optional(formData, "company"),
          phone,
          email: email || null,
          serviceAddress: s(formData, "serviceAddress"),
          city: s(formData, "city"),
          state: s(formData, "state", "CO") || "CO",
          zip: s(formData, "zip"),
          billingAddress: optional(formData, "billingAddress"),
          leadSource: s(formData, "leadSource", "Manual Entry") || "Manual Entry",
          assignedRepId: optional(formData, "assignedRepId") ?? (g.user.role === "SALES_REP" ? g.user.employeeId : null),
          notes: optional(formData, "notes"),
          status: "ACTIVE",
        },
      });
    });
    await db.activity.create({ data: { customerId: customer.id, type: "NOTE", title: `Customer profile created by ${g.user.name}`, actorName: g.user.name } });
    await recordAudit({ user: g.user, action: "CREATE", module: "Customers", recordId: customer.id, recordLabel: `${customer.customerNo} ${customer.name}` });
    refresh(customer.id);
    return { ok: true, id: customer.id, message: `${customer.customerNo} created.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateCustomer(formData: FormData): Promise<ActionResult> {
  const g = await guard("customers");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const id = s(formData, "id");
    const existing = await db.customer.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Customer not found." };
    if (g.user.role === "SALES_REP" && existing.assignedRepId !== g.user.employeeId) {
      return { ok: false, error: "You can only edit customers assigned to you." };
    }
    const status = s(formData, "status", existing.status) || existing.status;
    const updated = await db.customer.update({
      where: { id },
      data: {
        name: s(formData, "name", existing.name) || existing.name,
        company: optional(formData, "company"),
        phone: s(formData, "phone", existing.phone) || existing.phone,
        email: optional(formData, "email"),
        serviceAddress: s(formData, "serviceAddress", existing.serviceAddress) || existing.serviceAddress,
        city: s(formData, "city", existing.city) || existing.city,
        state: s(formData, "state", existing.state) || existing.state,
        zip: s(formData, "zip", existing.zip) || existing.zip,
        billingAddress: optional(formData, "billingAddress"),
        leadSource: s(formData, "leadSource", existing.leadSource) || existing.leadSource,
        assignedRepId: g.user.role === "SALES_REP" ? existing.assignedRepId : optional(formData, "assignedRepId"),
        status,
        notes: optional(formData, "notes"),
      },
    });
    await recordAudit({
      user: g.user, action: "UPDATE", module: "Customers", recordId: id,
      recordLabel: `${existing.customerNo} ${existing.name}`,
      previousValue: `${existing.name} · ${existing.phone} · ${existing.serviceAddress}`,
      newValue: `${updated.name} · ${updated.phone} · ${updated.serviceAddress}`,
    });
    if (existing.status !== status) {
      await db.activity.create({ data: { customerId: id, type: "STATUS", title: `Customer status changed to ${status.toLowerCase()}`, actorName: g.user.name } });
    }
    refresh(id);
    return { ok: true, id, message: "Customer updated." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function setCustomerStatus(customerId: string, status: string): Promise<ActionResult> {
  const g = await guard("customers");
  if (!g.ok) return { ok: false, error: g.error };
  if (g.user.role === "SALES_REP") return { ok: false, error: "Only management can archive customer records." };
  try {
    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { ok: false, error: "Customer not found." };
    await db.customer.update({ where: { id: customerId }, data: { status } });
    await recordAudit({ user: g.user, action: status === "ARCHIVED" ? "ARCHIVE" : "UPDATE", module: "Customers", recordId: customerId, recordLabel: `${customer.customerNo} ${customer.name}`, previousValue: customer.status, newValue: status });
    await db.activity.create({ data: { customerId, type: "STATUS", title: `Customer status changed to ${status.toLowerCase()}`, actorName: g.user.name } });
    refresh(customerId);
    return { ok: true, message: `Customer marked ${status.toLowerCase()}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function addCustomerNote(formData: FormData): Promise<ActionResult> {
  const g = await guard("customers");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const customerId = s(formData, "customerId");
    const note = s(formData, "note");
    if (!note) return { ok: false, error: "Write a note first." };
    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { ok: false, error: "Customer not found." };
    await db.activity.create({ data: { customerId, type: "NOTE", title: note, actorName: g.user.name } });
    const stamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    await db.customer.update({ where: { id: customerId }, data: { notes: `${customer.notes ? `${customer.notes}\n\n` : ""}[${stamp}] ${note}` } });
    await recordAudit({ user: g.user, action: "UPDATE", module: "Customers", recordId: customerId, recordLabel: `${customer.customerNo} note added`, newValue: note.slice(0, 160) });
    refresh(customerId);
    return { ok: true, message: "Note added to timeline." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}
