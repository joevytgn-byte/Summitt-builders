import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(value: number | null | undefined, opts?: { cents?: boolean; compact?: boolean }) {
  const n = Number(value ?? 0);
  if (opts?.compact && Math.abs(n) >= 1000) {
    // Pin minimumFractionDigits so Node's ICU and browsers agree on "$102K" vs "$102.0K".
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts?.cents ? 2 : 0,
    maximumFractionDigits: opts?.cents ? 2 : 0,
  }).format(n);
}

export function number(value: number | null | undefined, opts?: { decimals?: number }) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: opts?.decimals ?? 0,
    minimumFractionDigits: opts?.decimals ?? 0,
  }).format(Number(value ?? 0));
}

export function percent(value: number | null | undefined, decimals = 0) {
  return `${number(value, { decimals })}%`;
}

export function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

export function fmtDate(value: Date | string | null | undefined, pattern = "MMM d, yyyy") {
  const d = toDate(value);
  return d ? format(d, pattern) : "—";
}

export function fmtDateTime(value: Date | string | null | undefined) {
  return fmtDate(value, "MMM d, yyyy · h:mm a");
}

export function fmtTime(value: Date | string | null | undefined) {
  return fmtDate(value, "h:mm a");
}

export function timeAgo(value: Date | string | null | undefined) {
  const d = toDate(value);
  if (!d) return "—";
  return formatDistanceToNow(d, { addSuffix: true });
}

export function toDateInput(value: Date | string | null | undefined) {
  return fmtDate(value, "yyyy-MM-dd") === "—" ? "" : fmtDate(value, "yyyy-MM-dd");
}

