import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireUser, type SessionUser } from "@/lib/auth";
import { canAccess, type ModuleKey } from "@/lib/permissions";

export { MODULES, canAccess, isManagerial, isAdmin } from "@/lib/permissions";
export type { ModuleKey } from "@/lib/permissions";

export function requireModule(module: ModuleKey) {
  return requireUser().then((user) => {
    if (!canAccess(user.role, module)) redirect("/crm/forbidden");
    return user;
  });
}

export function leadScope(user: SessionUser): Prisma.LeadWhereInput {
  if (user.role === "SALES_REP") {
    return { OR: [{ assignedToId: user.employeeId ?? "__none__" }, { createdById: user.id }] };
  }
  return {};
}

export function requestScope(user: SessionUser): Prisma.ServiceRequestWhereInput {
  if (user.role === "SALES_REP") {
    return {
      OR: [
        { assignedToId: user.employeeId ?? "__none__" },
        { lead: { assignedToId: user.employeeId ?? "__none__" } },
        { lead: { createdById: user.id } },
      ],
    };
  }
  return {};
}

export function customerScope(user: SessionUser): Prisma.CustomerWhereInput {
  if (user.role === "SALES_REP") {
    return {
      OR: [
        { assignedRepId: user.employeeId ?? "__none__" },
        { leads: { some: { assignedToId: user.employeeId ?? "__none__" } } },
      ],
    };
  }
  return {};
}

export function estimateScope(user: SessionUser): Prisma.EstimateWhereInput {
  if (user.role === "SALES_REP") {
    return {
      OR: [
        { createdById: user.id },
        { customer: { assignedRepId: user.employeeId ?? "__none__" } },
      ],
    };
  }
  return {};
}

export function callScope(user: SessionUser): Prisma.CallWhereInput {
  if (user.role === "SALES_REP" || user.role === "FIELD") {
    return { employeeId: user.employeeId ?? "__none__" };
  }
  return {};
}

export function jobScope(user: SessionUser): Prisma.JobWhereInput {
  if (user.role === "FIELD") {
    return { assignments: { some: { employeeId: user.employeeId ?? "__none__" } } };
  }
  return {};
}

export function attendanceScope(user: SessionUser): Prisma.AttendanceWhereInput {
  if (user.role === "FIELD" || user.role === "SALES_REP") {
    return { employeeId: user.employeeId ?? "__none__" };
  }
  return {};
}

export function canEditLead(user: SessionUser, lead: { assignedToId: string | null; createdById: string | null }) {
  if (user.role === "SALES_REP") {
    return lead.assignedToId === user.employeeId || lead.createdById === user.id;
  }
  return canAccess(user.role, "leads");
}

export function canViewSales(user: SessionUser) {
  return ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "SALES_REP"].includes(user.role);
}
