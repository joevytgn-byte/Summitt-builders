import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Activity, ArrowRight, Clock, Filter, ScrollText, ShieldCheck, UserRound } from "lucide-react";
import { requireModule } from "@/lib/access";
import { db } from "@/lib/db";
import { resolveRange } from "@/lib/dates";
import { fmtDateTime, statusMeta, timeAgo } from "@/lib/utils";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { FilterBar } from "@/components/filters";
import { Pagination } from "@/components/table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const ACTIONS = ["LOGIN", "CREATE", "UPDATE", "DELETE", "PERMISSION", "STATUS", "ASSIGN", "EXPORT"];

const MODULE_HREF: Record<string, string> = {
  Leads: "/crm/leads",
  Customers: "/crm/customers",
  "Service Requests": "/crm/requests",
  Estimates: "/crm/estimates",
  Projects: "/crm/projects",
  Jobs: "/crm/jobs",
  Dispatch: "/crm/jobs",
  Employees: "/crm/employees",
  Attendance: "/crm/attendance",
  Users: "/crm/admin/users",
  "Website Content": "/crm/admin/website",
  Services: "/crm/admin/website",
  Portfolio: "/crm/admin/website",
  Testimonials: "/crm/admin/website",
  "Service Areas": "/crm/admin/website",
  Settings: "/crm/admin/settings",
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireModule("audit");
  const params = await searchParams;
  const str = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const q = str("q");
  const action = str("action");
  const module = str("module");
  const userFilter = str("user");
  const page = Math.max(1, Number(str("page")) || 1);
  const resolved = str("range") ? resolveRange({ range: str("range"), from: str("from"), to: str("to") }) : null;

  const where: Prisma.AuditLogWhereInput = {
    AND: [
      action ? { action } : {},
      module ? { module } : {},
      userFilter ? { userName: userFilter } : {},
      resolved ? { createdAt: { gte: resolved.from, lte: resolved.to } } : {},
      q
        ? {
            OR: [
              { recordLabel: { contains: q } },
              { recordId: { contains: q } },
              { userName: { contains: q } },
              { module: { contains: q } },
              { previousValue: { contains: q } },
              { newValue: { contains: q } },
            ],
          }
        : {},
    ],
  };

  const [logs, total, modules, users, summary, todayCount] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ["module"], _count: true, orderBy: { _count: { module: "desc" } } }),
    db.auditLog.groupBy({ by: ["userName"], _count: true, orderBy: { _count: { userName: "desc" } }, take: 30 }),
    db.auditLog.groupBy({ by: ["action"], _count: true }),
    db.auditLog.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);

  const actionCount = (key: string) => summary.find((s) => s.action === key)?._count ?? 0;

  const filterDefs = [
    { key: "action", label: "All actions", options: ACTIONS.map((a) => ({ value: a, label: a.charAt(0) + a.slice(1).toLowerCase() })), width: "140px" },
    { key: "module", label: "All modules", options: modules.map((m) => ({ value: m.module, label: `${m.module} (${m._count})` })), width: "185px" },
    { key: "user", label: "All users", options: users.map((u) => ({ value: u.userName, label: `${u.userName} (${u._count})` })), width: "170px" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Security & compliance"
        title="Audit logs"
        subtitle="Every create, update, permission change and sign-in, with the previous and new values."
        actions={<a href="#audit-table" className="btn btn-outline"><Filter size={14} /> Filters</a>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total events" value={total} foot={<span>{todayCount} today</span>} icon={<ScrollText size={16} />} />
        <StatCard label="Creates" value={actionCount("CREATE")} foot={<span>{actionCount("UPDATE")} updates · {actionCount("DELETE")} deletes</span>} icon={<Activity size={16} />} />
        <StatCard label="Permission changes" value={actionCount("PERMISSION")} foot={<span>{actionCount("LOGIN")} sign-ins tracked</span>} icon={<ShieldCheck size={16} />} />
        <StatCard label="Modules touched" value={modules.length} foot={<span>{users.length} active users</span>} icon={<Filter size={16} />} />
      </div>

      <div className="card overflow-hidden" id="audit-table">
        <FilterBar placeholder="Search record, user, previous or new value…" filters={filterDefs} showRange>
          <span className="flex items-center gap-1.5 text-[10.5px] text-muted"><Clock size={11} /> Newest first</span>
        </FilterBar>

        {logs.length === 0 ? (
          <EmptyState icon={<ScrollText />} title="No audit entries" description="Try widening the date range or clearing filters." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Module</th>
                    <th>Record</th>
                    <th>Change</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="nowrap">
                        <div className="text-[11.5px] font-medium text-ink">{fmtDateTime(log.createdAt)}</div>
                        <div className="cell-sub">{timeAgo(log.createdAt)}</div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <UserRound size={12} className="text-muted" />
                          <span className="text-[11.5px] font-medium text-ink2">{log.userName}</span>
                        </div>
                      </td>
                      <td><Badge value={log.action} /></td>
                      <td className="text-[11.5px]">
                        {MODULE_HREF[log.module] ? (
                          <Link href={MODULE_HREF[log.module]} className="hover:text-brand">{log.module}</Link>
                        ) : log.module}
                      </td>
                      <td className="max-w-[190px]">
                        <div className="truncate text-[11.5px] font-medium text-ink2">{log.recordLabel ?? "—"}</div>
                        {log.recordId && <div className="mono truncate text-[9.5px] text-muted">{log.recordId}</div>}
                      </td>
                      <td className="max-w-[300px]">
                        {log.previousValue || log.newValue ? (
                          <div className="flex flex-wrap items-center gap-1 text-[10.5px]">
                            {log.previousValue && <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 line-through decoration-red-300 dark:bg-red-950/40 dark:text-red-300">{log.previousValue}</span>}
                            {log.previousValue && log.newValue && <ArrowRight size={10} className="text-muted" />}
                            {log.newValue && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{log.newValue}</span>}
                          </div>
                        ) : <span className="text-[10.5px] text-muted">—</span>}
                      </td>
                      <td>
                        <div className="text-[10.5px] text-muted">{log.ip ?? "local"}</div>
                        {log.userAgent && <div className="max-w-[120px] truncate text-[9px] text-muted/80" title={log.userAgent}>{log.userAgent}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} pathname="/crm/admin/audit" params={params} />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {modules.slice(0, 4).map((m) => (
          <div key={m.module} className="card flex items-center justify-between p-3.5">
            <div>
              <div className="text-[11.5px] font-semibold text-ink">{m.module}</div>
              <div className="text-[9.5px] text-muted">{statusMeta(m.module).label !== m.module ? statusMeta(m.module).label : "module activity"}</div>
            </div>
            <span className="font-mono text-[13px] font-bold text-ink">{m._count}</span>
          </div>
        ))}
      </div>
    </>
  );
}