export function toDateTimeInput(value: Date | string | null | undefined) {
  const d = toDate(value);
  return d ? format(d, "yyyy-MM-dd'T'HH:mm") : "";
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function titleCase(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function humanize(value: string | null | undefined) {
  return titleCase(value);
}

export function firstName(name: string | null | undefined) {
  return name?.split(" ")[0] ?? "";
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function parseNumber(value: string | null | undefined, fallback = 0) {
  const n = Number(String(value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

/* ----------------------------- Status presentation ---------------------------- */

export type Tone = "green" | "amber" | "red" | "blue" | "slate" | "violet" | "orange" | "cyan" | "teal";

export const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  // leads
  NEW: { label: "New Lead", tone: "blue" },
  CONTACTED: { label: "Contacted", tone: "cyan" },
  QUALIFIED: { label: "Qualified", tone: "violet" },
  SITE_VISIT: { label: "Site Visit", tone: "amber" },
  ESTIMATE: { label: "Estimate / Proposal", tone: "orange" },
  NEGOTIATION: { label: "Negotiation", tone: "orange" },
  WON: { label: "Won", tone: "green" },
  LOST: { label: "Lost", tone: "red" },
  // requests
  SITE_VISIT_SCHEDULED: { label: "Site Visit Scheduled", tone: "amber" },
  ESTIMATE_PENDING: { label: "Estimate Pending", tone: "orange" },
  IN_PROGRESS: { label: "In Progress", tone: "orange" },
  COMPLETED: { label: "Completed", tone: "green" },
  CLOSED: { label: "Closed", tone: "slate" },
  CANCELLED: { label: "Cancelled", tone: "red" },
  // estimates
  DRAFT: { label: "Draft", tone: "slate" },
  SENT: { label: "Sent", tone: "blue" },
  VIEWED: { label: "Viewed", tone: "cyan" },
  ACCEPTED: { label: "Accepted", tone: "green" },
  REJECTED: { label: "Rejected", tone: "red" },
  EXPIRED: { label: "Expired", tone: "slate" },
  REVISED: { label: "Revised", tone: "violet" },
  // projects / jobs
  PENDING: { label: "Pending", tone: "slate" },
  SCHEDULED: { label: "Scheduled", tone: "blue" },
  ACTIVE: { label: "Active", tone: "green" },
  ON_HOLD: { label: "On Hold", tone: "amber" },
  DELAYED: { label: "Delayed", tone: "red" },
  UNSCHEDULED: { label: "Unscheduled", tone: "slate" },
  DISPATCHED: { label: "Dispatched", tone: "blue" },
  EN_ROUTE: { label: "En Route", tone: "cyan" },
  RESCHEDULED: { label: "Rescheduled", tone: "amber" },
  // people
  PRESENT: { label: "Present", tone: "green" },
  LATE: { label: "Late", tone: "amber" },
  ABSENT: { label: "Absent", tone: "red" },
  LEAVE: { label: "Leave", tone: "violet" },
  REMOTE: { label: "Remote", tone: "cyan" },
  HOLIDAY: { label: "Holiday", tone: "blue" },
  INACTIVE: { label: "Inactive", tone: "slate" },
  ARCHIVED: { label: "Archived", tone: "slate" },
  // priorities
  LOW: { label: "Low", tone: "slate" },
  MEDIUM: { label: "Medium", tone: "blue" },
  HIGH: { label: "High", tone: "orange" },
  CRITICAL: { label: "Critical", tone: "red" },
  NORMAL: { label: "Normal", tone: "blue" },
  URGENT: { label: "Urgent", tone: "orange" },
  EMERGENCY: { label: "Emergency", tone: "red" },
  // calls
  CONNECTED: { label: "Connected", tone: "green" },
  VOICEMAIL: { label: "Voicemail", tone: "amber" },
  NO_ANSWER: { label: "No Answer", tone: "slate" },
  CALLBACK: { label: "Callback", tone: "blue" },
  BUSY: { label: "Busy", tone: "orange" },
  // follow-up
  DONE: { label: "Done", tone: "green" },
  // roles
  SUPER_ADMIN: { label: "Super Admin", tone: "orange" },
  ADMIN: { label: "Admin", tone: "violet" },
  SALES_MANAGER: { label: "Sales Manager", tone: "blue" },
  SALES_REP: { label: "Sales Rep", tone: "cyan" },
  PROJECT_MANAGER: { label: "Project Manager", tone: "teal" },
  DISPATCHER: { label: "Dispatcher", tone: "amber" },
  FIELD: { label: "Field Crew", tone: "green" },
  // sources
  WEBSITE: { label: "Website", tone: "blue" },
  PHONE: { label: "Phone", tone: "cyan" },
  EMAIL: { label: "Email", tone: "violet" },
  REFERRAL: { label: "Referral", tone: "green" },
  MANUAL: { label: "Manual Entry", tone: "slate" },
  COMMERCIAL: { label: "Commercial", tone: "orange" },
  OTHER: { label: "Other", tone: "slate" },
};

export function statusMeta(value: string | null | undefined) {
  if (!value) return { label: "—", tone: "slate" as Tone };
  return STATUS_META[value] ?? { label: titleCase(value), tone: "slate" as Tone };
}

export const LEAD_STAGES = ["NEW", "CONTACTED", "QUALIFIED", "SITE_VISIT", "ESTIMATE", "NEGOTIATION", "WON", "LOST"] as const;
export const REQUEST_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "SITE_VISIT_SCHEDULED", "ESTIMATE_PENDING", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"] as const;
export const ESTIMATE_STATUSES = ["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED", "REVISED"] as const;
export const PROJECT_STATUSES = ["PENDING", "SCHEDULED", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED", "CANCELLED", "CLOSED"] as const;
export const JOB_STATUSES = ["UNSCHEDULED", "SCHEDULED", "DISPATCHED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED", "RESCHEDULED"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const URGENCIES = ["NORMAL", "URGENT", "EMERGENCY"] as const;
export const LEAD_SOURCES = ["Website", "Phone", "Email", "Referral", "Commercial", "Instagram", "Other"] as const;
export const CALL_OUTCOMES = ["CONNECTED", "VOICEMAIL", "NO_ANSWER", "CALLBACK", "BUSY"] as const;

export const CHART_COLORS = ["#f26a1b", "#1f2937", "#0d9488", "#eab308", "#6366f1", "#ec4899", "#64748b", "#22c55e"];
