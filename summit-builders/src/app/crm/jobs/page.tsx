import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { addDays, format, startOfWeek } from "date-fns";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock, Plus, Truck, Users } from "lucide-react";
import { requireModule, jobScope } from "@/lib/access";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/options";
import { JOB_STATUSES, PRIORITIES, fmtDate, number, statusMeta } from "@/lib/utils";
import { resolveRange } from "@/lib/dates";
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { FilterBar, ViewToggle } from "@/components/filters";
import { Pagination, SortTh } from "@/components/table";
import { ActionModal } from "@/components/action-form";
import { DispatchBoard } from "@/components/dispatch-board";
import { createJob } from "@/app/actions/jobs";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("jobs");
  const params = await searchParams;
  const str = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const q = str("q");
  const status = str("status");
  const priority = str("priority");
  const projectFilter = str("project");
  const sort = str("sort") || "date";
  const dir = (str("dir") || "asc") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(str("page")) || 1);
  const resolved = str("range") ? resolveRange({ range: str("range"), from: str("from"), to: str("to") }) : null;
  const view = str("view") === "table" ? "table" : "board";

  const weekStart = startOfWeek(new Date(str("week") || new Date()), { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const key = format(d, "yyyy-MM-dd");
    return {
      key,
      label: format(d, "EEE"),
      sub: format(d, "d"),
      today: key === format(new Date(), "yyyy-MM-dd"),
    };
  });

  const where: Prisma.JobWhereInput = {
    AND: [
      jobScope(user),
      status ? { status } : {},
      priority ? { priority } : {},
      projectFilter ? { projectId: projectFilter } : {},
      resolved ? { scheduledDate: { gte: resolved.from, lte: resolved.to } } : {},
      q
        ? {
            OR: [
              { jobNo: { contains: q } },
              { jobType: { contains: q } },
              { address: { contains: q } },
              { customer: { name: { contains: q } } },
              { customer: { company: { contains: q } } },
              { project: { name: { contains: q } } },
            ],
          }
        : {},
    ],
  };

  const orderBy: Prisma.JobOrderByWithRelationInput =
    sort === "jobNo" ? { jobNo: dir }
    : sort === "status" ? { status: dir }
    : sort === "priority" ? { priority: dir }
    : sort === "customer" ? { customer: { name: dir } }
    : { scheduledDate: dir };

  const [jobs, total, options, all, boardJobs, summary] = await Promise.all([
    db.job.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, company: true, city: true } },
        project: { select: { id: true, projectNo: true, name: true } },
        assignments: { include: { employee: { select: { id: true, firstName: true, lastName: true, avatarColor: true } } } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.job.count({ where }),
    getFormOptions(),
    db.job.findMany({ where: jobScope(user), select: { status: true, scheduledDate: true, startTime: true } }),
    db.job.findMany({
      where: {
        AND: [
          jobScope(user),
          projectFilter ? { projectId: projectFilter } : {},
          { OR: [{ scheduledDate: { gte: weekStart, lt: weekEnd } }, { scheduledDate: null }] },
        ],
      },
      include: {
        customer: { select: { name: true, company: true } },
        assignments: { include: { employee: { select: { firstName: true, lastName: true, avatarColor: true } } } },
      },
      orderBy: [{ scheduledDate: "asc" }, { startTime: "asc" }],
      take: 200,
    }),
    db.job.groupBy({ by: ["status"], where: jobScope(user), _count: true }),
  ]);

  const countFor = (key: string) => summary.find((s) => s.status === key)?._count ?? 0;
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayCount = all.filter((j) => j.scheduledDate && format(j.scheduledDate, "yyyy-MM-dd") === todayKey).length;
  const unscheduled = all.filter((j) => !j.scheduledDate).length;
  const inProgress = all.filter((j) => ["DISPATCHED", "EN_ROUTE", "IN_PROGRESS"].includes(j.status)).length;
  const conflicts = await db.job.findMany({
    where: {
      AND: [
        jobScope(user),
        { scheduledDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        { status: { notIn: ["COMPLETED", "CANCELLED"] } },
      ],
    },
    select: { id: true, scheduledDate: true, startTime: true, durationMins: true, assignments: { select: { employeeId: true } } },
  });
  let conflictCount = 0;
  for (let i = 0; i < conflicts.length; i++) {
    const a = conflicts[i];
    if (!a.startTime || !a.scheduledDate) continue;
    const aStart = Number(a.startTime.slice(0, 2)) * 60 + Number(a.startTime.slice(3, 5));
    for (let j = i + 1; j < conflicts.length; j++) {
      const b = conflicts[j];
      if (!b.startTime || !b.scheduledDate) continue;
      if (format(a.scheduledDate, "yyyy-MM-dd") !== format(b.scheduledDate, "yyyy-MM-dd")) continue;
      const bStart = Number(b.startTime.slice(0, 2)) * 60 + Number(b.startTime.slice(3, 5));
      const overlap = aStart < bStart + b.durationMins && bStart < aStart + a.durationMins;
      const shared = a.assignments.some((x) => b.assignments.some((y) => y.employeeId === x.employeeId));
      if (overlap && shared) conflictCount++;
    }
  }

  const filterDefs = [
    { key: "status", label: "All statuses", options: JOB_STATUSES.map((s) => ({ value: s, label: statusMeta(s).label })), width: "150px" },
    { key: "priority", label: "All priorities", options: PRIORITIES.map((p) => ({ value: p, label: statusMeta(p).label })), width: "140px" },
    { key: "project", label: "All projects", options: options.projects.map((p) => ({ value: p.id, label: `${p.projectNo} · ${p.name}` })), width: "200px" },
  ];

  const newJob = (
    <ActionModal
      trigger={<button className="btn btn-primary"><Plus size={15} /> New job</button>}
      title="Create a job"
      subtitle="Jobs can be scheduled now or dropped onto the dispatch board later."
      size="lg"
      action={createJob}
      submitLabel="Create job"
      successRedirect="/crm/jobs"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label className="label" htmlFor="customerId">Customer<span className="req">*</span></label>
          <select id="customerId" name="customerId" className="select" required defaultValue="">
            <option value="" disabled>Select a customer…</option>
            {options.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="projectId">Project</label>
          <select id="projectId" name="projectId" className="select" defaultValue="">
            <option value="">No project</option>
            {options.projects.map((p) => <option key={p.id} value={p.id}>{p.projectNo} · {p.name}</option>)}
          </select>
        </div>
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="jobType">Job type<span className="req">*</span></label>
          <input id="jobType" name="jobType" className="input" required placeholder="e.g. Roof tear-off & dry-in" />
        </div>
        <div className="field"><label className="label" htmlFor="scheduledDate">Date</label><input id="scheduledDate" name="scheduledDate" type="date" className="input" defaultValue={format(new Date(), "yyyy-MM-dd")} /></div>
        <div className="field"><label className="label" htmlFor="startTime">Start time</label><input id="startTime" name="startTime" type="time" className="input" defaultValue="08:00" /></div>
        <div className="field"><label className="label" htmlFor="durationMins">Duration (min)</label><input id="durationMins" name="durationMins" className="input" inputMode="numeric" defaultValue="240" /></div>
        <div className="field">
          <label className="label" htmlFor="priority">Priority</label>
          <select id="priority" name="priority" className="select" defaultValue="MEDIUM">
            {PRIORITIES.map((p) => <option key={p} value={p}>{statusMeta(p).label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="dispatcherId">Dispatcher</label>
          <select id="dispatcherId" name="dispatcherId" className="select" defaultValue={user.employeeId ?? ""}>
            <option value="">Unassigned</option>
            {options.dispatchers.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="managerId">Manager</label>
          <select id="managerId" name="managerId" className="select" defaultValue="">
            <option value="">Unassigned</option>
            {options.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="field sm:col-span-2">
          <label className="label">Crew</label>
          <div className="grid max-h-[150px] grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-line p-2.5">
            {options.employees.map((e) => (
              <label key={e.id} className="check-row text-[11.5px]"><input type="checkbox" name="crewIds" value={e.id} className="checkbox" /> {e.name}</label>
            ))}
          </div>
          <div className="field-hint">Double-booking is blocked when a crew member is already on another job at that time.</div>
        </div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="address">Job site address</label><input id="address" name="address" className="input" placeholder="Defaults to the customer address" /></div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="notes">Notes for the crew</label><textarea id="notes" name="notes" className="textarea" rows={2} /></div>
      </div>
    </ActionModal>
  );

  return (
    <>
      <PageHeader
        eyebrow="Dispatch"
        title="Jobs & dispatch"
        subtitle="Schedule crews, spot conflicts, and keep every job moving from the board or the full list."
        actions={newJob}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Jobs today" value={number(todayCount)} foot={<span>{inProgress} in progress</span>} icon={<Truck size={16} />} />
        <StatCard label="Unscheduled" value={number(unscheduled)} foot={<span>need a date</span>} icon={<CalendarDays size={16} />} />
        <StatCard label="Scheduled this week" value={number(boardJobs.filter((j) => j.scheduledDate).length)} foot={<span>{format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}</span>} icon={<Clock size={16} />} />
        <StatCard label="Crew conflicts" value={number(conflictCount)} foot={<span className={conflictCount ? "text-amber-600" : ""}>{conflictCount ? "review the board" : "no overlaps detected"}</span>} icon={conflictCount ? <AlertTriangle size={16} /> : <Users size={16} />} href="/crm/jobs?view=table" />
      </div>

      <div className="card overflow-hidden">
        <FilterBar placeholder="Search job no, type, customer, address…" filters={filterDefs} showRange>
          <ViewToggle boardLabel="Dispatch board" tableLabel="Job list" />
        </FilterBar>

        {view === "board" ? (
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-[11.5px] font-semibold text-ink2">
                Week of {format(weekStart, "MMM d, yyyy")}
              </div>
              <div className="flex items-center gap-1">
                <Link href={`/crm/jobs?week=${format(addDays(weekStart, -7), "yyyy-MM-dd")}`} className="btn btn-ghost btn-sm" aria-label="Previous week"><ChevronLeft size={14} /></Link>
                <Link href="/crm/jobs" className="btn btn-outline btn-sm">This week</Link>
                <Link href={`/crm/jobs?week=${format(addDays(weekStart, 7), "yyyy-MM-dd")}`} className="btn btn-ghost btn-sm" aria-label="Next week"><ChevronRight size={14} /></Link>
              </div>
            </div>
            <DispatchBoard
              days={days}
              canSchedule={user.role !== "FIELD"}
              jobs={boardJobs.map((j) => ({
                id: j.id,
                jobNo: j.jobNo,
                jobType: j.jobType,
                status: j.status,
                priority: j.priority,
                startTime: j.startTime,
                durationMins: j.durationMins,
                dateKey: j.scheduledDate ? format(j.scheduledDate, "yyyy-MM-dd") : null,
                customer: j.customer.company ?? j.customer.name,
                address: j.address,
                crew: j.assignments.map((a) => ({ name: `${a.employee.firstName} ${a.employee.lastName}`, color: a.employee.avatarColor })),
              }))}
            />
            {boardJobs.length === 0 && (
              <div className="mt-3"><EmptyState icon={<Truck />} title="No jobs on the board" description="Create a job or move one into this week." /></div>
            )}
          </div>
        ) : total === 0 ? (
          <EmptyState icon={<Truck />} title="No jobs found" description="Adjust the filters or schedule a new job." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <SortTh label="Job" column="jobNo" pathname="/crm/jobs" params={params} />
                    <SortTh label="Customer" column="customer" pathname="/crm/jobs" params={params} />
                    <SortTh label="Scheduled" column="date" pathname="/crm/jobs" params={params} />
                    <th>Crew</th>
                    <SortTh label="Priority" column="priority" pathname="/crm/jobs" params={params} />
                    <SortTh label="Status" column="status" pathname="/crm/jobs" params={params} />
                    <th>Project</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} data-clickable="true">
                      <td>
                        <Link href={`/crm/jobs/${j.id}`} className="cell-strong hover:text-brand">{j.jobType}</Link>
                        <div className="cell-sub mono">{j.jobNo}{j.address ? ` · ${j.address}` : ""}</div>
                      </td>
                      <td>
                        <Link href={`/crm/customers/${j.customer.id}`} className="hover:text-brand">{j.customer.company ?? j.customer.name}</Link>
                        <div className="cell-sub">{j.customer.city}</div>
                      </td>
                      <td className="nowrap text-[11.5px]">
                        {j.scheduledDate ? (
                          <>
                            <div className="font-medium text-ink">{fmtDate(j.scheduledDate, "EEE, MMM d")}</div>
                            <div className="cell-sub">{j.startTime ?? "TBD"} · {Math.round(j.durationMins / 60)}h</div>
                          </>
                        ) : <span className="text-amber-600">Unscheduled</span>}
                      </td>
                      <td>
                        {j.assignments.length ? (
                          <div className="avatar-stack">
                            {j.assignments.slice(0, 3).map((a) => <Avatar key={a.id} name={`${a.employee.firstName} ${a.employee.lastName}`} color={a.employee.avatarColor} size="sm" />)}
                            {j.assignments.length > 3 && <span className="text-[10px] text-muted">+{j.assignments.length - 3}</span>}
                          </div>
                        ) : <span className="text-[10.5px] text-amber-600">No crew</span>}
                      </td>
                      <td><Badge value={j.priority} /></td>
                      <td><Badge value={j.status} /></td>
                      <td className="text-[11.5px]">
                        {j.project ? <Link href={`/crm/projects/${j.project.id}`} className="text-brand hover:underline">{j.project.projectNo}</Link> : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} pathname="/crm/jobs" params={params} />
          </>
        )}
      </div>
    </>
  );
}
