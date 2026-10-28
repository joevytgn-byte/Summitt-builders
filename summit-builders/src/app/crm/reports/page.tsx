import Link from "next/link";
import { startOfMonth, subMonths, format } from "date-fns";
import { BarChart3, Building2, Download, FileSpreadsheet, HardHat, Target, TrendingUp, Users } from "lucide-react";
import { requireModule } from "@/lib/access";
import { db } from "@/lib/db";
import { resolveRange, previousRange } from "@/lib/dates";
import { fmtDate, money, number, pct } from "@/lib/utils";
import { Badge, PageHeader, Progress, StatCard } from "@/components/ui";
import { RangeFilter } from "@/components/range-filter";
import { DonutChart, RankBars, TrendChart } from "@/components/charts";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("reports");
  const params = await searchParams;
  const range = resolveRange({
    range: typeof params.range === "string" ? params.range : "quarter",
    from: typeof params.from === "string" ? params.from : undefined,
    to: typeof params.to === "string" ? params.to : undefined,
  });
  const prev = previousRange(range);
  const query = new URLSearchParams({ range: range.preset, from: format(range.from, "yyyy-MM-dd"), to: format(range.to, "yyyy-MM-dd") });

  const sixMonths = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(new Date(), 5 - i)));

  const [won, prevWon, lost, jobs, prevJobs, projects, prevProjects, estimates, customers, serviceRows, leadSources, attendance, calls] = await Promise.all([
    db.lead.findMany({ where: { wonAt: { gte: range.from, lte: range.to } }, include: { service: { select: { name: true } }, customer: { select: { id: true, name: true, company: true } } } }),
    db.lead.findMany({ where: { wonAt: { gte: prev.from, lte: prev.to } }, select: { estimatedValue: true } }),
    db.lead.findMany({ where: { lostAt: { gte: range.from, lte: range.to } }, select: { id: true, lostReason: true } }),
    db.job.findMany({ where: { scheduledDate: { gte: range.from, lte: range.to } }, select: { id: true, status: true, durationMins: true } }),
    db.job.findMany({ where: { scheduledDate: { gte: prev.from, lte: prev.to }, status: "COMPLETED" }, select: { id: true } }),
    db.project.findMany({ where: { createdAt: { gte: range.from, lte: range.to } }, select: { id: true, contractValue: true, status: true, projectType: true } }),
    db.project.findMany({ where: { createdAt: { gte: prev.from, lte: prev.to } }, select: { id: true, contractValue: true } }),
    db.estimate.findMany({ where: { createdAt: { gte: range.from, lte: range.to } }, select: { status: true, total: true } }),
    db.customer.findMany({ select: { id: true, name: true, company: true, city: true, createdAt: true, projects: { select: { contractValue: true } } } }),
    db.lead.findMany({ where: { createdAt: { gte: range.from, lte: range.to }, serviceId: { not: null } }, select: { estimatedValue: true, service: { select: { name: true } } } }),
    db.lead.groupBy({ by: ["source"], where: { createdAt: { gte: range.from, lte: range.to } }, _count: true, _sum: { estimatedValue: true } }),
    db.attendance.findMany({ where: { date: { gte: range.from, lte: range.to } }, select: { totalHours: true, overtimeHours: true, status: true } }),
    db.call.findMany({ where: { startedAt: { gte: range.from, lte: range.to } }, select: { connected: true, durationSec: true, direction: true } }),
  ]);

  const revenue = won.reduce((s, l) => s + l.estimatedValue, 0);
  const prevRevenue = prevWon.reduce((s, l) => s + l.estimatedValue, 0);
  const revenueDelta = prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : 0;
  const completed = jobs.filter((j) => j.status === "COMPLETED").length;
  const projectValue = projects.reduce((s, p) => s + p.contractValue, 0);
  const prevProjectValue = prevProjects.reduce((s, p) => s + p.contractValue, 0);
  const hours = attendance.reduce((s, a) => s + a.totalHours, 0);
  const overtime = attendance.reduce((s, a) => s + a.overtimeHours, 0);
  const present = attendance.filter((a) => ["PRESENT", "LATE", "REMOTE"].includes(a.status)).length;
  const accepted = estimates.filter((e) => e.status === "ACCEPTED");
  const quoted = estimates.reduce((s, e) => s + e.total, 0);
  const connected = calls.filter((c) => c.connected).length;
  const winRate = pct(won.length, won.length + lost.length);

  const monthly = await Promise.all(
    sixMonths.map(async (month) => {
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
      const [mWon, mJobs] = await Promise.all([
        db.lead.findMany({ where: { wonAt: { gte: month, lte: end } }, select: { estimatedValue: true } }),
        db.job.count({ where: { scheduledDate: { gte: month, lte: end }, status: "COMPLETED" } }),
      ]);
      return {
        label: format(month, "MMM yy"),
        revenue: mWon.reduce((s, l) => s + l.estimatedValue, 0),
        jobs: mJobs,
      };
    }),
  );

  const byService = new Map<string, number>();
  for (const lead of serviceRows) {
    const key = lead.service?.name ?? "General";
    byService.set(key, (byService.get(key) ?? 0) + lead.estimatedValue);
  }
  const servicePalette = ["#f26a1b", "#0d9488", "#6366f1", "#f59e0b", "#ec4899", "#14b8a6", "#8b5cf6"];
  const serviceData = [...byService.entries()]
    .map(([name, value], i) => ({ name, value, color: servicePalette[i % servicePalette.length] }))
    .sort((a, b) => b.value - a.value);

  const lostReasons = new Map<string, number>();
  for (const l of lost) {
    const key = l.lostReason ?? "Not recorded";
    lostReasons.set(key, (lostReasons.get(key) ?? 0) + 1);
  }

  const topCustomers = customers
    .map((c) => ({ ...c, total: c.projects.reduce((s, p) => s + p.contractValue, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const jobStatus = new Map<string, number>();
  for (const j of jobs) jobStatus.set(j.status, (jobStatus.get(j.status) ?? 0) + 1);

  return (
    <>
      <PageHeader
        eyebrow="Business intelligence"
        title="Reports"
        subtitle="Revenue, sales efficiency and delivery performance with one-click CSV exports."
        actions={
          <>
            <RangeFilter defaultRange="quarter" />
            <a href={`/api/reports/export?dataset=revenue&${query.toString()}`} className="btn btn-outline"><Download size={14} /> Revenue CSV</a>
            <a href={`/api/reports/export?dataset=jobs&${query.toString()}`} className="btn btn-primary"><FileSpreadsheet size={14} /> Jobs CSV</a>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Won revenue" value={money(revenue, { compact: true })} foot={<span className={revenueDelta >= 0 ? "text-emerald-600" : "text-red-600"}>{revenueDelta >= 0 ? "+" : ""}{revenueDelta}% vs prior</span>} icon={<TrendingUp size={16} />} />
        <StatCard label="Win rate" value={`${winRate}%`} foot={<span>{won.length} won · {lost.length} lost</span>} icon={<Target size={16} />} />
        <StatCard label="Project value" value={money(projectValue, { compact: true })} foot={<span>{projects.length} new · prior {money(prevProjectValue, { compact: true })}</span>} icon={<HardHat size={16} />} />
        <StatCard label="Labour hours" value={number(hours)} foot={<span>{overtime.toFixed(1)}h OT · {pct(present, attendance.length)}% present</span>} icon={<Users size={16} />} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="card-header">
            <div><div className="card-title">Revenue & delivery trend</div><div className="card-sub">Last six months · won value and completed jobs</div></div>
          </div>
          <div className="p-4">
            <TrendChart
              data={monthly}
              currency
              series={[
                { key: "revenue", label: "Revenue", color: "#f26a1b", kind: "area" },
                { key: "jobs", label: "Jobs completed", color: "#0d9488", kind: "line" },
              ]}
              height={260}
            />
          </div>
        </section>

        <section className="card">
          <div className="card-header"><div><div className="card-title">Revenue by service</div><div className="card-sub">Lead value mix</div></div></div>
          <div className="p-4">
            <DonutChart data={serviceData.slice(0, 6)} currency height={200} />
          </div>
        </section>
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <section className="card">
          <div className="card-header"><div><div className="card-title">Lead sources</div><div className="card-sub">Volume and value by channel</div></div></div>
          <div className="p-4">
            <RankBars
              data={leadSources.map((s) => ({ name: s.source, value: s._sum.estimatedValue ?? 0 })).sort((a, b) => b.value - a.value)}
              currency
              height={Math.max(180, leadSources.length * 38)}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
              {leadSources.sort((a, b) => b._count - a._count).slice(0, 4).map((s) => (
                <div key={s.source} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted">{s.source}</span>
                  <span className="font-semibold text-ink">{s._count} leads</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><div><div className="card-title">Estimate & pipeline health</div><div className="card-sub">Quoted vs accepted</div></div></div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-line bg-panel2 py-3">
                <div className="text-[16px] font-bold text-ink">{estimates.length}</div>
                <div className="text-[9.5px] uppercase tracking-[0.06em] text-muted">Estimates</div>
              </div>
              <div className="rounded-lg border border-line bg-panel2 py-3">
                <div className="text-[16px] font-bold text-ink">{money(quoted, { compact: true })}</div>
                <div className="text-[9.5px] uppercase tracking-[0.06em] text-muted">Quoted</div>
              </div>
              <div className="rounded-lg border border-line bg-panel2 py-3">
                <div className="text-[16px] font-bold text-emerald-600">{pct(accepted.length, estimates.length)}%</div>
                <div className="text-[9.5px] uppercase tracking-[0.06em] text-muted">Accepted</div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {["ACCEPTED", "SENT", "DRAFT", "REJECTED"].map((status) => {
                const count = estimates.filter((e) => e.status === status).length;
                if (!count) return null;
                return (
                  <div key={status}>
                    <div className="mb-1 flex items-center justify-between text-[10.5px]"><span className="text-muted">{status.toLowerCase()}</span><span className="font-semibold text-ink">{count}</span></div>
                    <Progress value={(count / Math.max(1, estimates.length)) * 100} tone={status === "ACCEPTED" ? "green" : status === "REJECTED" ? "red" : "brand"} />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Lost reasons</div>
              {[...lostReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([reason, count]) => (
                <div key={reason} className="flex items-center justify-between py-0.5 text-[10.5px]"><span className="text-muted">{reason}</span><span className="font-semibold text-ink">{count}</span></div>
              ))}
              {!lostReasons.size && <div className="text-[10.5px] text-muted">No lost deals in this period.</div>}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="card overflow-hidden xl:col-span-2">
          <div className="card-header">
            <div><div className="card-title">Top customers</div><div className="card-sub">By lifetime contract value</div></div>
            <a href={`/api/reports/export?dataset=customers&${query.toString()}`} className="text-[11px] font-semibold text-brand hover:underline">Export CSV</a>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Customer</th><th>City</th><th className="text-right">Projects</th><th className="text-right">Contract value</th><th>Since</th></tr></thead>
              <tbody>
                {topCustomers.map((c) => (
                  <tr key={c.id} data-clickable="true">
                    <td>
                      <Link href={`/crm/customers/${c.id}`} className="cell-strong hover:text-brand">{c.company ?? c.name}</Link>
                      {c.company && <div className="cell-sub">{c.name}</div>}
                    </td>
                    <td className="text-[11.5px]">{c.city}</td>
                    <td className="text-right mono text-[11.5px]">{c.projects.length}</td>
                    <td className="text-right mono font-semibold text-ink">{money(c.total)}</td>
                    <td className="nowrap text-[11.5px] text-muted">{fmtDate(c.createdAt, "MMM yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-header"><div><div className="card-title">Delivery mix</div><div className="card-sub">Jobs by status · {jobs.length} in range</div></div><BarChart3 size={15} className="text-muted" /></div>
          <div className="p-5">
            {[...jobStatus.entries()].sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status} className="mb-2.5">
                <div className="mb-1 flex items-center justify-between text-[10.5px]"><span className="flex items-center gap-1.5 text-muted"><Badge value={status} plain /> </span><span className="font-semibold text-ink">{count}</span></div>
                <Progress value={(count / Math.max(1, jobs.length)) * 100} tone={status === "COMPLETED" ? "green" : status === "CANCELLED" ? "red" : "brand"} />
              </div>
            ))}
            {!jobStatus.size && <div className="py-6 text-center text-[11.5px] text-muted">No jobs scheduled in this range.</div>}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
              <div><div className="text-[9.5px] uppercase tracking-[0.07em] text-muted">Completed</div><div className="text-[14px] font-bold text-ink">{completed}</div></div>
              <div><div className="text-[9.5px] uppercase tracking-[0.07em] text-muted">Prior period</div><div className="text-[14px] font-bold text-ink">{prevJobs.length}</div></div>
              <div><div className="text-[9.5px] uppercase tracking-[0.07em] text-muted">Calls</div><div className="text-[14px] font-bold text-ink">{calls.length}</div></div>
              <div><div className="text-[9.5px] uppercase tracking-[0.07em] text-muted">Connect rate</div><div className="text-[14px] font-bold text-ink">{pct(connected, calls.length)}%</div></div>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[10.5px] text-muted">
        <span>Range: {range.label}</span>
        <span>·</span>
        <a href={`/api/reports/export?dataset=leads&${query.toString()}`} className="font-semibold text-brand hover:underline">Export leads</a>
        <a href={`/api/reports/export?dataset=attendance&${query.toString()}`} className="font-semibold text-brand hover:underline">Export attendance</a>
        <span className="ml-auto flex items-center gap-1"><Building2 size={11} /> Reports respect your role-based data scope.</span>
      </div>
    </>
  );
}
