"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { guard, actionError } from "@/lib/guard";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { dateVal, int, optional, s } from "@/lib/forms";
import type { ActionResult } from "@/lib/forms";

const STANDARD_START = "08:00";

function refresh() {
  revalidatePath("/crm/attendance");
  revalidatePath("/crm/dashboard");
  revalidatePath("/crm/performance");
  revalidatePath("/crm/reports");
  revalidatePath("/crm/employees");
}

function timeToMinutes(value: string | null | undefined) {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h * 60 + (m || 0);
}

function computeHours(clockIn: string | null, clockOut: string | null, breakMins: number) {
  const start = timeToMinutes(clockIn);
  const end = timeToMinutes(clockOut);
  if (start === null || end === null) return 0;
  const diff = end >= start ? end - start : end + 24 * 60 - start;
  return Math.max(0, Math.round(((diff - breakMins) / 60) * 100) / 100);
}

function normalizeDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function clockIn(employeeId?: string): Promise<ActionResult> {
  const g = await guard("attendance");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const target = employeeId && ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "DISPATCHER"].includes(g.user.role)
      ? employeeId
      : g.user.employeeId;
    if (!target) return { ok: false, error: "Your account is not linked to an employee record." };
    const today = normalizeDay(new Date());
    const existing = await db.attendance.findUnique({ where: { employeeId_date: { employeeId: target, date: today } } });
    const now = new Date();
    const stamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const lateMinutes = Math.max(0, (timeToMinutes(stamp) ?? 0) - (timeToMinutes(STANDARD_START) ?? 0));

    if (existing) {
      if (existing.clockIn) return { ok: false, error: `Already clocked in today at ${existing.clockIn}.` };
      await db.attendance.update({
        where: { id: existing.id },
        data: { clockIn: stamp, status: lateMinutes > 5 ? "LATE" : "PRESENT", lateMinutes },
      });
    } else {
      await db.attendance.create({
        data: {
          employeeId: target, date: today, clockIn: stamp,
          status: lateMinutes > 5 ? "LATE" : "PRESENT", lateMinutes, breakMins: 30,
        },
      });
    }
    const employee = await db.employee.findUnique({ where: { id: target } });
    await recordAudit({
      user: g.user, action: "UPDATE", module: "Attendance", recordId: target,
      recordLabel: `${employee?.employeeNo ?? ""} clocked in`, newValue: stamp,
    });
    refresh();
    return { ok: true, message: `Clocked in at ${stamp}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function clockOut(employeeId?: string): Promise<ActionResult> {
  const g = await guard("attendance");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const target = employeeId && ["SUPER_ADMIN", "ADMIN", "PROJECT_MANAGER", "DISPATCHER"].includes(g.user.role)
      ? employeeId
      : g.user.employeeId;
    if (!target) return { ok: false, error: "Your account is not linked to an employee record." };
    const today = normalizeDay(new Date());
    const existing = await db.attendance.findUnique({ where: { employeeId_date: { employeeId: target, date: today } } });
    if (!existing || !existing.clockIn) return { ok: false, error: "You have not clocked in yet today." };
    if (existing.clockOut) return { ok: false, error: `Already clocked out at ${existing.clockOut}.` };
    const now = new Date();
    const stamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const total = computeHours(existing.clockIn, stamp, existing.breakMins);
    const overtime = Math.max(0, Math.round((total - 8) * 100) / 100);
    await db.attendance.update({
      where: { id: existing.id },
      data: {
        clockOut: stamp, totalHours: total,
        regularHours: Math.min(8, total), overtimeHours: overtime,
      },
    });
    await recordAudit({
      user: g.user, action: "UPDATE", module: "Attendance", recordId: target,
      recordLabel: `${target} clocked out`, newValue: `${stamp} · ${total}h`,
    });
    refresh();
    return { ok: true, message: `Clocked out at ${stamp}. ${total}h recorded.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function saveAttendance(formData: FormData): Promise<ActionResult> {
  const g = await guard("attendance");
  if (!g.ok) return { ok: false, error: g.error };
  if (["FIELD", "SALES_REP"].includes(g.user.role)) {
    return { ok: false, error: "You can only clock yourself in and out." };
  }
  try {
    const employeeId = s(formData, "employeeId");
    const date = dateVal(formData, "date");
    if (!employeeId) return { ok: false, error: "Select an employee." };
    if (!date) return { ok: false, error: "Select a date." };
    const day = normalizeDay(date);
    const status = s(formData, "status", "PRESENT") || "PRESENT";
    const clockIn = optional(formData, "clockIn");
    const clockOut = optional(formData, "clockOut");
    const breakMins = Math.max(0, int(formData, "breakMins", 30));
    const totalHours = computeHours(clockIn, clockOut, breakMins);
    const overtime = Math.max(0, Math.round((totalHours - 8) * 100) / 100);
    const lateMinutes = status === "LATE" ? Math.max(0, (timeToMinutes(clockIn) ?? 0) - (timeToMinutes(STANDARD_START) ?? 0)) : 0;

    const payload = {
      clockIn: ["ABSENT", "LEAVE", "HOLIDAY"].includes(status) ? null : clockIn,
      clockOut: ["ABSENT", "LEAVE", "HOLIDAY"].includes(status) ? null : clockOut,
      breakMins, status, lateMinutes,
      totalHours: ["ABSENT", "LEAVE", "HOLIDAY"].includes(status) ? 0 : totalHours,
      regularHours: ["ABSENT", "LEAVE", "HOLIDAY"].includes(status) ? 0 : Math.min(8, totalHours),
      overtimeHours: ["ABSENT", "LEAVE", "HOLIDAY"].includes(status) ? 0 : overtime,
      notes: optional(formData, "notes"),
    };

    const existing = await db.attendance.findUnique({ where: { employeeId_date: { employeeId, date: day } } });
    const row = existing
      ? await db.attendance.update({ where: { id: existing.id }, data: payload })
      : await db.attendance.create({ data: { employeeId, date: day, ...payload } });

    const employee = await db.employee.findUnique({ where: { id: employeeId } });
    await recordAudit({
      user: g.user, action: existing ? "UPDATE" : "CREATE", module: "Attendance", recordId: row.id,
      recordLabel: `${employee?.employeeNo ?? ""} ${day.toISOString().slice(0, 10)}`,
      previousValue: existing ? `${existing.status} · ${existing.totalHours}h` : null,
      newValue: `${status} · ${payload.totalHours}h`,
    });
    if (status === "ABSENT" || status === "LATE") {
      await notify({
        roles: ["SUPER_ADMIN", "ADMIN"], type: "ATTENDANCE",
        title: `Attendance exception — ${employee?.firstName} ${employee?.lastName}`,
        body: `${status.toLowerCase()} on ${day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}${lateMinutes ? ` · ${lateMinutes} min late` : ""}`,
        link: "/crm/attendance",
      });
    }
    refresh();
    return { ok: true, message: `Attendance saved for ${employee?.firstName ?? "employee"}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function deleteAttendance(id: string): Promise<ActionResult> {
  const g = await guard("attendance");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) {
    return { ok: false, error: "Only administrators can remove attendance records." };
  }
  try {
    const row = await db.attendance.findUnique({ where: { id }, include: { employee: true } });
    if (!row) return { ok: false, error: "Attendance record not found." };
    await db.attendance.delete({ where: { id } });
    await recordAudit({
      user: g.user, action: "DELETE", module: "Attendance", recordId: id,
      recordLabel: `${row.employee.employeeNo} ${row.date.toISOString().slice(0, 10)}`,
      previousValue: `${row.status} · ${row.totalHours}h`,
    });
    refresh();
    return { ok: true, message: "Attendance record removed." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}
