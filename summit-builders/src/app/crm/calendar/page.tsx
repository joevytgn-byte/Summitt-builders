import Link from "next/link";
import {
  addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Truck, Users } from "lucide-react";
import { requireModule, jobScope } from "@/lib/access";
import { db } from "@/lib/db";
import { fmtDate, number, statusMeta } from "@/lib/utils";
import { Avatar, Badge, PageHeader, StatCard } from "@/components/ui";
import { Segmented } from "@/components/filters";

export const dynamic = "force-dynamic";

const WEEK_OPTS = { weekStartsOn: 1 as const };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("calendar");
  const params = await searchParams;
  const view = params.view === "week" ? "week" : params.view === "agenda" ? "agenda" : "month";
  const anchorParam = typeof params.date === "string" ? params.date : "";
  const anchor = anchorParam ? new Date(`${anchorParam}T12:00:00`) : new Date();
  const anchorDate = Number.isNaN(anchor.getTime()) ? new Date() : anchor;

  const rangeStart = view === "week" ? startOfWeek(anchorDate, WEEK_OPTS) : startOfMonth(anchorDate);
  const rangeEnd = view === "week" ? endOfWeek(anchorDate, WEEK_OPTS) : endOfMonth(anchorDate);
  const gridStart = startOfWeek(rangeStart, WEEK_OPTS);
  const gridEnd = endOfWeek(rangeEnd, WEEK_OPTS);

  const jobs = await db.job.findMany({
    where: {
      AND: [
        jobScope(user),
        { scheduledDate: { gte: gridStart, lte: gridEnd } },
        { status: { not: "CANCELLED" } },
      ],
    },
    include: {
      customer: { select: { id: true, name: true, company: true, city: true } },
      project: { select: { id: true, projectNo: true } },
      assignments: { include: { employee: { select: { firstName: true, lastName: true, avatarColor: true } } } },
    },
    orderBy: [{ scheduledDate: "asc" }, { startTime: "asc" }],
  });

  const days = Array.from({ length: Math.round((gridEnd.getTime() - gridStart.getTime()) / 86_400_000) + 1 }, (_, i) => addDays(gridStart, i));
  const jobsFor = (day: Date) => jobs.filter((j) => j.scheduledDate && format(j.scheduledDate, "yyyy-MM-dd") === format(day, "yyyy-MM-dd"));

  const monthJobs = jobs.filter((j) => j.scheduledDate && isSameMonth(j.scheduledDate, anchorDate));
  const busyDays = new Set(monthJobs.map((j) => format(j.scheduledDate!, "yyyy-MM-dd")));
  const todayJobs = jobsFor(new Date());
  const crewToday = new Set(todayJobs.flatMap((j) => j.assignments.map((a) => a.employeeId)));

  const prev = view === "week" ? addWeeks(anchorDate, -1) : addMonths(anchorDate, -1);
  const next = view === "week" ? addWeeks(anchorDate, 1) : addMonths(anchorDate, 1);
  const anchorKey = format(anchorDate, "yyyy-MM-dd");

  const agendaGroups = days
    .map((day) => ({ day, jobs: jobsFor(day) }))
    .filter((g) => g.jobs.length > 0);

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Calendar"
        subtitle="Jobs, crews and site visits in one schedule. Drag-and-drop dispatch lives on the jobs board."
        actions={
          <Link href="/crm/jobs" className="btn btn-primary"><Plus size={15} /> Schedule a job</Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Jobs this month" value={number(monthJobs.length)} foot={<span>{busyDays.size} active days</span>} icon={<CalendarDays size={16} />} />
        <StatCard label="Jobs today" value={number(todayJobs.length)} foot={<span>{todayJobs.filter((j) => j.status === "COMPLETED").length} completed</span>} icon={<Truck size={16} />} />
        <StatCard label="Crew scheduled today" value={number(crewToday.size)} foot={<span>distinct crew members</span>} icon={<Users size={16} />} />
        <StatCard label="Unscheduled jobs" value={number(await db.job.count({ where: { AND: [jobScope(user), { scheduledDate: null }] } }))} foot={<span>waiting for dispatch</span>} icon={<Clock size={16} />} href="/crm/jobs" />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <Link href={`/crm/calendar?view=${view}&date=${format(prev, "yyyy-MM-dd")}`} className="btn btn-ghost btn-sm" aria-label="Previous period"><ChevronLeft size={15} /></Link>
            <div className="min-w-[170px] text-center">
              <div className="text-[14px] font-[750] tracking-[-0.02em] text-ink">
                {view === "week" ? `${fmtDate(rangeStart, "MMM d")} – ${fmtDate(rangeEnd, "MMM d, yyyy")}` : format(anchorDate, "MMMM yyyy")}
              </div>
              <div className="text-[10px] text-muted">{monthJobs.length} jobs in view</div>
            </div>
            <Link href={`/crm/calendar?view=${view}&date=${format(next, "yyyy-MM-dd")}`} className="btn btn-ghost btn-sm" aria-label="Next period"><ChevronRight size={15} /></Link>
            <Link href={`/crm/calendar?view=${view}&date=${format(new Date(), "yyyy-MM-dd")}`} className="btn btn-outline btn-sm">Today</Link>
          </div>
          <Segmented items={[{ label: "Month", value: "month" }, { label: "Week", value: "week" }, { label: "Agenda", value: "agenda" }]} />
        </div>

        {view === "month" && (
          <div className="p-3">
            <div className="mb-1 grid grid-cols-7 gap-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="px-1 pb-1 text-center text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dayJobs = jobsFor(day);
                const outside = !isSameMonth(day, anchorDate);
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[104px] rounded-lg border p-1.5 ${isToday(day) ? "border-brand/50 bg-brand-soft/40" : outside ? "border-line/60 bg-panel2/40" : "border-line bg-panel2"}`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`text-[10.5px] font-bold ${isToday(day) ? "grid size-5 place-items-center rounded-full bg-brand text-white" : outside ? "text-muted/60" : "text-ink2"}`}>
                        {format(day, "d")}
                      </span>
                      {dayJobs.length > 0 && <span className="text-[9px] font-semibold text-muted">{dayJobs.length}</span>}
                    </div>
                    <div className="flex flex-col gap-1">
                      {dayJobs.slice(0, 3).map((j) => (
                        <Link
                          key={j.id}
                          href={`/crm/jobs/${j.id}`}
                          className="block rounded border border-line bg-panel px-1.5 py-1 hover:border-brand/50"
                          title={`${j.jobType} · ${j.customer.company ?? j.customer.name}`}
                        >
                          <div className="truncate text-[9.5px] font-semibold text-ink">{j.startTime ?? "TBD"} {j.jobType}</div>
                          <div className="truncate text-[8.5px] text-muted">{j.customer.company ?? j.customer.name}</div>
                        </Link>
                      ))}
                      {dayJobs.length > 3 && (
                        <Link href={`/crm/calendar?view=agenda&date=${format(day, "yyyy-MM-dd")}`} className="text-[9px] font-semibold text-brand hover:underline">
                          +{dayJobs.length - 3} more
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "week" && (
          <div className="grid gap-2 p-3 lg:grid-cols-7">
            {Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i)).map((day) => {
              const dayJobs = jobsFor(day);
              return (
                <div key={day.toISOString()} className={`flex min-h-[280px] flex-col rounded-xl border ${isToday(day) ? "border-brand/50 ring-1 ring-brand/20" : "border-line"} bg-panel2`}>
                  <div className={`flex items-center justify-between border-b border-line px-3 py-2 ${isToday(day) ? "bg-brand-soft/50" : ""}`}>
                    <div>
                      <div className={`text-[9.5px] font-bold uppercase tracking-[0.08em] ${isToday(day) ? "text-brand" : "text-muted"}`}>{format(day, "EEE")}</div>
                      <div className="text-[13px] font-bold text-ink">{format(day, "MMM d")}</div>
                    </div>
                    <span className="kanban-count">{dayJobs.length}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-2">
                    {dayJobs.map((j) => (
                      <Link key={j.id} href={`/crm/jobs/${j.id}`} className="rounded-lg border border-line bg-panel p-2 hover:border-brand/50">
                        <div className="flex items-center justify-between gap-1">
                          <span className="mono text-[9px] font-bold text-muted">{j.startTime ?? "TBD"}</span>
                          <Badge value={j.status} plain />
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-[10.5px] font-semibold leading-snug text-ink">{j.jobType}</div>
                        <div className="mt-0.5 truncate text-[9px] text-muted">{j.customer.company ?? j.customer.name}</div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <div className="flex -space-x-1.5">
                            {j.assignments.slice(0, 3).map((a) => <Avatar key={a.id} name={`${a.employee.firstName} ${a.employee.lastName}`} color={a.employee.avatarColor} size="sm" />)}
                          </div>
                          <span className="text-[8.5px] text-muted">{Math.round(j.durationMins / 60)}h</span>
                        </div>
                      </Link>
                    ))}
                    {!dayJobs.length && <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line py-6 text-[10px] text-muted">No jobs</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === "agenda" && (
          <div>
            {agendaGroups.length ? (
              <div className="divide-y divide-line">
                {agendaGroups.map(({ day, jobs: dayJobs }) => (
                  <div key={day.toISOString()} className="flex flex-col gap-2 px-4 py-3 sm:flex-row">
                    <div className={`w-full shrink-0 sm:w-[130px] ${isToday(day) ? "text-brand" : ""}`}>
                      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{format(day, "EEEE")}</div>
                      <div className={`text-[14px] font-bold ${isToday(day) ? "text-brand" : "text-ink"}`}>{format(day, "MMM d, yyyy")}</div>
                      <div className="text-[10px] text-muted">{dayJobs.length} job{dayJobs.length === 1 ? "" : "s"}</div>
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                      {dayJobs.map((j) => (
                        <Link key={j.id} href={`/crm/jobs/${j.id}`} className="flex items-center gap-3 rounded-lg border border-line bg-panel2 px-3 py-2 hover:border-brand/50">
                          <span className="mono w-[46px] shrink-0 text-[11px] font-bold text-ink">{j.startTime ?? "TBD"}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12px] font-semibold text-ink">{j.jobType}</span>
                            <span className="flex items-center gap-1 truncate text-[10px] text-muted"><MapPin size={9} /> {j.customer.company ?? j.customer.name} · {j.address}</span>
                          </span>
                          <span className="hidden items-center gap-1 text-[10px] text-muted sm:flex"><Clock size={10} /> {Math.round(j.durationMins / 60)}h</span>
                          <Badge value={j.status} />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-12 text-center text-[12px] text-muted">No jobs scheduled in this period.</div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10.5px] text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand" /> Today</span>
        <span>{statusMeta("SCHEDULED").label} jobs are conflict-checked when moved on the dispatch board.</span>
        <span>Anchor date: {fmtDate(anchorKey)}</span>
      </div>
    </>
  );
}
