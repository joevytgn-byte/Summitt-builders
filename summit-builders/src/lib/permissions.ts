export type Role = "SUPER_ADMIN" | "ADMIN" | "SALES_MANAGER" | "SALES_REP" | "PROJECT_MANAGER" | "DISPATCHER" | "FIELD";

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin / Management",
  SALES_MANAGER: "Sales Manager",
  SALES_REP: "Sales Representative",
  PROJECT_MANAGER: "Project Manager",
  DISPATCHER: "Dispatcher",
  FIELD: "Field Employee / Crew",
};

export const MODULES = [
  "dashboard", "leads", "requests", "customers", "pipeline", "estimates", "projects", "jobs",
  "calendar", "calls", "employees", "attendance", "performance", "reports", "notifications",
  "website", "users", "settings", "audit", "search",
] as const;

export type ModuleKey = (typeof MODULES)[number];

export const ACCESS: Record<Role, ModuleKey[] | "*"> = {
  SUPER_ADMIN: "*",
  ADMIN: [
    "dashboard", "leads", "requests", "customers", "pipeline", "estimates", "projects", "jobs",
    "calendar", "calls", "employees", "attendance", "performance", "reports", "notifications",
    "website", "settings", "search",
  ],
  SALES_MANAGER: [
    "dashboard", "leads", "requests", "customers", "pipeline", "estimates", "calendar", "calls",
    "performance", "reports", "notifications", "search",
  ],
  SALES_REP: [
    "dashboard", "leads", "requests", "customers", "pipeline", "estimates", "calendar", "calls",
    "notifications", "search",
  ],
  PROJECT_MANAGER: [
    "dashboard", "customers", "projects", "jobs", "calendar", "employees", "attendance",
    "performance", "reports", "notifications", "search",
  ],
  DISPATCHER: [
    "dashboard", "requests", "customers", "projects", "jobs", "calendar", "employees", "attendance",
    "notifications", "search",
  ],
  FIELD: ["dashboard", "jobs", "calendar", "attendance", "notifications", "search"],
};

export function canAccess(role: string, module: ModuleKey) {
  const allowed = ACCESS[role as Role];
  return allowed === "*" || (allowed?.includes(module) ?? false);
}

export function isManagerial(role: string) {
  return ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER"].includes(role);
}

export function isAdmin(role: string) {
  return ["SUPER_ADMIN", "ADMIN"].includes(role);
}
