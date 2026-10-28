"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { guard, actionError } from "@/lib/guard";
import { recordAudit } from "@/lib/audit";
import { docNo, nextSeq, SEQ_START } from "@/lib/sequences";
import { dateVal, moneyValue, optional, s } from "@/lib/forms";
import type { ActionResult } from "@/lib/forms";

function refresh(id?: string) {
  revalidatePath("/crm/employees");
  revalidatePath("/crm/attendance");
  revalidatePath("/crm/performance");
  revalidatePath("/crm/jobs");
  if (id) revalidatePath(`/crm/employees/${id}`);
}

export async function createEmployee(formData: FormData): Promise<ActionResult> {
  const g = await guard("employees");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) {
    return { ok: false, error: "Only administrators can add employees." };
  }
  try {
    const firstName = s(formData, "firstName");
    const lastName = s(formData, "lastName");
    const email = s(formData, "email").toLowerCase();
    const position = s(formData, "position");
    if (!firstName || !lastName) return { ok: false, error: "First and last name are required." };
    if (!email) return { ok: false, error: "An email address is required." };
    if (!position) return { ok: false, error: "Enter a position." };

    const duplicate = await db.employee.findUnique({ where: { email } });
    if (duplicate) return { ok: false, error: `${email} already belongs to ${duplicate.firstName} ${duplicate.lastName}.` };

    const employee = await db.$transaction(async (tx) => {
      const employeeNo = docNo("EMP", await nextSeq(tx, "employee", SEQ_START.employee));
      return tx.employee.create({
        data: {
          employeeNo,
          firstName,
          lastName,
          email,
          phone: optional(formData, "phone"),
          position,
          departmentId: optional(formData, "departmentId"),
          hireDate: dateVal(formData, "hireDate") ?? new Date(),
          status: s(formData, "status", "ACTIVE") || "ACTIVE",
          managerId: optional(formData, "managerId"),
          skills: s(formData, "skills"),
          hourlyRate: moneyValue(formData, "hourlyRate"),
          address: optional(formData, "address"),
          emergencyContact: optional(formData, "emergencyContact"),
          notes: optional(formData, "notes"),
          avatarColor: ["#ee6424", "#0ea5e9", "#8b5cf6", "#10b981", "#ec4899", "#f59e0b", "#14b8a6", "#ef4444"][
            Math.floor(Math.random() * 8)
          ],
        },
      });
    });

    await recordAudit({
      user: g.user, action: "CREATE", module: "Employees", recordId: employee.id,
      recordLabel: `${employee.employeeNo} ${firstName} ${lastName}`, newValue: position,
    });
    refresh(employee.id);
    return { ok: true, id: employee.id, message: `${employee.employeeNo} added.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateEmployee(formData: FormData): Promise<ActionResult> {
  const g = await guard("employees");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) {
    return { ok: false, error: "Only administrators can edit employee records." };
  }
  try {
    const id = s(formData, "id");
    const existing = await db.employee.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Employee not found." };
    const email = s(formData, "email", existing.email).toLowerCase() || existing.email;
    if (email !== existing.email) {
      const duplicate = await db.employee.findUnique({ where: { email } });
      if (duplicate) return { ok: false, error: `${email} is already in use.` };
    }
    const status = s(formData, "status", existing.status) || existing.status;

    const updated = await db.employee.update({
      where: { id },
      data: {
        firstName: s(formData, "firstName", existing.firstName) || existing.firstName,
        lastName: s(formData, "lastName", existing.lastName) || existing.lastName,
        email,
        phone: optional(formData, "phone"),
        position: s(formData, "position", existing.position) || existing.position,
        departmentId: optional(formData, "departmentId"),
        hireDate: dateVal(formData, "hireDate") ?? existing.hireDate,
        status,
        managerId: optional(formData, "managerId"),
        skills: s(formData, "skills"),
        hourlyRate: moneyValue(formData, "hourlyRate"),
        address: optional(formData, "address"),
        emergencyContact: optional(formData, "emergencyContact"),
        notes: optional(formData, "notes"),
      },
    });

    await recordAudit({
      user: g.user, action: existing.status !== status ? "STATUS" : "UPDATE", module: "Employees", recordId: id,
      recordLabel: `${existing.employeeNo} ${existing.firstName} ${existing.lastName}`,
      previousValue: `${existing.position} · ${existing.status}`,
      newValue: `${updated.position} · ${updated.status}`,
    });
    refresh(id);
    return { ok: true, id, message: `${existing.employeeNo} updated.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function setEmployeeStatus(employeeId: string, status: string): Promise<ActionResult> {
  const g = await guard("employees");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) {
    return { ok: false, error: "Only administrators can change employment status." };
  }
  try {
    const employee = await db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return { ok: false, error: "Employee not found." };
    if (employee.id === g.user.employeeId) return { ok: false, error: "You cannot change your own employment status." };
    await db.employee.update({ where: { id: employeeId }, data: { status } });
    if (status !== "ACTIVE") {
      await db.user.updateMany({ where: { employeeId }, data: { active: false } });
    }
    await recordAudit({
      user: g.user, action: status === "ARCHIVED" ? "ARCHIVE" : "STATUS", module: "Employees", recordId: employeeId,
      recordLabel: `${employee.employeeNo} ${employee.firstName} ${employee.lastName}`,
      previousValue: employee.status, newValue: status,
    });
    refresh(employeeId);
    return { ok: true, message: `Employee marked ${status.toLowerCase()}. Historical records preserved.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}
