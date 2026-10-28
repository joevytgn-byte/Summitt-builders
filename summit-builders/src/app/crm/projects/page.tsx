import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { AlertTriangle, HardHat, Plus, TrendingUp } from "lucide-react";
import { requireModule } from "@/lib/access";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/options";
import { PRIORITIES, PROJECT_STATUSES, fmtDate, money, number, statusMeta } from "@/lib/utils";
import { resolveRange } from "@/lib/dates";
import { Avatar, Badge, EmptyState, PageHeader, Progress, StatCard } from "@/components/ui";
import { FilterBar, ViewToggle } from "@/components/filters";
import { Pagination, SortTh } from "@/components/table";
import { ActionModal } from "@/components/action-form";
import { createProject } from "@/app/actions/projects";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("projects");
  const params = await searchParams;
  const str = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const q = str("q");
  const status = str("status");
  const type = str("type");
  const manager = str("manager");
  const sort = str("sort") || "createdAt";
  const dir = (str("dir") || "desc") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(str("page")) || 1);
  const resolved = str("range") ? resolveRange({ range: str("range"), from: str("from"), to: str("to") }) : null;

  const where: Prisma.ProjectWhereInput = {
    AND: [
      status ? { status } : {},
      type ? { projectType: type } : {},
      manager ? { managerId: manager } : {},
      resolved ? { createdAt: { gte: resolved.from, lte: resolved.to } } : {},
      q
        ? {
            OR: [
              { projectNo: { contains: q } },
              { name: { contains: q } },
              { customer: { name: { contains: q } } },
              { customer: { company: { contains: q } } },
              { serviceAddress: { contains: q } },
            ],
          }
        : {},
    ],
  };

  const orderBy: Prisma.ProjectOrderByWithRelationInput =
    sort === "value" ? { contractValue: dir }
    : sort === "progress" ? { progress: dir }
    : sort === "status" ? { status: dir }
    : sort === "projectNo" ? { projectNo: dir }
    : sort === "end" ? { expectedEnd: dir }
    : { createdAt: dir };

  const [projects, total, options, all] = await Promise.all([
    db.project.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, company: true, city: true } },
        manager: { select: { firstName: true, lastName: true, avatarColor: true } },
        _count: { select: { jobs: true } },
        jobs: { select: { status: true, scheduledDate: true } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.project.count({ where }),
    getFormOptions(),
    db.project.findMany({ select: { status: true, contractValue: true, progress: true } }),
  ]);

  const active = all.filter((p) => ["PENDING", "SCHEDULED", "ACTIVE", "ON_HOLD", "DELAYED"].includes(p.status)).length;
  const value = all.reduce((s, p) => s + p.contractValue, 0);
  const avgProgress = all.length ? Math.round(all.reduce((s, p) => s + p.progress, 0) / all.length) : 0;
  const delayed = all.filter((p) => p.status === "DELAYED" || p.status === "ON_HOLD").length;

  const filterDefs = [
    { key: "status", label: "All statuses", options: PROJECT_STATUSES.map((s) => ({ value: s, label: statusMeta(s).label })), width: "150px" },
    { key: "type", label: "All types", options: ["Residential", "Commercial", "Industrial", "Repair / Service"].map((t) => ({ value: t, label: t })), width: "150px" },
    { key: "manager", label: "All managers", options: options.managers.map((m) => ({ value: m.id, label: m.name })), width: "160px" },
  ];

  const newProject = (
    <ActionModal
      trigger={<button className="btn btn-primary"><Plus size={15} /> New project</button>}
      title="Create a project"
      subtitle="Projects coordinate every job, crew and deliverable for a contract."
      size="lg"
      action={createProject}
      submitLabel="Create project"
      successRedirect="/crm/projects"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2"><label className="label" htmlFor="name">Project name<span className="req">*</span></label><input id="name" name="name" className="input" required placeholder="e.g. Hayes primary bath renovation" /></div>
        <div className="field">
          <label className="label" htmlFor="customerId">Customer<span className="req">*</span></label>
          <select id="customerId" name="customerId" className="select" required defaultValue="">
            <option value="" disabled>Select a customer…</option>
            {options.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
          </select>
        </div>
        <div className="field"><label className="label" htmlFor="serviceId">Service</label>
          <select id="serviceId" name="serviceId" className="select" defaultValue=""><option value="">General</option>{options.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <div className="field"><label className="label" htmlFor="projectType">Type</label>
          <select id="projectType" name="projectType" className="select" defaultValue="Residential"><option>Residential</option><option>Commercial</option><option>Industrial</option><option>Repair / Service</option></select>
        </div>
        <div className="field"><label className="label" htmlFor="contractValue">Contract value</label><input id="contractValue" name="contractValue" className="input" inputMode="decimal" placeholder="0" /></div>
        <div className="field"><label className="label" htmlFor="managerId">Project manager</label>
          <select id="managerId" name="managerId" className="select" defaultValue=""><option value="">Unassigned</option>{options.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        </div>
        <div className="field"><label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="select" defaultValue="PENDING">{PROJECT_STATUSES.map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}</select>
        </div>
        <div className="field"><label className="label" htmlFor="startDate">Start date</label><input id="startDate" name="startDate" type="date" className="input" /></div>
        <div className="field"><label className="label" htmlFor="expectedEnd">Expected completion</label><input id="expectedEnd" name="expectedEnd" type="date" className="input" /></div>
        <div className="field"><label className="label" htmlFor="priority">Priority</label>
          <select id="priority" name="priority" className="select" defaultValue="MEDIUM">{PRIORITIES.map((p) => <option key={p} value={p}>{statusMeta(p).label}</option>)}</select>
        </div>
        <div className="field"><label className="label" htmlFor="progress">Progress %</label><input id="progress" name="progress" className="input" inputMode="numeric" defaultValue="0" /></div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="serviceAddress">Service address</label><input id="serviceAddress" name="serviceAddress" className="input" placeholder="Defaults to customer address" /></div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="description">Scope</label><textarea id="description" name="description" className="textarea" rows={2} /></div>
      </div>
    </ActionModal>
  );

  return (
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Projects"
        subtitle="The contract-level view of active work: budget, schedule, crew and job progress."
        actions={newProject}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active projects" value={number(active)} foot={<span>{all.length} total</span>} icon={<HardHat size={16} />} />
        <StatCard label="Contract value" value={money(value, { compact: true })} foot={<span>across all projects</span>} icon={<TrendingUp size={16} />} />
        <StatCard label="Average progress" value={`${avgProgress}%`} foot={<span>weighted by project</span>} icon={<HardHat size={16} />} />
        <StatCard label="Needs attention" value={number(delayed)} foot={<span>delayed or on hold</span>} icon={<AlertTriangle size={16} />} />
      </div>

      <div className="card overflow-hidden">
        <FilterBar placeholder="Search project no, name, customer…" filters={filterDefs} showRange>
          <ViewToggle boardLabel="Cards" tableLabel="Table" />
        </FilterBar>

        {total === 0 ? (
          <EmptyState icon={<HardHat />} title="No projects found" description="Convert an accepted estimate or create a project directly." />
        ) : str("view") === "board" ? (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/crm/projects/${p.id}`} className="card card-pad hover:border-line2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted">{p.projectNo}</div>
                    <div className="mt-1 text-[13px] font-[700] leading-snug text-ink">{p.name}</div>
                  </div>
                  <Badge value={p.status} />
                </div>
                <div className="mt-1.5 text-[11px] text-muted">{p.customer.company ?? p.customer.name} · {p.customer.city}</div>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="mono font-bold text-ink">{money(p.contractValue, { compact: true })}</span>
                  <span className="text-muted">{p._count.jobs} jobs</span>
                </div>
                <div className="mt-2 flex items-center gap-2"><Progress value={p.progress} className="flex-1" /><span className="w-8 text-right text-[10px] font-semibold text-muted">{p.progress}%</span></div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                  {p.manager ? (
                    <span className="flex items-center gap-1.5"><Avatar name={`${p.manager.firstName} ${p.manager.lastName}`} color={p.manager.avatarColor} size="sm" /><span className="text-[10.5px] text-muted">{p.manager.firstName} {p.manager.lastName}</span></span>
                  ) : <span className="text-[10px] text-amber-600">No manager</span>}
                  <span className="text-[10px] text-muted">{p.expectedEnd ? `Due ${fmtDate(p.expectedEnd, "MMM d")}` : "No due date"}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <SortTh label="Project" column="projectNo" pathname="/crm/projects" params={params} />
                    <th>Customer</th>
                    <th>Manager</th>
                    <SortTh label="Value" column="value" pathname="/crm/projects" params={params} align="right" />
                    <SortTh label="Progress" column="progress" pathname="/crm/projects" params={params} />
                    <th className="text-right">Jobs</th>
                    <SortTh label="Due" column="end" pathname="/crm/projects" params={params} />
                    <SortTh label="Status" column="status" pathname="/crm/projects" params={params} />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} data-clickable="true">
                      <td>
                        <Link href={`/crm/projects/${p.id}`} className="cell-strong hover:text-brand">{p.name}</Link>
                        <div className="cell-sub mono">{p.projectNo} · {p.projectType}</div>
                      </td>
                      <td>
                        <Link href={`/crm/customers/${p.customer.id}`} className="hover:text-brand">{p.customer.company ?? p.customer.name}</Link>
                        <div className="cell-sub">{p.customer.city}</div>
                      </td>
                      <td>
                        {p.manager ? (
                          <span className="flex items-center gap-1.5"><Avatar name={`${p.manager.firstName} ${p.manager.lastName}`} color={p.manager.avatarColor} size="sm" /><span className="text-[11.5px]">{p.manager.firstName}</span></span>
                        ) : <span className="text-[11px] text-muted">—</span>}
                      </td>
                      <td className="text-right mono font-semibold text-ink">{money(p.contractValue, { compact: true })}</td>
                      <td>
                        <div className="flex w-[110px] items-center gap-2"><Progress value={p.progress} className="flex-1" /><span className="text-[10px] font-semibold text-muted">{p.progress}%</span></div>
                      </td>
                      <td className="text-right mono text-[11.5px]">{p._count.jobs}</td>
                      <td className="nowrap text-[11.5px]">{p.expectedEnd ? fmtDate(p.expectedEnd, "MMM d") : <span className="text-muted">—</span>}</td>
                      <td><Badge value={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} pathname="/crm/projects" params={params} />
          </>
        )}
      </div>
    </>
  );
}
