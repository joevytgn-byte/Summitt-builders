"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { guard, actionError } from "@/lib/guard";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { dateVal, int, optional, s } from "@/lib/forms";
import type { ActionResult } from "@/lib/forms";

function refresh() {
  revalidatePath("/crm/calls");
  revalidatePath("/crm/dashboard");
  revalidatePath("/crm/performance");
  revalidatePath("/crm/reports");
  revalidatePath("/crm/leads");
}

export async function createCall(formData: FormData): Promise<ActionResult> {
  const g = await guard("calls");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const employeeId = g.user.role === "SALES_REP" || g.user.role === "FIELD" ? g.user.employeeId : optional(formData, "employeeId") ?? g.user.employeeId;
    if (!employeeId) return { ok: false, error: "This account is not linked to an employee record." };
    const customerId = optional(formData, "customerId");
    const leadId = optional(formData, "leadId");
    const date = dateVal(formData, "date") ?? new Date();
    const startTime = s(formData, "startTime", "09:00") || "09:00";
    const endTime = s(formData, "endTime");
    const [h, m] = startTime.split(":").map(Number);
    const startedAt = new Date(date);
    startedAt.setHours(h || 0, m || 0, 0, 0);
    let endedAt: Date | null = null;
    let durationSec = 0;
    if (endTime) {
      const [eh, em] = endTime.split(":").map(Number);
      endedAt = new Date(date);
      endedAt.setHours(eh || 0, em || 0, 0, 0);
      if (endedAt < startedAt) endedAt = new Date(endedAt.getTime() + 86_400_000);
      durationSec = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
    } else {
      durationSec = Math.max(0, int(formData, "durationMins", 0) * 60);
      if (durationSec) endedAt = new Date(startedAt.getTime() + durationSec * 1000);
    }

    const outcome = s(formData, "outcome", "CONNECTED") || "CONNECTED";
    const connected = ["CONNECTED", "CALLBACK"].includes(outcome);
    const followUpRequired = s(formData, "followUpRequired") === "on" || s(formData, "followUpRequired") === "true";
    const followUpDate = dateVal(formData, "followUpDate");

    const call = await db.call.create({
      data: {
        employeeId, customerId, leadId, startedAt, endedAt, durationSec,
        direction: s(formData, "direction", "OUTGOING") || "OUTGOING",
        callType: s(formData, "callType", "Sales") || "Sales",
        outcome, connected,
        notes: optional(formData, "notes"), followUpRequired, followUpDate,
      },
    });

    if (customerId) {
      await db.activity.create({
        data: {
          customerId, leadId, type: "CALL",
          title: `${connected ? "Connected call" : "Call attempt"} — ${Math.max(1, Math.round(durationSec / 60))} min`,
          description: optional(formData, "notes") ?? undefined,
          actorName: g.user.name,
        },
      });
    }

    if (leadId) {
      const lead = await db.lead.findUnique({ where: { id: leadId } });
      if (lead) {
        await db.lead.update({
          where: { id: leadId },
          data: {
            lastContactAt: connected ? new Date() : lead.lastContactAt,
            responseMins: lead.responseMins ?? (lead.status === "NEW" && connected ? Math.max(1, Math.round((Date.now() - lead.createdAt.getTime()) / 60_000)) : null),
            status: lead.status === "NEW" && connected ? "CONTACTED" : lead.status,
            nextFollowUp: followUpRequired && followUpDate ? followUpDate : lead.nextFollowUp,
          },
        });
        if (followUpRequired && followUpDate && customerId) {
          await db.followUp.create({
            data: {
              leadId, customerId, dueAt: followUpDate, assignedToId: employeeId,
              subject: `Follow up after call — ${lead.title}`, notes: optional(formData, "notes"),
              status: "PENDING",
            },
          });
        }
      }
    }

    await recordAudit({ user: g.user, action: "CREATE", module: "Calls", recordId: call.id, recordLabel: `Call with ${customerId ? "customer" : leadId ? "lead" : "contact"}`, newValue: `${outcome} · ${durationSec}s` });
    refresh();
    return { ok: true, id: call.id, message: `Call logged (${Math.max(1, Math.round(durationSec / 60))} min).` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateCallNotes(callId: string, notes: string): Promise<ActionResult> {
  const g = await guard("calls");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const call = await db.call.findUnique({ where: { id: callId } });
    if (!call) return { ok: false, error: "Call not found." };
    if ((g.user.role === "SALES_REP" || g.user.role === "FIELD") && call.employeeId !== g.user.employeeId) {
      return { ok: false, error: "You can only edit your own calls." };
    }
    await db.call.update({ where: { id: callId }, data: { notes } });
    await recordAudit({ user: g.user, action: "UPDATE", module: "Calls", recordId: callId, recordLabel: "Call notes updated", newValue: notes.slice(0, 160) });
    refresh();
    return { ok: true, message: "Call notes saved." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}
