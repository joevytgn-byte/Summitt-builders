import { format } from "date-fns";
import { getCurrentUser } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";
import { db } from "@/lib/db";
import { attendanceScope, customerScope, jobScope, leadScope } from "@/lib/access";
import { resolveRange } from "@/lib/dates";
import { statusMeta } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Cell = string | number | null | undefined;

function csv(rows: Cell[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell === null || cell === undefined ? "" : String(cell);
          return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    )
    .join("\r\n");
}

function response(name: string, rows: Cell[][]) {
  return new Response(`\uFEFF${csv(rows)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canAccess(user.role, "reports") && !canAccess(user.role, "leads")) {
    return new Response("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const dataset = url.searchParams.get("dataset") ?? "revenue";
  const range = resolveRange({
    range: url.searchParams.get("range") ?? "quarter",
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const stamp = `${format(range.from, "yyyyMMdd")}-${format(range.to, "yyyyMMdd")}`;

  if (dataset === "revenue") {
    const leads = await db.lead.findMany({
      where: { AND: [leadScope(user), { wonAt: { gte: range.from, lte: range.to } }] },
      include: {
        customer: { select: { name: true, company: true, city: true } },
        service: { select: { name: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: { wonAt: "desc" },
    });
    return response(`summit-revenue-${stamp}.csv`, [
      ["Lead", "Won date", "Customer", "Company", "City", "Service", "Project type", "Sales rep", "Contract value", "Source"],
      ...leads.map((l) => [
        l.leadNo,
        l.wonAt ? format(l.wonAt, "yyyy-MM-dd") : "",
        l.customer.name,
        l.customer.company ?? "",
        l.customer.city,
        l.service?.name ?? "",
        l.projectType,
        l.assignedTo ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}` : "",
        Math.round(l.estimatedValue * 100) / 100,
        l.source,
      ]),
      ["", "", "", "", "", "", "", "TOTAL", Math.round(leads.reduce((s, l) => s + l.estimatedValue, 0) * 100) / 100, ""],
    ]);
  }

  if (dataset === "jobs") {
    const jobs = await db.job.findMany({
      where: { AND: [jobScope(user), { scheduledDate: { gte: range.from, lte: range.to } }] },
      include: {
        customer: { select: { name: true, company: true, city: true } },
        project: { select: { projectNo: true } },
        manager: { select: { firstName: true, lastName: true } },
        dispatcher: { select: { firstName: true, lastName: true } },
        assignments: { include: { employee: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: [{ scheduledDate: "asc" }, { startTime: "asc" }],
    });
    return response(`summit-jobs-${stamp}.csv`, [
      ["Job", "Date", "Start", "Duration (h)", "Job type", "Customer", "Company", "City", "Project", "Crew", "Manager", "Dispatcher", "Priority", "Status", "Completed"],
      ...jobs.map((j) => [
        j.jobNo,
        j.scheduledDate ? format(j.scheduledDate, "yyyy-MM-dd") : "",
        j.startTime ?? "",
        Math.round((j.durationMins / 60) * 10) / 10,
        j.jobType,
        j.customer.name,
        j.customer.company ?? "",
        j.customer.city,
        j.project?.projectNo ?? "",
        j.assignments.map((a) => `${a.employee.firstName} ${a.employee.lastName}`).join("; "),
        j.manager ? `${j.manager.firstName} ${j.manager.lastName}` : "",
        j.dispatcher ? `${j.dispatcher.firstName} ${j.dispatcher.lastName}` : "",
        statusMeta(j.priority).label,
        statusMeta(j.status).label,
        j.completedAt ? format(j.completedAt, "yyyy-MM-dd") : "",
      ]),
    ]);
  }

  if (dataset === "customers") {
    const customers = await db.customer.findMany({
      where: customerScope(user),
      include: {
        assignedRep: { select: { firstName: true, lastName: true } },
        _count: { select: { projects: true, jobs: true, leads: true } },
        projects: { select: { contractValue: true } },
      },
      orderBy: { name: "asc" },
    });
    return response(`summit-customers-${stamp}.csv`, [
      ["Customer", "Company", "Phone", "Email", "Address", "City", "State", "ZIP", "Assigned rep", "Leads", "Projects", "Jobs", "Contract value", "Customer since", "Status"],
      ...customers.map((c) => [
        c.name,
        c.company ?? "",
        c.phone,
        c.email ?? "",
        c.serviceAddress,
        c.city,
        c.state,
        c.zip,
        c.assignedRep ? `${c.assignedRep.firstName} ${c.assignedRep.lastName}` : "",
        c._count.leads,
        c._count.projects,
        c._count.jobs,
        Math.round(c.projects.reduce((s, p) => s + p.contractValue, 0) * 100) / 100,
        format(c.createdAt, "yyyy-MM-dd"),
        c.status,
      ]),
    ]);
  }

  if (dataset === "leads") {
    const leads = await db.lead.findMany({
      where: leadScope(user),
      include: {
        customer: { select: { name: true, company: true } },
        service: { select: { name: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return response(`summit-leads-${stamp}.csv`, [
      ["Lead", "Created", "Customer", "Company", "Title", "Service", "Source", "Project type", "Assigned rep", "Estimated value", "Priority", "Status", "Next follow-up", "Won date", "Lost reason"],
      ...leads.map((l) => [
        l.leadNo,
        format(l.createdAt, "yyyy-MM-dd"),
        l.customer.name,
        l.customer.company ?? "",
        l.title,
        l.service?.name ?? "",
        l.source,
        l.projectType,
        l.assignedTo ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}` : "",
        Math.round(l.estimatedValue * 100) / 100,
        statusMeta(l.priority).label,
        statusMeta(l.status).label,
        l.nextFollowUp ? format(l.nextFollowUp, "yyyy-MM-dd") : "",
        l.wonAt ? format(l.wonAt, "yyyy-MM-dd") : "",
        l.lostReason ?? "",
      ]),
    ]);
  }

  if (dataset === "attendance") {
    const records = await db.attendance.findMany({
      where: { AND: [attendanceScope(user), { date: { gte: range.from, lte: range.to } }] },
      include: {
        employee: {
          select: { firstName: true, lastName: true, position: true, hourlyRate: true, department: { select: { name: true } } },
        },
      },
      orderBy: [{ date: "asc" }, { employee: { firstName: "asc" } }],
    });
    return response(`summit-attendance-${stamp}.csv`, [
      ["Date", "Employee", "Position", "Department", "Clock in", "Clock out", "Break (min)", "Hours", "Regular", "Overtime", "Late (min)", "Status", "Estimated pay", "Notes"],
      ...records.map((a) => [
        format(a.date, "yyyy-MM-dd"),
        `${a.employee.firstName} ${a.employee.lastName}`,
        a.employee.position,
        a.employee.department?.name ?? "",
        a.clockIn ?? "",
        a.clockOut ?? "",
        a.breakMins,
        a.totalHours.toFixed(2),
        a.regularHours.toFixed(2),
        a.overtimeHours.toFixed(2),
        a.lateMinutes,
        statusMeta(a.status).label,
        Math.round(a.totalHours * a.employee.hourlyRate * 100) / 100,
        a.notes ?? "",
      ]),
    ]);
  }

  return new Response("Unknown dataset", { status: 400 });
}
