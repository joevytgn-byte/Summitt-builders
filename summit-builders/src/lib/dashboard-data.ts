import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { attendanceScope, callScope, customerScope, estimateScope, jobScope, leadScope } from "@/lib/access";
import { bucketKey, makeBuckets, previousRange, type Range } from "@/lib/dates";
import { startOfDay, endOfDay, startOfMonth, subMonths, format } from "date-fns";
import { pct } from "@/lib/utils";

export type Delta = { value: number; up: boolean; label: string };

function delta(current: number, previous: number): Delta {
  if (!previous) return { value: current > 0 ? 100 : 0, up: current >= 0, label: "vs previous period" };
  const diff = ((current - previous) / previous) * 100;
  return { value: Math.abs(Math.round(diff * 10) / 10), up: diff >= 0, label: "vs previous period" };
}

export async function getDashboardData(user: SessionUser, range: Range) {
  const { from, to } = range;
  const prev = previousRange(range);
  const todayFrom = startOfDay(new Date());
  const todayTo = endOfDay(new Date());
  const isRep = user.role === "SALES_REP";
  const isField = user.role === "FIELD";

  const repCustomerIds = isRep
    ? (await db.customer.findMany({ where: customerScope(user), select: { id: true } })).map((c) => c.id)
    : null;
  const projectScope = repCustomerIds ? { customerId: { in: repCustomerIds } } : {};
  const jobsScope = isField ? jobScope(user) : repCustomerIds ? { customerId: { in: repCustomerIds } } : {};
  const leadsBase = leadScope(user);
  const estimatesBase = estimateScope(user);
  const callsBase = callScope(user);
  const attBase = attendanceScope(user);

  const [
    wonLeads, prevWon, lostLeads, newLeads, openLeads, estimatesSent, estimatesAccepted,
    calls, prevCalls, attendance, projects, todayJobs, upcomingJobs, allJobs, customers,
    recentRequests, followUps, monthlyWon, prevLeads,
  ] = await Promise.all([
    db.lead.findMany({
      where: { AND: [leadsBase, { wonAt: { gte: from, lte: to } }] },
      select: { estimatedValue: true, serviceId: true, assignedToId: true, wonAt: true, customerId: true, service: { select: { name: true } } },
    }),
    db.lead.aggregate({ where: { AND: [leadsBase, { wonAt: { gte: prev.from, lte: prev.to } }] }, _sum: { estimatedValue: true }, _count: true }),
    db.lead.count({ where: { AND: [leadsBase, { lostAt: { gte: from, lte: to } }] } }),
    db.lead.findMany({ where: { AND: [leadsBase, { createdAt: { gte: from, lte: to } }] }, select: { id: true, status: true, priority: true, estimatedValue: true } }),
    db.lead.findMany({ where: { AND: [leadsBase, { status: { notIn: ["WON", "LOST"] } }] }, select: { id: true, estimatedValue: true, status: true } }),
    db.estimate.count({ where: { AND: [estimatesBase, { sentAt: { gte: from, lte: to } }] } }),
    db.estimate.count({ where: { AND: [estimatesBase, { status: "ACCEPTED", decidedAt: { gte: from, lte: to } }] } }),
    db.call.findMany({
      where: { AND: [callsBase, { startedAt: { gte: from, lte: to } }] },
      select: { durationSec: true, connected: true, employeeId: true, startedAt: true, outcome: true, employee: { select: { firstName: true, lastName: true } } },
    }),
    db.call.aggregate({ where: { AND: [callsBase, { startedAt: { gte: prev.from, lte: prev.to } }] }, _count: true, _sum: { durationSec: true } }),
    db.attendance.findMany({
      where: { AND: [attBase, { date: { gte: from, lte: to } }] },
      select: { status: true, totalHours: true, overtimeHours: true, lateMinutes: true, date: true, employee: { select: { firstName: true, lastName: true } } },
    }),
    db.project.findMany({ where: projectScope, select: { id: true, status: true, contractValue: true, progress: true, expectedEnd: true } }),
    db.job.findMany({
      where: { AND: [jobsScope, { scheduledDate: { gte: todayFrom, lte: todayTo } }] },
      include: {
        customer: { select: { name: true, company: true } }, project: { select: { name: true } },
        assignments: { include: { employee: { select: { firstName: true, lastName: true, avatarColor: true } } } },
      },
      orderBy: { startTime: "asc" },
    }),
    db.job.findMany({ where: { AND: [jobsScope, { scheduledDate: { gte: todayFrom } }] }, select: { id: true, status: true } }),
    db.job.findMany({ where: jobsScope, select: { id: true, status: true, scheduledDate: true, assignments: { select: { id: true } } } }),
    db.customer.findMany({
      where: customerScope(user),
      select: {
        id: true, createdAt: true,
        _count: { select: { projects: true, jobs: true, leads: { where: { status: "WON" } } } },
      },
    }),
    db.serviceRequest.findMany({
      where: isRep ? { OR: [{ assignedToId: user.employeeId ?? "__none__" }, { lead: { assignedToId: user.employeeId ?? "__none__" } }] } : {},
      include: { customer: { select: { name: true, company: true } }, service: { select: { name: true } } },
      orderBy: { createdAt: "desc" }, take: 5,
    }),
    db.followUp.findMany({
      where: {
        status: "PENDING",
        ...(isRep ? { assignedToId: user.employeeId ?? "__none__" } : {}),
        dueAt: { lte: endOfDay(new Date(Date.now() + 3 * 86_400_000)) },
      },
      include: { lead: { select: { leadNo: true, title: true } }, customer: { select: { name: true } }, assignedTo: { select: { firstName: true, lastName: true } } },
      orderBy: { dueAt: "asc" }, take: 6,
    }),
    db.lead.findMany({
      where: { AND: [leadsBase, { wonAt: { gte: startOfMonth(subMonths(new Date(), 5)) } }] },
      select: { wonAt: true, estimatedValue: true },
    }),
    db.lead.count({ where: { AND: [leadsBase, { createdAt: { gte: prev.from, lte: prev.to } }] } }),
  ]);

  const revenue = wonLeads.reduce((sum, l) => sum + l.estimatedValue, 0);
  const prevRevenue = prevWon._sum.estimatedValue ?? 0;
  const won = wonLeads.length;
  const lost = lostLeads;
  const conversion = won + lost > 0 ? Math.round((won / (won + lost)) * 1000) / 10 : 0;
  const avgDeal = won ? revenue / won : 0;
  const pipelineValue = openLeads.reduce((s, l) => s + l.estimatedValue, 0);
  const qualified = newLeads.filter((l) => ["QUALIFIED", "SITE_VISIT", "ESTIMATE", "NEGOTIATION", "WON"].includes(l.status)).length;

  const callsTotal = calls.length;
  const connected = calls.filter((c) => c.connected).length;
  const missed = callsTotal - connected;
  const callSeconds = calls.reduce((s, c) => s + c.durationSec, 0);
  const prevSeconds = prevCalls._sum.durationSec ?? 0;
  const avgSeconds = callsTotal ? Math.round(callSeconds / callsTotal) : 0;

  const presentStatuses = ["PRESENT", "LATE", "REMOTE"];
  const present = attendance.filter((a) => presentStatuses.includes(a.status)).length;
  const absent = attendance.filter((a) => a.status === "ABSENT").length;
  const onLeave = attendance.filter((a) => a.status === "LEAVE").length;
  const late = attendance.filter((a) => a.status === "LATE").length;
  const hoursWorked = attendance.reduce((s, a) => s + a.totalHours, 0);
  const overtime = attendance.reduce((s, a) => s + a.overtimeHours, 0);
  const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 1000) / 10 : 0;

  const jobsToday = todayJobs.length;
  const scheduled = upcomingJobs.filter((j) => j.status === "SCHEDULED" || j.status === "DISPATCHED").length;
  const inProgress = allJobs.filter((j) => ["IN_PROGRESS", "EN_ROUTE"].includes(j.status)).length;
  const completed = allJobs.filter((j) => j.status === "COMPLETED").length;
  const unassigned = allJobs.filter((j) => j.assignments.length === 0 && !["COMPLETED", "CANCELLED"].includes(j.status)).length;
  const rescheduled = allJobs.filter((j) => j.status === "RESCHEDULED").length;
  const delayedProjects = projects.filter((p) => p.status === "DELAYED").length;

  const customerTotal = customers.length;
  const newCustomers = customers.filter((c) => c.createdAt >= from && c.createdAt <= to).length;
  const activeCustomers = customers.filter((c) => c._count.projects > 0 || c._count.jobs > 0).length;
  const repeatCustomers = customers.filter((c) => c._count.projects > 1 || c._count.leads > 1).length;

  /* charts */
  const { buckets, granularity } = makeBuckets(range);
  const revenueTrend = buckets.map((b) => ({ label: b.label, revenue: 0, deals: 0 }));
  for (const l of wonLeads) {
    if (!l.wonAt) continue;
    const key = bucketKey(l.wonAt, granularity);
    const idx = buckets.findIndex((b) => b.key === key);
    if (idx >= 0) {
      (revenueTrend[idx].revenue as number);
      revenueTrend[idx].revenue = Number(revenueTrend[idx].revenue) + l.estimatedValue;
      revenueTrend[idx].deals = Number(revenueTrend[idx].deals) + 1;
    }
  }
  const leadFlow = buckets.map((b) => ({ label: b.label, leads: 0 }));
  for (const l of newLeads) {
    // created date isn't selected; re-derive by status is not possible — use index based on createdAt below
    void l;
  }
  const newLeadDates = await db.lead.findMany({
    where: { AND: [leadsBase, { createdAt: { gte: from, lte: to } }] },
    select: { createdAt: true },
  });
  for (const l of newLeadDates) {
    const idx = buckets.findIndex((b) => b.key === bucketKey(l.createdAt, granularity));
    if (idx >= 0) (leadFlow[idx].leads as number), (leadFlow[idx].leads = Number(leadFlow[idx].leads) + 1);
  }

  const stageCounts = ["NEW", "CONTACTED", "QUALIFIED", "SITE_VISIT", "ESTIMATE", "NEGOTIATION", "WON", "LOST"].map((stage) => ({
    name: stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toLowerCase()),
    value: newLeads.filter((l) => l.status === stage).length,
  })).filter((s) => s.value > 0);

  const byService = new Map<string, number>();
  for (const l of wonLeads) byService.set(l.service?.name ?? "Other", (byService.get(l.service?.name ?? "Other") ?? 0) + l.estimatedValue);
  const serviceRevenue = [...byService.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const employeeSales = new Map<string, { name: string; value: number }>();
  for (const l of wonLeads) {
    const empId = l.assignedToId ?? "unassigned";
    const existing = employeeSales.get(empId);
    if (existing) existing.value += l.estimatedValue;
    else employeeSales.set(empId, { name: "", value: l.estimatedValue });
  }
  const repNames = await db.employee.findMany({ where: { id: { in: [...employeeSales.keys()].filter((id) => id !== "unassigned") } }, select: { id: true, firstName: true, lastName: true } });
  const salesByEmployee = [...employeeSales.entries()].map(([id, v]) => ({
    name: repNames.find((r) => r.id === id) ? `${repNames.find((r) => r.id === id)!.firstName} ${repNames.find((r) => r.id === id)!.lastName}` : "Unassigned",
    value: v.value,
  })).sort((a, b) => b.value - a.value);

  const callsByEmployeeMap = new Map<string, { name: string; calls: number; hours: number; connected: number }>();
  for (const c of calls) {
    const name = `${c.employee.firstName} ${c.employee.lastName}`;
    const row = callsByEmployeeMap.get(c.employeeId) ?? { name, calls: 0, hours: 0, connected: 0 };
    row.calls += 1;
    row.hours += c.durationSec / 3600;
    if (c.connected) row.connected += 1;
    callsByEmployeeMap.set(c.employeeId, row);
  }
  const callsByEmployee = [...callsByEmployeeMap.values()].sort((a, b) => b.calls - a.calls);
  const callChart = callsByEmployee.map((c) => ({ name: c.name.split(" ")[0], value: c.calls }));

  const attendanceChart = buckets.map((b) => ({ label: b.label, hours: 0, late: 0 }));
  for (const a of attendance) {
    const idx = buckets.findIndex((b) => b.key === bucketKey(a.date, granularity));
    if (idx >= 0) {
      attendanceChart[idx].hours = Number(attendanceChart[idx].hours) + a.totalHours;
      if (a.status === "LATE") attendanceChart[idx].late = Number(attendanceChart[idx].late) + 1;
    }
  }

  const projectStatus = ["PENDING", "SCHEDULED", "ACTIVE", "ON_HOLD", "DELAYED", "COMPLETED", "CANCELLED", "CLOSED"].map((status) => ({
    name: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toLowerCase()),
    value: projects.filter((p) => p.status === status).length,
  })).filter((s) => s.value > 0);

  const jobsByStatus = ["UNSCHEDULED", "SCHEDULED", "DISPATCHED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED", "RESCHEDULED"].map((status) => ({
    name: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toLowerCase()),
    value: allJobs.filter((j) => j.status === status).length,
  })).filter((s) => s.value > 0);

  const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
    const d = startOfMonth(subMonths(new Date(), 5 - i));
    return { label: format(d, "MMM yy"), revenue: 0, month: format(d, "yyyy-MM") };
  });
  for (const l of monthlyWon) {
    if (!l.wonAt) continue;
    const key = format(l.wonAt, "yyyy-MM");
    const row = monthlyRevenue.find((m) => m.month === key);
    if (row) row.revenue += l.estimatedValue;
  }

  const attendanceBreakdown = [
    { name: "Present", value: attendance.filter((a) => a.status === "PRESENT").length },
    { name: "Late", value: late },
    { name: "Remote", value: attendance.filter((a) => a.status === "REMOTE").length },
    { name: "Absent", value: absent },
    { name: "Leave", value: onLeave },
  ].filter((d) => d.value > 0);

  return {
    range,
    sales: {
      revenue, prevRevenue, won, lost, conversion, avgDeal, pipelineValue,
      newLeads: newLeads.length, prevLeads, qualified, openOpportunities: openLeads.length,
      estimatesSent, estimatesAccepted,
      deltas: {
        revenue: delta(revenue, prevRevenue),
        leads: delta(newLeads.length, prevLeads),
        calls: delta(callsTotal, prevCalls._count),
        hours: delta(callSeconds / 3600, prevSeconds / 3600),
      },
    },
    customers: { total: customerTotal, new: newCustomers, active: activeCustomers, repeat: repeatCustomers },
    projects: {
      total: projects.length,
      active: projects.filter((p) => p.status === "ACTIVE").length,
      scheduled: projects.filter((p) => p.status === "SCHEDULED").length,
      inProgress: projects.filter((p) => ["ACTIVE", "SCHEDULED"].includes(p.status)).length,
      completed: projects.filter((p) => p.status === "COMPLETED").length,
      delayed: delayedProjects,
      cancelled: projects.filter((p) => p.status === "CANCELLED").length,
      onHold: projects.filter((p) => p.status === "ON_HOLD").length,
      pending: projects.filter((p) => p.status === "PENDING").length,
    },
    calls: { total: callsTotal, connected, missed, hours: callSeconds / 3600, avgSeconds, byEmployee: callsByEmployee },
    workforce: {
      attendanceRate, hoursWorked, overtime, late, absent, onLeave, records: attendance.length,
      present,
    },
    dispatch: {
      jobsToday, scheduled, inProgress, completed, unassigned, rescheduled, delayedProjects, todayJobs,
    },
    charts: {
      revenueTrend, leadFlow, stageCounts, serviceRevenue, salesByEmployee, callChart,
      callsByEmployee, attendanceChart, projectStatus, jobsByStatus, monthlyRevenue, attendanceBreakdown,
    },
    attention: {
      unassignedJobs: unassigned,
      delayedProjects,
      newUncontacted: newLeads.filter((l) => l.status === "NEW").length,
      overdueFollowUps: followUps.filter((f) => f.dueAt < todayFrom).length,
      followUps,
    },
    recentRequests,
    generatedAt: new Date(),
    conversionPct: pct(won, won + lost),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
