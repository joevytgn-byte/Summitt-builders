import Link from "next/link";
import type { Prisma } from "@prisma/client";
import {
  ArrowUpRight, CalendarDays, FileText, HardHat, Inbox, Phone, Search, Target, Truck, UserRound, Users,
} from "lucide-react";
import { requireModule, customerScope, jobScope, leadScope, requestScope, estimateScope, callScope } from "@/lib/access";
import { db } from "@/lib/db";
import { canAccess } from "@/lib/permissions";
import { fmtDate, money, statusMeta } from "@/lib/utils";
import { Avatar, Badge, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const TAKE = 6;

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("search");
  const params = await searchParams;
  const q = (typeof params.q === "string" ? params.q : "").trim();
  const like = { contains: q };

  const [customers, leads, jobs, projects, estimates, requests, employees, calls] = q
    ? await Promise.all([
        db.customer.findMany({
          where: { AND: [customerScope(user), { OR: [{ name: like }, { company: like }, { email: like }, { phone: like }, { customerNo: like }, { city: like }] }] },
          select: { id: true, customerNo: true, name: true, company: true, city: true, phone: true },
          take: TAKE,
        }),
        db.lead.findMany({
          where: { AND: [leadScope(user), { OR: [{ leadNo: like }, { title: like }, { description: like }, { customer: { name: like } }, { customer: { company: like } }] }] },
          select: { id: true, leadNo: true, title: true, status: true, estimatedValue: true, customer: { select: { name: true, company: true } } },
          orderBy: { updatedAt: "desc" },
          take: TAKE,
        }),
        db.job.findMany({
          where: { AND: [jobScope(user), { OR: [{ jobNo: like }, { jobType: like }, { address: like }, { customer: { name: like } }, { customer: { company: like } }] }] },
          select: { id: true, jobNo: true, jobType: true, status: true, scheduledDate: true, startTime: true, customer: { select: { name: true, company: true } } },
          orderBy: { scheduledDate: "desc" },
          take: TAKE,
        }),
        db.project.findMany({
          where: { OR: [{ projectNo: like }, { name: like }, { serviceAddress: like }, { customer: { name: like } }, { customer: { company: like } }] },
          select: { id: true, projectNo: true, name: true, status: true, progress: true, contractValue: true, customer: { select: { name: true, company: true } } },
          orderBy: { updatedAt: "desc" },
          take: TAKE,
        }),
        db.estimate.findMany({
          where: { AND: [estimateScope(user), { OR: [{ estimateNo: like }, { title: like }, { customer: { name: like } }, { customer: { company: like } }] }] },
          select: { id: true, estimateNo: true, title: true, status: true, total: true, customer: { select: { name: true, company: true } } },
          orderBy: { updatedAt: "desc" },
          take: TAKE,
        }),
        db.serviceRequest.findMany({
          where: { AND: [requestScope(user), { OR: [{ requestNo: like }, { description: like }, { address: like }, { customer: { name: like } }, { customer: { company: like } }] }] },
          select: { id: true, requestNo: true, description: true, status: true, urgency: true, customer: { select: { name: true, company: true } } },
          orderBy: { createdAt: "desc" },
          take: TAKE,
        }),
        canAccess(user.role, "employees")
          ? db.employee.findMany({
              where: { OR: [{ firstName: like }, { lastName: like }, { email: like }, { position: like }, { employeeNo: like }] },
              select: { id: true, firstName: true, lastName: true, position: true, avatarColor: true, department: { select: { name: true } } },
              take: TAKE,
            })
          : Promise.resolve([]),
        canAccess(user.role, "calls")
          ? db.call.findMany({
              where: { AND: [callScope(user), { OR: [{ notes: like }, { callType: like }, { customer: { name: like } }, { customer: { company: like } }, { lead: { title: like } }] }] },
              select: { id: true, notes: true, direction: true, outcome: true, callType: true, startedAt: true, customer: { select: { name: true, company: true } }, lead: { select: { title: true } } },
              orderBy: { startedAt: "desc" },
              take: TAKE,
            })
          : Promise.resolve([]),
      ])
    : [[], [], [], [], [], [], [], []];

  const total = customers.length + leads.length + jobs.length + projects.length + estimates.length + requests.length + employees.length + calls.length;

  const groups = [
    {
      key: "customers",
      label: "Customers",
      icon: <Users size={14} />,
      href: "/crm/customers",
      count: customers.length,
      rows: customers.map((c) => ({
        id: c.id,
        href: `/crm/customers/${c.id}`,
        title: c.company ?? c.name,
        subtitle: [c.city, c.phone].filter(Boolean).join(" · "),
        right: <span className="mono text-[10px] text-muted">{c.customerNo}</span>,
      })),
    },
    {
      key: "leads",
      label: "Leads",
      icon: <Target size={14} />,
      href: "/crm/leads",
      count: leads.length,
      rows: leads.map((l) => ({
        id: l.id,
        href: `/crm/leads/${l.id}`,
        title: l.title,
        subtitle: l.customer.company ?? l.customer.name,
        right: (
          <span className="flex items-center gap-2">
            <span className="mono text-[11px] font-semibold text-ink">{money(l.estimatedValue, { compact: true })}</span>
            <Badge value={l.status} />
          </span>
        ),
      })),
    },
    {
      key: "requests",
      label: "Service requests",
      icon: <Inbox size={14} />,
      href: "/crm/requests",
      count: requests.length,
      rows: requests.map((r) => ({
        id: r.id,
        href: `/crm/requests/${r.id}`,
        title: r.description.slice(0, 90),
        subtitle: `${r.requestNo} · ${r.customer.company ?? r.customer.name}`,
        right: <Badge value={r.status} />,
      })),
    },
    {
      key: "jobs",
      label: "Jobs",
      icon: <Truck size={14} />,
      href: "/crm/jobs",
      count: jobs.length,
      rows: jobs.map((j) => ({
        id: j.id,
        href: `/crm/jobs/${j.id}`,
        title: j.jobType,
        subtitle: `${j.jobNo} · ${j.customer.company ?? j.customer.name}`,
        right: (
          <span className="flex items-center gap-2">
            <span className="text-[10.5px] text-muted">{j.scheduledDate ? `${fmtDate(j.scheduledDate, "MMM d")} ${j.startTime ?? ""}` : "Unscheduled"}</span>
            <Badge value={j.status} />
          </span>
        ),
      })),
    },
    {
      key: "projects",
      label: "Projects",
      icon: <HardHat size={14} />,
      href: "/crm/projects",
      count: projects.length,
      rows: projects.map((p) => ({
        id: p.id,
        href: `/crm/projects/${p.id}`,
        title: p.name,
        subtitle: `${p.projectNo} · ${p.customer.company ?? p.customer.name}`,
        right: (
          <span className="flex items-center gap-2">
            <span className="text-[10.5px] text-muted">{p.progress}%</span>
            <Badge value={p.status} />
          </span>
        ),
      })),
    },
    {
      key: "estimates",
      label: "Estimates",
      icon: <FileText size={14} />,
      href: "/crm/estimates",
      count: estimates.length,
      rows: estimates.map((e) => ({
        id: e.id,
        href: `/crm/estimates/${e.id}`,
        title: e.title,
        subtitle: `${e.estimateNo} · ${e.customer.company ?? e.customer.name}`,
        right: (
          <span className="flex items-center gap-2">
            <span className="mono text-[11px] font-semibold text-ink">{money(e.total, { compact: true })}</span>
            <Badge value={e.status} />
          </span>
        ),
      })),
    },
    {
      key: "employees",
      label: "Employees",
      icon: <UserRound size={14} />,
      href: "/crm/employees",
      count: employees.length,
      rows: employees.map((e) => ({
        id: e.id,
        href: `/crm/employees/${e.id}`,
        title: `${e.firstName} ${e.lastName}`,
        subtitle: `${e.position}${e.department ? ` · ${e.department.name}` : ""}`,
        right: <Avatar name={`${e.firstName} ${e.lastName}`} color={e.avatarColor} size="sm" />,
      })),
    },
    {
      key: "calls",
      label: "Calls",
      icon: <Phone size={14} />,
      href: "/crm/calls",
      count: calls.length,
      rows: calls.map((c) => ({
        id: c.id,
        href: "/crm/calls",
        title: c.notes ?? c.lead?.title ?? statusMeta(c.direction).label,
        subtitle: `${c.customer?.company ?? c.customer?.name ?? "Unlinked"} · ${fmtDate(c.startedAt, "MMM d, yyyy")}`,
        right: <Badge value={c.outcome} />,
      })),
    },
  ].filter((g) => g.count > 0);

  return (
    <>
      <PageHeader
        eyebrow="Global search"
        title={q ? `Results for “${q}”` : "Search Summit Builders"}
        subtitle={q ? `${total} matches across customers, sales, delivery and team records.` : "Find any customer, lead, job, project, estimate or teammate in one place."}
      />

      <form method="get" className="card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            autoFocus
            className="input input-icon"
            placeholder="Search by name, number, address, phone…"
            aria-label="Search"
          />
        </div>
        <button type="submit" className="btn btn-primary">Search</button>
        {q && <Link href="/crm/search" className="btn btn-ghost">Clear</Link>}
      </form>

      {!q ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="card p-5 lg:col-span-2">
            <div className="card-title mb-3">Search tips</div>
            <div className="space-y-2.5 text-[12px] text-ink2">
              <p className="flex items-start gap-2"><span className="mono rounded bg-panel2 px-1.5 py-0.5 text-[10.5px] text-muted">L-1042</span> Find a lead by its number.</p>
              <p className="flex items-start gap-2"><span className="mono rounded bg-panel2 px-1.5 py-0.5 text-[10.5px] text-muted">JOB-5021</span> Jump straight to a job and its crew.</p>
              <p className="flex items-start gap-2"><span className="mono rounded bg-panel2 px-1.5 py-0.5 text-[10.5px] text-muted">Denver</span> Search cities, addresses and service areas.</p>
              <p className="flex items-start gap-2"><span className="mono rounded bg-panel2 px-1.5 py-0.5 text-[10.5px] text-muted">Dana</span> Find a sales rep or crew member.</p>
            </div>
          </section>
          <section className="card p-5">
            <div className="card-title mb-3">Jump to</div>
            <div className="grid gap-1.5">
              {[
                { href: "/crm/leads", label: "Leads", icon: <Target size={14} /> },
                { href: "/crm/requests", label: "Service requests", icon: <Inbox size={14} /> },
                { href: "/crm/customers", label: "Customers", icon: <Users size={14} /> },
                { href: "/crm/jobs", label: "Jobs & dispatch", icon: <Truck size={14} /> },
                { href: "/crm/calendar", label: "Calendar", icon: <CalendarDays size={14} /> },
                { href: "/crm/projects", label: "Projects", icon: <HardHat size={14} /> },
              ]
                .filter((l) => l.href !== "/crm/calendar" || canAccess(user.role, "calendar"))
                .map((l) => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-ink2 hover:bg-panel2 hover:text-ink">
                    <span className="text-muted">{l.icon}</span> {l.label}
                    <ArrowUpRight size={12} className="ml-auto text-muted" />
                  </Link>
                ))}
            </div>
          </section>
        </div>
      ) : total === 0 ? (
        <div className="card px-6 py-16 text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-xl bg-panel2 text-muted"><Search size={20} /></div>
          <div className="mt-3 text-[14px] font-semibold text-ink">No matches for “{q}”</div>
          <p className="mx-auto mt-1 max-w-md text-[11.5px] text-muted">
            Check the spelling, try a partial name or a record number. Search respects your role scope, so some records may not be visible to you.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {groups.map((group) => (
            <section key={group.key} className="card overflow-hidden">
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-md bg-brand-soft text-brand">{group.icon}</span>
                  <div className="card-title">{group.label}</div>
                  <span className="kanban-count">{group.count}</span>
                </div>
                <Link href={group.href} className="text-[11px] font-semibold text-brand hover:underline">View all</Link>
              </div>
              <div className="divide-y divide-line">
                {group.rows.map((row) => (
                  <Link key={row.id} href={row.href} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-panel2">
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-semibold text-ink">{row.title}</span>
                      <span className="block truncate text-[10.5px] text-muted">{row.subtitle}</span>
                    </span>
                    <span className="shrink-0">{row.right}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
