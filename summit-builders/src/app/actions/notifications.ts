"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { guard, actionError } from "@/lib/guard";
import type { ActionResult } from "@/lib/forms";

function refresh() {
  revalidatePath("/crm/notifications");
  revalidatePath("/crm/layout");
  revalidatePath("/crm/dashboard");
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const g = await guard("notifications");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const row = await db.notification.findUnique({ where: { id } });
    if (!row) return { ok: false, error: "Notification not found." };
    if (row.userId && row.userId !== g.user.id) return { ok: false, error: "This notification belongs to another user." };
    await db.notification.update({ where: { id }, data: { read: true } });
    refresh();
    return { ok: true, message: "Marked as read." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const g = await guard("notifications");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const result = await db.notification.updateMany({ where: { userId: g.user.id, read: false }, data: { read: true } });
    refresh();
    return { ok: true, message: result.count ? `${result.count} notifications marked read.` : "You are already caught up." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function deleteNotification(id: string): Promise<ActionResult> {
  const g = await guard("notifications");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const row = await db.notification.findUnique({ where: { id } });
    if (!row) return { ok: false, error: "Notification not found." };
    if (row.userId && row.userId !== g.user.id) return { ok: false, error: "This notification belongs to another user." };
    await db.notification.delete({ where: { id } });
    refresh();
    return { ok: true, message: "Notification dismissed." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}
