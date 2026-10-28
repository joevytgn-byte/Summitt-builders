import Link from "next/link";
import { eachWeekOfInterval, format } from "date-fns";
import { Award, BarChart3, Clock, PhoneCall, Target, TrendingUp, Trophy, Users } from "lucide-react";
import { requireModule } from "@/lib/access";
import { db } from "@/lib/db";
import { resolveRange } from "@/lib/dates";
import { fmtDate, money, number, pct } from "@/lib/utils";
import { Avatar, Badge, PageHeader, Progress, StatCard } from "@/components/ui";
import { RangeFilter } from "@/components/range-filter";
import { RankBars, TrendChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function PerformancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("performance");
  const params = await searchParams;
  const range = resolveRange({
    range: typeof params.range === "string" ? params.range : "quarter",
    from: typeof params.from === "string" ? params.from : undefined,
    to: typeof params.to === "string" ? params.to : undefined,
  });

  const [employees, leads, wonLeads, lostLeads, calls, attendance, jobs] = await Promise.all([
    db.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, position: true, avatarColor: true, hourlyRate: true, department: { select: { name: true } } },
      orderBy: { firstName: "asc" },
    }),
    db.lead.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      select: { id: true, assignedToId: true, status: true, estimatedValue: true, responseMins: true },
    }),
    db.lead.findMany({
      where: { wonAt: { gte: range.from, lte: range.to } },
      select: { id: true, assignedToId: true, estimatedValue: true, responseMins: true },
    }),
    db.lead.findMany({
      where: { lostAt: { gte: range.from, lte: range.to } },
      select: { id: true, assignedToId: true },
    }),
    db.call.findMany({
      where: { startedAt: { gte: range.from, lte: range.to } },
      select: { employeeId: true, connected: true, durationSec: true },
    }),
    db.attendance.findMany({
      where: { date: { gte: range.from, lte: range.to } },
      select: { employeeId: true, totalHours: true, overtimeHours: true, status: true, lateMinutes: true, date: true },
    }),
    db.job.findMany({
      where: { scheduledDate: { gte: range.from, lte: range.to } },
      select: { id: true, status: true, scheduledDate: true, assignments: { select: { employeeId: true } } },
    }),
  ]);

  const revenue = wonLeads.reduce((s, l) => s + l.estimatedValue, 0);
  const pipeline = leads.filter((l) => !["WON", "LOST"].includes(l.status)).reduce((s, l) => s + l.estimatedValue, 0);
  const totalCalls = calls.length;
  const connected = calls.filter((c) => c.connected).length;
  const hours = attendance.reduce((s, a) => s + a.totalHours, 0);
  const overtime = attendance.reduce((s, a) => s + a.overtimeHours, 0);
  const completedJobs = jobs.filter((j) => j.status === "COMPLETED").length;
  const avgResponseValues = leads.map((l) => l.responseMins ?? 0).filter((n) => n > 0);
  const avgResponse = avgResponseValues.length ? Math.round(avgResponseValues.reduce((s, n) => s + n, 0) / avgResponseValues.length) : 0;
  const workDays = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) * (5 / 7));

  const salesRows = employees
    .map((e) => {
      const repLeads = leads.filter((l) => l.assignedToId === e.id);
      const repWon = wonLeads.filter((l) => l.assignedToId === e.id);
      const repLost = lostLeads.filter((l) => l.assignedToId === e.id);
      const repCalls = calls.filter((c) => c.employeeId === e.id);
      const repRevenue = repWon.reduce((s, l) => s + l.estimatedValue, 0);
      return {
        employee: e,
        leads: repLeads.length,
        won: repWon.length,
        lost: repLost.length,
        revenue: repRevenue,
        pipeline: repLeads.filter((l) => !["WON", "LOST"].includes(l.status)).reduce((s, l) => s + l.estimatedValue, 0),
        avgDeal: repWon.length ? repRevenue / repWon.length : 0,
        winRate: pct(repWon.length, repWon.length + repLost.length),
        calls: repCalls.length,
        connectRate: pct(repCalls.filter((c) => c.connected).length, repCalls.length),
        responseMins: (() => {
          const values = repLeads.map((l) => l.responseMins ?? 0).filter((n) => n > 0);
          return values.length ? Math.round(values.reduce((s, n) => s + n, 0) / values.length) : 0;
        })(),
      };
    })
    .filter((r) => r.leads > 0 || r.calls > 0 || r.won > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const crewRows = employees
    .map((e) => {
      const rows = attendance.filter((a) => a.employeeId === e.id);
      const completed = jobs.filter((j) => j.status === "COMPLETED" && j.assignments.some((a) => a.employeeId === e.id));
      const scheduled = jobs.filter((j) => j.assignments.some((a) => a.employeeId === e.id));
      const present = rows.filter((a) => ["PRESENT", "LATE", "REMOTE"].includes(a.status)).length;
      const hoursWorked = rows.reduce((s, a) => s + a.totalHours, 0);
      return {
        employee: e,
        jobs: completed.length,
        scheduled: scheduled.length,
        hours: hoursWorked,
        overtime: rows.reduce((s, a) => s + a.overtimeHours, 0),
        attendanceRate: pct(present, rows.length),
        utilization: Math.min(140, Math.round((hoursWorked / (workDays * 8)) * 100)),
        late: rows.filter((a) => a.status === "LATE").length,
      };
    })
    .filter((r) => r.scheduled > 0 || r.hours > 0)
    .sort((a, b) => b.jobs - a.jobs || b.hours - a.hours);

  const departments = new Map<string, { name: string; people: number; hours: number; overtime: number; jobs: number; present: number; rows: number }>();
  for (const e of employees) {
    const name = e.department?.name ?? "Unassigned";
    const entry = departments.get(name) ?? { name, people: 0, hours: 0, overtime: 0, jobs: 0, present: 0, rows: 0 };
    entry.people += 1;
    const rows = attendance.filter((a) => a.employeeId === e.id);
    entry.hours += rows.reduce((s, a) => s + a.totalHours, 0);
    entry.overtime += rows.reduce((s, a) => s + a.overtimeHours, 0);
    entry.jobs += jobs.filter((j) => j.status === "COMPLETED" && j.assignments.some((a) => a.employeeId === e.id)).length;
    entry.present += rows.filter((a) => ["PRESENT", "LATE", "REMOTE"].includes(a.status)).length;
    entry.rows += rows.length;
    departments.set(name, entry);
  }

  const weeks = eachWeekOfInterval({ start: range.from, end: range.to }, { weekStartsOn: 1 });
  const trend = weeks.map((week) => {
    const end = new Date(week); end.setDate(end.getDate() + 7);
    const weekAttendance = attendance.filter((a) => a.date >= week && a.date < end);
    const weekJobs = jobs.filter((j) => j.status === "COMPLETED" && j.scheduledDate && j.scheduledDate >= week && j.scheduledDate < end);
    return {
      label: format(week, "MMM d"),
      hours: Math.round(weekAttendance.reduce((s, a) => s + a.totalHours, 0)),
      jobs: weekJobs.length,
    };
  });

  const topSales = salesRows[0];
  const topCrew = crewRows[0];

  return (
    <>
      <PageHeader
        eyebrow="Team & sales analytics"
        title="Performance"
        subtitle={`Sales output, crew utilization and attendance quality for ${range.label.toLowerCase()}.`}
        actions={<RangeFilter defaultRange="quarter" />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Won revenue" value={money(revenue, { compact: true })} foot={<span>{wonLeads.length} deals closed</span>} icon={<Trophy size={16} />} />
        <StatCard label="Open pipeline" value={money(pipeline, { compact: true })} foot={<span>{leads.length} new leads</span>} icon={<Target size={16} />} />
        <StatCard label="Labour hours" value={number(hours)} foot={<span>{overtime.toFixed(1)}h overtime</span>} icon={<Clock size={16} />} />
        <StatCard label="Jobs delivered" value={number(completedJobs)} foot={<span>{jobs.length} scheduled</span>} icon={<TrendingUp size={16} />} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="card-header">
            <div><div className="card-title">Weekly output</div><div className="card-sub">Hours worked and jobs completed</div></div>
            <Badge value="TEAM" />
          </div>
          <div className="p-4">
            <TrendChart
              data={trend}
              series={[
                { key: "hours", label: "Hours", color: "#f26a1b", kind: "bar" },
                { key: "jobs", label: "Jobs completed", color: "#0d9488", kind: "line" },
              ]}
              height={240}
            />
          </div>
        </section>

        <section className="card">
          <div className="card-header"><div><div className="card-title">Revenue by rep</div><div className="card-sub">Won contract value</div></div></div>
          <div className="p-4">
            {salesRows.length ? (
              <RankBars data={salesRows.slice(0, 6).map((r) => ({ name: `${r.employee.firstName} ${r.employee.lastName[0]}.`, value: r.revenue }))} currency height={Math.max(180, salesRows.slice(0, 6).length * 38)} />
            ) : (
              <div className="py-10 text-center text-[11.5px] text-muted">No closed deals in this range.</div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
              <div><div className="text-[9.5px] uppercase tracking-[0.07em] text-muted">Calls</div><div className="text-[15px] font-bold text-ink">{number(totalCalls)}</div></div>
              <div><div className="text-[9.5px] uppercase tracking-[0.07em] text-muted">Connect rate</div><div className="text-[15px] font-bold text-ink">{pct(connected, totalCalls)}%</div></div>
              <div><div className="text-[9.5px] uppercase tracking-[0.07em] text-muted">Avg. response</div><div className="text-[15px] font-bold text-ink">{avgResponse ? `${avgResponse}m` : "—"}</div></div>
              <div><div className="text-[9.5px] uppercase tracking-[0.07em] text-muted">Avg. deal</div><div className="text-[15px] font-bold text-ink">{money(wonLeads.length ? revenue / wonLeads.length : 0, { compact: true })}</div></div>
            </div>
          </div>
        </section>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><Award size={18} /></span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Top sales performer</div>
            {topSales ? (
              <>
                <Link href={`/crm/employees/${topSales.employee.id}`} className="block truncate text-[13px] font-bold text-ink hover:text-brand">{topSales.employee.firstName} {topSales.employee.lastName}</Link>
                <div className="text-[10.5px] text-muted">{money(topSales.revenue)} won · {topSales.won} deals · {topSales.winRate}% win rate</div>
              </>
            ) : <div className="text-[12px] text-muted">No sales activity in range.</div>}
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"><BarChart3 size={18} /></span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Top field performer</div>
            {topCrew ? (
              <>
                <Link href={`/crm/employees/${topCrew.employee.id}`} className="block truncate text-[13px] font-bold text-ink hover:text-brand">{topCrew.employee.firstName} {topCrew.employee.lastName}</Link>
                <div className="text-[10.5px] text-muted">{topCrew.jobs} jobs completed · {topCrew.hours.toFixed(1)}h logged · {topCrew.attendanceRate}% attendance</div>
              </>
            ) : <div className="text-[12px] text-muted">No field activity in range.</div>}
          </div>
        </div>
      </div>

      <section className="card mb-4 overflow-hidden">
        <div className="card-header">
          <div><div className="card-title">Sales performance</div><div className="card-sub">Leads, conversion and call activity by rep</div></div>
          <span className="text-[10.5px] text-muted">{salesRows.length} active reps</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Rep</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Won</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Avg deal</th>
                <th className="text-right">Win rate</th>
                <th className="text-right">Calls</th>
                <th className="text-right">Connect</th>
                <th className="text-right">Avg response</th>
              </tr>
            </thead>
            <tbody>
              {salesRows.map((r) => (
                <tr key={r.employee.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar name={`${r.employee.firstName} ${r.employee.lastName}`} color={r.employee.avatarColor} size="sm" />
                      <div>
                        <Link href={`/crm/employees/${r.employee.id}`} className="cell-strong hover:text-brand">{r.employee.firstName} {r.employee.lastName}</Link>
                        <div className="cell-sub">{r.employee.position}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right mono text-[11.5px]">{r.leads}</td>
                  <td className="text-right mono text-[11.5px]">{r.won}</td>
                  <td className="text-right mono font-semibold text-ink">{money(r.revenue, { compact: true })}</td>
                  <td className="text-right mono text-[11.5px]">{money(r.avgDeal, { compact: true })}</td>
                  <td className="text-right">
                    <span className={`text-[11.5px] font-bold ${r.winRate >= 50 ? "text-emerald-600" : r.winRate >= 25 ? "text-ink" : "text-amber-600"}`}>{r.winRate}%</span>
                  </td>
                  <td className="text-right mono text-[11.5px]">{r.calls}</td>
                  <td className="text-right mono text-[11.5px]">{r.connectRate}%</td>
                  <td className="text-right mono text-[11.5px]">{r.responseMins ? `${r.responseMins}m` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="card overflow-hidden xl:col-span-2">
          <div className="card-header">
            <div><div className="card-title">Crew performance</div><div className="card-sub">Jobs, utilization and attendance</div></div>
            <Link href="/crm/attendance" className="text-[11px] font-semibold text-brand hover:underline">Attendance <PhoneCall size={10} className="inline" /></Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Employee</th><th className="text-right">Jobs</th><th className="text-right">Hours</th><th className="text-right">OT</th><th>Utilization</th><th className="text-right">Attendance</th></tr>
              </thead>
              <tbody>
                {crewRows.map((r) => (
                  <tr key={r.employee.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={`${r.employee.firstName} ${r.employee.lastName}`} color={r.employee.avatarColor} size="sm" />
                        <div>
                          <Link href={`/crm/employees/${r.employee.id}`} className="cell-strong hover:text-brand">{r.employee.firstName} {r.employee.lastName}</Link>
                          <div className="cell-sub">{r.employee.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right mono text-[11.5px]">{r.jobs}</td>
                    <td className="text-right mono text-[11.5px]">{r.hours.toFixed(1)}</td>
                    <td className={`text-right mono text-[11.5px] ${r.overtime > 0 ? "text-amber-600" : ""}`}>{r.overtime.toFixed(1)}</td>
                    <td>
                      <div className="flex w-[110px] items-center gap-2">
                        <Progress value={Math.min(100, r.utilization)} className="flex-1" tone={r.utilization > 100 ? "amber" : "brand"} />
                        <span className="w-8 text-right text-[9.5px] text-muted">{r.utilization}%</span>
                      </div>
                    </td>
                    <td className="text-right mono text-[11.5px]">{r.attendanceRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><div><div className="card-title">Departments</div><div className="card-sub">Hours and delivery mix</div></div></div>
          <div className="divide-y divide-line">
            {[...departments.values()].sort((a, b) => b.hours - a.hours).map((d) => (
              <div key={d.name} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><Users size={12} className="text-muted" /><span className="text-[12px] font-semibold text-ink">{d.name}</span></div>
                  <span className="text-[10px] text-muted">{d.people} people</span>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-[12px] font-bold text-ink">{d.hours.toFixed(0)}h</div><div className="text-[8.5px] uppercase tracking-[0.06em] text-muted">Hours</div></div>
                  <div><div className="text-[12px] font-bold text-ink">{d.jobs}</div><div className="text-[8.5px] uppercase tracking-[0.06em] text-muted">Jobs</div></div>
                  <div><div className="text-[12px] font-bold text-ink">{pct(d.present, d.rows)}%</div><div className="text-[8.5px] uppercase tracking-[0.06em] text-muted">Present</div></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10.5px] text-muted">
        <span>Range: {fmtDate(range.from)} – {fmtDate(range.to)}</span>
        <span>{number(employees.length)} active employees</span>
        <span>Utilization target: 85% of a {workDays}-day, 8-hour schedule.</span>
      </div>
    </>
  );
}
