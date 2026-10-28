import type { ModuleKey } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  module: ModuleKey;
  icon: string;
  badgeKey?: "notifications" | "leads";
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/crm/dashboard", label: "Dashboard", module: "dashboard", icon: "LayoutDashboard" },
      { href: "/crm/leads", label: "Leads", module: "leads", icon: "Target", badgeKey: "leads" },
      { href: "/crm/requests", label: "Service Requests", module: "requests", icon: "Inbox" },
      { href: "/crm/customers", label: "Customers", module: "customers", icon: "Users" },
      { href: "/crm/pipeline", label: "Sales Pipeline", module: "pipeline", icon: "Columns3" },
    ],
  },
  {
    label: "Delivery",
    items: [
      { href: "/crm/estimates", label: "Estimates", module: "estimates", icon: "FileText" },
      { href: "/crm/projects", label: "Projects", module: "projects", icon: "HardHat" },
      { href: "/crm/jobs", label: "Jobs / Dispatch", module: "jobs", icon: "Truck" },
      { href: "/crm/calendar", label: "Calendar", module: "calendar", icon: "CalendarDays" },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/crm/calls", label: "Calls", module: "calls", icon: "Phone" },
      { href: "/crm/employees", label: "Employees", module: "employees", icon: "UserRound" },
      { href: "/crm/attendance", label: "Attendance", module: "attendance", icon: "Clock" },
      { href: "/crm/performance", label: "Performance", module: "performance", icon: "TrendingUp" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/crm/reports", label: "Reports", module: "reports", icon: "BarChart3" },
      { href: "/crm/notifications", label: "Notifications", module: "notifications", icon: "Bell", badgeKey: "notifications" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/crm/admin/website", label: "Website", module: "website", icon: "Globe" },
      { href: "/crm/admin/users", label: "Users & Permissions", module: "users", icon: "ShieldCheck" },
      { href: "/crm/admin/settings", label: "Settings", module: "settings", icon: "Settings" },
      { href: "/crm/admin/audit", label: "Audit Logs", module: "audit", icon: "ScrollText" },
    ],
  },
];
