import Link from "next/link";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, CalendarClock, CalendarDays, CheckCircle2,
  ClipboardList, Clock, DollarSign, FileText, HardHat, MapPin, Phone, Plus, Target, TrendingUp,
  Truck, UserCheck, Users, Wallet, BriefcaseBusiness, ArrowRight, ListChecks,
} from "lucide-react";
import { requireModule } from "@/lib/access";
import { resolveRange } from "@/lib/dates";
import { getDashboardData } from "@/lib/dashboard-data";
import { CHART_COLORS, fmtDate, fmtTime, money, number, pct, timeAgo, statusMeta, initials } from "@/lib/utils";
import { Avatar, Badge, PageHeader, Progress, StatCard, StatusDot, EmptyState } from "@/components/ui";
import { TrendChart, DonutChart, RankBars } from "@/components/charts";
import { RangeFilter } from "@/components/range-filter";
import { db } from "@/lib/db";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, format } from "date-fns";

export const dynamic = "force-dynamic";

function Panel({
  title, subtitle, action, children, className,
}: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ""}`}>
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-sub">{subtitle}</div>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DeltaFoot({ value, up, label }: { value: number; up: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {value}%
      <span className="font-normal text-muted">{label}</span>
    </span>
  );
}

function pctText(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

function MiniStat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel2 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">{label}</div>
      <div className="mt-1 text-[17px] font-[750] tracking-[-0.03em] text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted">{hint}</div>}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireModule("dashboard");
  const sp = await searchParams;
  if (user.role === "FIELD") return <FieldDashboard userName={user.name} employeeId={user.employeeId} />;

  const range = resolveRange(sp);
  const data = await getDashboardData(user, range);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow="Executive overview"
        title={`${greeting}, ${first}`}
        subtitle={`Company performance for ${range.label.toLowerCase()}. All figures are calculated live from CRM records.`}
        actions={
          <>
            <RangeFilter />
            <Link href="/crm/leads" className="btn btn-primary"><Plus size={15} /> New lead</Link>
          </>
        }
      />

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          accent
          label="Revenue booked"
          value={money(data.sales.revenue)}
          icon={<DollarSign size={16} />}
          foot={<DeltaFoot {...data.sales.deltas.revenue} />}
          href="/crm/reports?type=revenue"
        />
        <StatCard
          label="New leads"
          value={number(data.sales.newLeads)}
          icon={<Target size={16} />}
          foot={<DeltaFoot {...data.sales.deltas.leads} />}
          href="/crm/leads"
        />
        <StatCard
          label="Jobs today"
          value={number(data.dispatch.jobsToday)}
          icon={<Truck size={16} />}
          foot={<span><span className="font-semibold text-ink2">{data.dispatch.inProgress}</span> in progress · <span className="font-semibold text-ink2">{data.dispatch.unassigned}</span> unassigned</span>}
          href="/crm/jobs"
        />
        <StatCard
          label="Attendance rate"
          value={pctText(data.workforce.attendanceRate)}
          icon={<UserCheck size={16} />}
          foot={<span><span className="font-semibold text-ink2">{number(data.workforce.hoursWorked, { decimals: 0 })}</span> hours logged</span>}
          href="/crm/attendance"
        />
      </div>

      {/* Sales summary */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {[
          { label: "Total sales", value: money(data.sales.revenue), sub: `${data.sales.won} deals won` },
          { label: "Qualified leads", value: number(data.sales.qualified), sub: "created this period" },
          { label: "Open opportunities", value: number(data.sales.openOpportunities), sub: `${money(data.sales.pipelineValue, { compact: true })} pipeline` },
          { label: "Avg. deal value", value: money(data.sales.avgDeal), sub: "per won deal" },
          { label: "Estimates sent", value: number(data.sales.estimatesSent), sub: "this period" },
          { label: "Estimates accepted", value: number(data.sales.estimatesAccepted), sub: "this period" },
          { label: "Conversion rate", value: pctText(data.sales.conversion), sub: "won ÷ closed" },
          { label: "Lost deals", value: number(data.sales.lost), sub: "this period" },
        ].map((k) => (
          <div key={k.label} className="card px-3.5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">{k.label}</div>
            <div className="mt-1 text-[19px] font-[750] tracking-[-0.04em] text-ink">{k.value}</div>
            <div className="mt-0.5 text-[10px] text-muted">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Revenue trend"
          subtitle={`Won deal value · ${range.label}`}
          action={<span className="text-[11px] font-semibold text-emerald-600">{money(data.sales.revenue)} booked</span>}
        >
          {data.sales.revenue === 0 && data.charts.leadFlow.every((d) => !d.leads) ? (
            <EmptyState title="No revenue in this period" description="Try a wider date range or check the pipeline for open opportunities." />
          ) : (
            <TrendChart
              data={data.charts.revenueTrend}
              series={[
                { key: "revenue", label: "Revenue", color: "#f26a1b", kind: "area", format: "currency" },
                { key: "deals", label: "Deals won", color: "#1f2937", kind: "line" },
              ]}
              currency
              height={250}
            />
          )}
        </Panel>

        <Panel
          title="Lead pipeline"
          subtitle="Current opportunities by stage"
          action={<Link href="/crm/pipeline" className="text-[11px] font-semibold text-brand hover:underline">Open pipeline</Link>}
        >
          <DonutChart
            data={data.charts.stageCounts.map((s, i) => ({ ...s, color: CHART_COLORS[i % CHART_COLORS.length] }))}
            centerLabel="open stages"
            height={200}
          />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <MiniStat label="New" value={data.charts.stageCounts.find((s) => s.name.startsWith("new"))?.value ?? 0} />
            <MiniStat label="Negotiation" value={data.charts.stageCounts.find((s) => s.name.startsWith("negotiation"))?.value ?? 0} />
            <MiniStat label="Won" value={data.charts.stageCounts.find((s) => s.name.startsWith("won"))?.value ?? 0} />
          </div>
        </Panel>
      </div>

      {/* Charts row 2 */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Revenue by service" subtitle="Won deals in selected period">
          {data.charts.serviceRevenue.length ? (
            <DonutChart
              data={data.charts.serviceRevenue.slice(0, 5).map((s, i) => ({ ...s, color: CHART_COLORS[i % CHART_COLORS.length] }))}
              centerLabel="total won"
              centerValue={money(data.sales.revenue, { compact: true })}
              currency
              height={205}
            />
          ) : (
            <EmptyState title="No won deals yet" description="Accepted estimates and won leads will appear here." />
          )}
        </Panel>

        <Panel title="Sales by employee" subtitle="Booked revenue by sales rep">
          {data.charts.salesByEmployee.length ? (
            <RankBars data={data.charts.salesByEmployee.slice(0, 6).map((s) => ({ name: s.name.split(" ")[0], value: s.value }))} currency height={215} />
          ) : (
            <EmptyState title="No sales attributed" description="Assign won leads to reps to see this breakdown." />
          )}
        </Panel>

        <Panel title="Lead conversion" subtitle="Lead stages created this period">
          {data.charts.stageCounts.length ? (
            <TrendChart
              data={data.charts.stageCounts.map((s) => ({ label: s.name.slice(0, 9), count: s.value }))}
              series={[{ key: "count", label: "Leads", color: "#0d9488", kind: "bar" }]}
              height={215}
              yWidth={26}
            />
          ) : (
            <EmptyState title="No leads this period" description="New website inquiries will show up here instantly." />
          )}
        </Panel>
      </div>

      {/* Operational snapshot */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Customer snapshot"
          subtitle="Relationships at a glance"
          action={<Link href="/crm/customers" className="text-[11px] font-semibold text-brand hover:underline">View all</Link>}
        >
          <div className="grid grid-cols-2 gap-2.5">
            <MiniStat label="Total customers" value={number(data.customers.total)} hint="in your book" />
            <MiniStat label="New" value={number(data.customers.new)} hint={range.label.toLowerCase()} />
            <MiniStat label="Active" value={number(data.customers.active)} hint="with projects or jobs" />
            <MiniStat label="Repeat" value={number(data.customers.repeat)} hint="2+ projects" />
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-ink2">Repeat customer rate</span>
              <span className="font-bold text-ink">{pct(data.customers.repeat, data.customers.total)}</span>
            </div>
            <Progress value={pct(data.customers.repeat, data.customers.total)} />
          </div>
        </Panel>

        <Panel title="Project health" subtitle="Live project statuses">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Active" value={data.projects.active} />
            <MiniStat label="Scheduled" value={data.projects.scheduled} />
            <MiniStat label="On hold" value={data.projects.onHold} />
            <MiniStat label="Completed" value={data.projects.completed} />
            <MiniStat label="Delayed" value={data.projects.delayed} />
            <MiniStat label="Cancelled" value={data.projects.cancelled} />
          </div>
          <div className="mt-4">
            <TrendChart
              data={data.charts.projectStatus.map((p) => ({ label: p.name.slice(0, 8), count: p.value }))}
              series={[{ key: "count", label: "Projects", color: "#6366f1", kind: "bar" }]}
              height={110} yWidth={22}
            />
          </div>
        </Panel>

        <Panel title="Dispatch board" subtitle="Today & upcoming field work">
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Today" value={data.dispatch.jobsToday} />
            <MiniStat label="Scheduled" value={data.dispatch.scheduled} />
            <MiniStat label="In progress" value={data.dispatch.inProgress} />
            <MiniStat label="Completed" value={data.dispatch.completed} />
            <MiniStat label="Unassigned" value={data.dispatch.unassigned} />
            <MiniStat label="Rescheduled" value={data.dispatch.rescheduled} />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-panel2 px-3 py-2.5">
            <span className="flex items-center gap-2 text-[11.5px] text-ink2"><AlertTriangle size={13} className="text-amber-500" /> Delayed projects</span>
            <span className="text-[13px] font-bold text-ink">{data.dispatch.delayedProjects}</span>
          </div>
        </Panel>
      </div>

      {/* Calls & workforce */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Calls & call hours" subtitle="Activity by team member">
          {data.charts.callsByEmployee.length ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Calls" value={data.calls.total} />
                <MiniStat label="Connected" value={data.calls.connected} />
                <MiniStat label="Missed" value={data.calls.missed} />
                <MiniStat label="Call hours" value={number(data.calls.hours, { decimals: 1 })} />
                <MiniStat label="Avg. duration" value={`${Math.floor(data.calls.avgSeconds / 60)}m ${data.calls.avgSeconds % 60}s`} />
                <MiniStat label="Connect rate" value={pct(data.calls.connected, data.calls.total)} />
              </div>
              <div className="mt-3 divide-y divide-line">
                {data.calls.byEmployee.slice(0, 4).map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2 text-[11.5px] font-medium text-ink2">
                      <Avatar name={c.name} size="sm" /> {c.name}
                    </span>
                    <span className="text-[10.5px] text-muted">{c.calls} calls · {number(c.hours, { decimals: 1 })}h</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="No calls logged" description="Calls recorded in the selected period will appear here." />
          )}
        </Panel>

        <Panel
          title="Attendance & hours"
          subtitle="Workforce health for the period"
          action={<Link href="/crm/attendance" className="text-[11px] font-semibold text-brand hover:underline">Attendance</Link>}
        >
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Attendance rate" value={pctText(data.workforce.attendanceRate)} hint={`${data.workforce.present} present`} />
            <MiniStat label="Hours worked" value={number(data.workforce.hoursWorked, { decimals: 0 })} hint="total logged" />
            <MiniStat label="Overtime" value={`${number(data.workforce.overtime, { decimals: 1 })}h`} hint="approved OT" />
            <MiniStat label="Late arrivals" value={data.workforce.late} hint={`${data.workforce.absent} absences`} />
          </div>
          <div className="mt-3">
            <TrendChart
              data={data.charts.attendanceChart}
              series={[{ key: "hours", label: "Hours", color: "#0ea5e9", kind: "bar" }]}
              height={126} yWidth={30}
            />
          </div>
        </Panel>

        <Panel title="Jobs by status" subtitle="Field workload distribution">
          {data.charts.jobsByStatus.length ? (
            <DonutChart
              data={data.charts.jobsByStatus.map((j, i) => ({ ...j, color: CHART_COLORS[i % CHART_COLORS.length] }))}
              centerLabel="total jobs"
              height={190}
            />
          ) : (
            <EmptyState title="No jobs yet" />
          )}
        </Panel>
      </div>

      {/* Monthly revenue + attention */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Monthly revenue" subtitle="Last six months of won business">
          <TrendChart
            data={data.charts.monthlyRevenue}
            series={[{ key: "revenue", label: "Revenue", color: "#f26a1b", kind: "bar" }]}
            currency height={210}
          />
        </Panel>

        <Panel
          title="Needs attention"
          subtitle="Items that should not wait"
          action={<span className="flex size-6 items-center justify-center rounded-full bg-brandsoft text-brand"><AlertTriangle size={13} /></span>}
        >
          <div className="flex flex-col gap-2">
            {[
              { label: "Uncontacted new leads", count: data.attention.newUncontacted, href: "/crm/leads?status=NEW", icon: Target },
              { label: "Overdue follow-ups", count: data.attention.overdueFollowUps, href: "/crm/leads?followup=overdue", icon: CalendarClock },
              { label: "Unassigned jobs", count: data.attention.unassignedJobs, href: "/crm/jobs?assignment=unassigned", icon: Truck },
              { label: "Delayed projects", count: data.attention.delayedProjects, href: "/crm/projects?status=DELAYED", icon: HardHat },
            ].map((a) => (
              <Link key={a.label} href={a.href} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2.5 transition hover:border-line2 hover:bg-panel2">
                <a.icon size={14} className="text-muted" />
                <span className="flex-1 text-[11.5px] font-medium text-ink2">{a.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${a.count > 0 ? "bg-brandsoft text-brandink" : "bg-panel2 text-muted"}`}>{a.count}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.09em] text-muted">Upcoming follow-ups</div>
            {data.attention.followUps.length ? data.attention.followUps.slice(0, 3).map((f) => (
              <div key={f.id} className="flex items-start gap-2 py-1.5">
                <StatusDot value={f.dueAt < new Date() ? "LOST" : "SCHEDULED"} className="mt-1.5" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] font-medium text-ink2">{f.subject}</div>
                  <div className="text-[10px] text-muted">{f.customer?.name} · due {fmtDate(f.dueAt, "MMM d")}</div>
                </div>
              </div>
            )) : <div className="text-[11px] text-muted">No follow-ups due.</div>}
          </div>
        </Panel>
      </div>

      {/* Today's dispatch + recent inquiries */}
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="card-header">
            <div>
              <div className="card-title">Today&apos;s dispatch</div>
              <div className="card-sub">{fmtDate(new Date(), "EEEE, MMMM d")} · {data.dispatch.jobsToday} scheduled jobs</div>
            </div>
            <Link href="/crm/jobs" className="btn btn-outline btn-sm">Open dispatch <ArrowRight size={13} /></Link>
          </div>
          {data.dispatch.todayJobs.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Time</th><th>Job / Customer</th><th>Crew</th><th>Status</th></tr></thead>
                <tbody>
                  {data.dispatch.todayJobs.map((j) => (
                    <tr key={j.id}>
                      <td className="nowrap"><span className="cell-strong">{j.startTime ?? "—"}</span><div className="cell-sub">{j.durationMins ? `${Math.round(j.durationMins / 60)}h` : ""}</div></td>
                      <td>
                        <Link href={`/crm/jobs/${j.id}`} className="cell-strong hover:text-brand">{j.jobType}</Link>
                        <div className="cell-sub">{j.customer.company ?? j.customer.name} · {j.project?.name ?? "Service call"}</div>
                      </td>
                      <td>
                        <div className="flex -space-x-1.5">
                          {j.assignments.slice(0, 3).map((a) => (
                            <Avatar key={a.id} name={`${a.employee.firstName} ${a.employee.lastName}`} color={a.employee.avatarColor} size="sm" />
                          ))}
                          {!j.assignments.length && <span className="text-[11px] text-muted">Unassigned</span>}
                        </div>
                      </td>
                      <td><Badge value={j.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No jobs scheduled today" description="Head to dispatch to schedule field work." />
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div><div className="card-title">Recent inquiries</div><div className="card-sub">From web, phone & email</div></div>
            <Link href="/crm/requests" className="text-[11px] font-semibold text-brand hover:underline">All</Link>
          </div>
          <div className="divide-y divide-line">
            {data.recentRequests.map((r) => (
              <Link key={r.id} href={`/crm/requests?q=${r.requestNo}`} className="flex items-start gap-3 px-4 py-3 transition hover:bg-panel2">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brandsoft text-brandink"><ClipboardList size={14} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold text-ink">{r.customer.company ?? r.customer.name}</div>
                  <div className="truncate text-[10.5px] text-muted">{r.service?.name} · {r.source.toLowerCase()}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge value={r.urgency} label={r.urgency === "EMERGENCY" ? "Emergency" : r.urgency === "URGENT" ? "Urgent" : "Normal"} />
                    <span className="text-[9.5px] text-muted">{timeAgo(r.createdAt)}</span>
                  </div>
                </div>
              </Link>
            ))}
            {!data.recentRequests.length && <EmptyState title="No inquiries yet" />}
          </div>
        </section>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-muted">
        <span>Data refreshed {fmtTime(new Date())} · {range.label}</span>
        <span className="flex items-center gap-3">
          <Link href={`/crm/reports?range=${range.preset}`} className="hover:text-ink">View full reports</Link>
          <Link href="/crm/admin/audit" className="hover:text-ink">Audit trail</Link>
        </span>
      </div>
    </>
  );
}

async function FieldDashboard({ userName, employeeId }: { userName: string; employeeId: string | null }) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const [todayJobs, weekJobs, attendance, weekAttendance, notifications] = await Promise.all([
    db.job.findMany({
      where: { assignments: { some: { employeeId: employeeId ?? "__none__" } }, scheduledDate: { gte: todayStart, lte: todayEnd } },
      include: {
        customer: { select: { name: true, company: true, phone: true } },
        project: { select: { name: true } },
        assignments: { include: { employee: { select: { firstName: true, lastName: true, avatarColor: true } } } },
      },
      orderBy: { startTime: "asc" },
    }),
    db.job.findMany({
      where: { assignments: { some: { employeeId: employeeId ?? "__none__" } }, scheduledDate: { gte: weekStart, lte: weekEnd } },
      include: { customer: { select: { name: true, company: true } } },
      orderBy: { scheduledDate: "asc" },
    }),
    employeeId ? db.attendance.findFirst({ where: { employeeId, date: { gte: todayStart, lte: todayEnd } } }) : null,
    employeeId ? db.attendance.findMany({ where: { employeeId, date: { gte: weekStart, lte: weekEnd } } }) : [],
    db.notification.findMany({ where: { employeeId: employeeId ?? "__none__", read: false }, orderBy: { createdAt: "desc" }, take: 4 }),
  ]);

  const hours = weekAttendance.reduce((s, a) => s + a.totalHours, 0);
  const activeJob = todayJobs.find((j) => ["IN_PROGRESS", "EN_ROUTE", "DISPATCHED"].includes(j.status)) ?? todayJobs[0];

  return (
    <>
      <PageHeader
        eyebrow="Field workspace"
        title={`Today, ${format(now, "EEEE, MMMM d")}`}
        subtitle={`Welcome back, ${userName.split(" ")[0]}. Here is your assigned work and week ahead.`}
        actions={<Link href="/crm/attendance" className="btn btn-primary"><Clock size={15} /> Clock in / out</Link>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Jobs today" value={todayJobs.length} icon={<Truck size={16} />} accent foot={<span>{todayJobs.filter((j) => j.status === "COMPLETED").length} completed</span>} />
        <StatCard label="Hours this week" value={number(hours, { decimals: 1 })} icon={<Clock size={16} />} foot={<span>{weekAttendance.length} shifts recorded</span>} />
        <StatCard label="Attendance today" value={attendance?.clockIn ? attendance.clockIn : "Not clocked in"} icon={<UserCheck size={16} />} foot={attendance ? <Badge value={attendance.status} /> : <span>Tap clock in to start</span>} href="/crm/attendance" />
        <StatCard label="Notifications" value={notifications.length} icon={<Bell size={16} />} foot={<span>Unread updates</span>} href="/crm/notifications" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-ink">Your jobs today</h2>
            <Link href="/crm/jobs" className="text-[11px] font-semibold text-brand hover:underline">Full schedule</Link>
          </div>
          <div className="flex flex-col gap-3">
            {todayJobs.map((j) => (
              <Link key={j.id} href={`/crm/jobs/${j.id}`} className="card block p-4 transition hover:border-line2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="flex min-w-[64px] flex-col items-center rounded-lg bg-panel2 px-2 py-2">
                      <span className="text-[14px] font-bold text-ink">{j.startTime ?? "TBD"}</span>
                      <span className="text-[9.5px] text-muted">{j.durationMins ? `${Math.round(j.durationMins / 60)}h` : ""}</span>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-ink">{j.jobType}</div>
                      <div className="text-[11px] text-muted">{j.customer.company ?? j.customer.name}</div>
                      <div className="mt-1 flex items-center gap-1 text-[10.5px] text-muted"><MapPin size={10} /> {j.address}</div>
                    </div>
                  </div>
                  <Badge value={j.status} />
                </div>
                {j.description && <p className="mt-3 line-clamp-2 text-[11.5px] leading-relaxed text-ink2">{j.description}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
                  <div className="flex -space-x-1.5">
                    {j.assignments.map((a) => <Avatar key={a.id} name={`${a.employee.firstName} ${a.employee.lastName}`} color={a.employee.avatarColor} size="sm" />)}
                  </div>
                  <span className="flex items-center gap-1 text-[10.5px] text-muted"><Phone size={10} /> {j.customer.phone}</span>
                </div>
              </Link>
            ))}
            {!todayJobs.length && (
              <div className="card">
                <EmptyState icon={<CheckCircle2 />} title="No jobs assigned today" description="Your dispatcher will notify you when new work is scheduled. Check the calendar for upcoming jobs." />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {activeJob && (
            <div className="card overflow-hidden">
              <div className="bg-dark px-4 py-3 text-white">
                <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-white/45">Active assignment</div>
                <div className="mt-1 text-[13px] font-semibold">{activeJob.jobType}</div>
              </div>
              <div className="space-y-2.5 p-4 text-[11.5px]">
                <div className="flex items-start gap-2"><MapPin size={13} className="mt-0.5 text-muted" /><span>{activeJob.address}</span></div>
                <div className="flex items-center gap-2"><Phone size={13} className="text-muted" /><span>{activeJob.customer.phone}</span></div>
                <div className="flex items-center gap-2"><Users size={13} className="text-muted" /><span>{activeJob.assignments.map((a) => `${a.employee.firstName} ${a.employee.lastName[0]}.`).join(", ") || "Crew TBD"}</span></div>
                {activeJob.notes && <div className="rounded-lg bg-panel2 p-2.5 text-[11px] leading-relaxed text-ink2">{activeJob.notes}</div>}
                <Link href={`/crm/jobs/${activeJob.id}`} className="btn btn-outline btn-sm w-full">View job details</Link>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><div><div className="card-title">This week</div><div className="card-sub">{weekJobs.length} assigned jobs</div></div></div>
            <div className="divide-y divide-line">
              {weekJobs.slice(0, 6).map((j) => (
                <Link key={j.id} href={`/crm/jobs/${j.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel2">
                  <div className="w-9 text-center">
                    <div className="text-[9px] uppercase text-muted">{format(j.scheduledDate ?? now, "EEE")}</div>
                    <div className="text-[12px] font-bold text-ink">{format(j.scheduledDate ?? now, "d")}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11.5px] font-semibold text-ink">{j.jobType}</div>
                    <div className="truncate text-[10px] text-muted">{j.customer.company ?? j.customer.name}</div>
                  </div>
                  <Badge value={j.status} />
                </Link>
              ))}
              {!weekJobs.length && <div className="px-4 py-6 text-center text-[11px] text-muted">No jobs this week.</div>}
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.09em] text-muted">Recent notifications</div>
            {notifications.map((n) => (
              <div key={n.id} className="border-b border-line py-2 last:border-0">
                <div className="text-[11.5px] font-medium text-ink">{n.title}</div>
                <div className="text-[10px] text-muted">{timeAgo(n.createdAt)}</div>
              </div>
            ))}
            {!notifications.length && <div className="py-3 text-[11px] text-muted">You&apos;re all caught up.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
