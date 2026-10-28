import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Building2, Mail, MapPin, Phone, Plus, Users } from "lucide-react";
import { requireModule, customerScope } from "@/lib/access";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/options";
import { LEAD_SOURCES, fmtDate, money, number, pct, statusMeta } from "@/lib/utils";
import { Avatar, Badge, EmptyState, PageHeader, Progress } from "@/components/ui";
import { FilterBar, ViewToggle } from "@/components/filters";
import { Pagination, SortTh } from "@/components/table";
import { ActionModal } from "@/components/action-form";
import { createCustomer } from "@/app/actions/customers";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("customers");
  const params = await searchParams;
  const str = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const q = str("q");
  const status = str("status");
  const rep = str("rep");
  const city = str("city");
  const sort = str("sort") || "createdAt";
  const dir = (str("dir") || "desc") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(str("page")) || 1);

  const scope = customerScope(user);
  const where: Prisma.CustomerWhereInput = {
    AND: [
      scope,
      status ? { status } : {},
      rep ? { assignedRepId: rep } : {},
      city ? { city } : {},
      q
        ? {
            OR: [
              { name: { contains: q } },
              { company: { contains: q } },
              { customerNo: { contains: q } },
              { phone: { contains: q } },
              { email: { contains: q } },
              { city: { contains: q } },
              { serviceAddress: { contains: q } },
            ],
          }
        : {},
    ],
  };

  const orderBy: Prisma.CustomerOrderByWithRelationInput =
    sort === "name" ? { name: dir }
    : sort === "city" ? { city: dir }
    : sort === "status" ? { status: dir }
    : sort === "customerNo" ? { customerNo: dir }
    : { createdAt: dir };

  const [customers, total, options, activeCount, cityRows, allCount] = await Promise.all([
    db.customer.findMany({
      where,
      include: {
        assignedRep: { select: { firstName: true, lastName: true, avatarColor: true } },
        _count: { select: { leads: true, projects: true, requests: true } },
        projects: { select: { contractValue: true, status: true } },
        leads: { select: { status: true } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.customer.count({ where }),
    getFormOptions(),
    db.customer.count({ where: { AND: [scope, { status: "ACTIVE" }] } }),
    db.customer.groupBy({ by: ["city"], where: scope, _count: true, orderBy: { _count: { city: "desc" } }, take: 12 }),
    db.customer.count({ where: scope }),
  ]);

  const newThisMonth = await db.customer.count({
    where: { AND: [scope, { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }] },
  });
  const repeatBase = await db.customer.findMany({ where: scope, select: { _count: { select: { projects: true } } } });
  const repeat = repeatBase.filter((c) => c._count.projects > 1).length;

  const filterDefs = [
    { key: "status", label: "All statuses", options: ["ACTIVE", "INACTIVE", "ARCHIVED"].map((s) => ({ value: s, label: statusMeta(s).label })) },
    { key: "rep", label: "All reps", options: options.salesEmployees.map((e) => ({ value: e.id, label: e.name })), width: "158px" },
    { key: "city", label: "All cities", options: cityRows.map((c) => ({ value: c.city, label: `${c.city} (${c._count})` })), width: "150px" },
  ];

  const newCustomer = (
    <ActionModal
      trigger={<button className="btn btn-primary"><Plus size={15} /> New customer</button>}
      title="Add a customer"
      subtitle="Duplicate detection runs against phone and email."
      size="lg"
      action={createCustomer}
      submitLabel="Create customer"
      successRedirect="/crm/customers"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label className="label" htmlFor="name">Full name<span className="req">*</span></label>
          <input id="name" name="name" className="input" required placeholder="Eleanor Hayes" />
        </div>
        <div className="field">
          <label className="label" htmlFor="company">Company</label>
          <input id="company" name="company" className="input" placeholder="Optional" />
        </div>
        <div className="field">
          <label className="label" htmlFor="phone">Phone<span className="req">*</span></label>
          <input id="phone" name="phone" className="input" required placeholder="(303) 555-0142" />
        </div>
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" placeholder="name@example.com" />
        </div>
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="serviceAddress">Service address<span className="req">*</span></label>
          <input id="serviceAddress" name="serviceAddress" className="input" required placeholder="1180 S Gaylord St" />
        </div>
        <div className="field">
          <label className="label" htmlFor="city">City<span className="req">*</span></label>
          <input id="city" name="city" className="input" required placeholder="Denver" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="field">
            <label className="label" htmlFor="state">State</label>
            <input id="state" name="state" className="input" defaultValue="CO" />
          </div>
          <div className="field">
            <label className="label" htmlFor="zip">ZIP<span className="req">*</span></label>
            <input id="zip" name="zip" className="input" required placeholder="80210" />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="leadSource">Lead source</label>
          <select id="leadSource" name="leadSource" className="select" defaultValue="Phone">
            {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="assignedRepId">Assigned rep</label>
          <select id="assignedRepId" name="assignedRepId" className="select" defaultValue={user.role === "SALES_REP" ? user.employeeId ?? "" : ""}>
            <option value="">Unassigned</option>
            {options.salesEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" className="textarea" rows={2} placeholder="Access details, preferences, gate codes…" />
        </div>
      </div>
    </ActionModal>
  );

  return (
    <>
      <PageHeader
        eyebrow="Relationships"
        title="Customers"
        subtitle="One record per household or business, with every lead, project, job and conversation in a single timeline."
        actions={newCustomer}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total customers", value: number(allCount), hint: `${activeCount} active` },
          { label: "New this month", value: number(newThisMonth), hint: "created since the 1st" },
          { label: "Repeat clients", value: pct(repeat, allCount) + "%", hint: `${repeat} with 2+ projects` },
          { label: "Cities served", value: number(cityRows.length), hint: "in your scope" },
        ].map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">{s.label}</div>
            <div className="mt-1 text-[19px] font-[750] tracking-[-0.04em] text-ink">{s.value}</div>
            <div className="text-[10px] text-muted">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <FilterBar placeholder="Search name, company, phone, address…" filters={filterDefs}>
          <ViewToggle boardLabel="Cards" tableLabel="Table" />
        </FilterBar>

        {total === 0 ? (
          <EmptyState
            icon={<Users />}
            title="No customers found"
            description={q || status ? "No records match these filters." : "Add the first customer to start a relationship record."}
          />
        ) : str("view") === "board" ? (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {customers.map((c) => {
              const value = c.projects.reduce((s, p) => s + p.contractValue, 0);
              const active = c.projects.filter((p) => ["ACTIVE", "SCHEDULED", "PENDING"].includes(p.status)).length;
              return (
                <Link key={c.id} href={`/crm/customers/${c.id}`} className="card card-pad hover:border-line2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.name} size="lg" />
                      <div>
                        <div className="text-[13px] font-semibold text-ink">{c.company ?? c.name}</div>
                        <div className="text-[10.5px] text-muted">{c.company ? c.name : c.customerNo}</div>
                      </div>
                    </div>
                    <Badge value={c.status} />
                  </div>
                  <div className="mt-3 space-y-1 text-[11px] text-muted">
                    <div className="flex items-center gap-1.5"><Phone size={11} /> {c.phone}</div>
                    <div className="flex items-center gap-1.5"><MapPin size={11} /> {c.city}, {c.state}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-2.5 text-center">
                    <div><div className="text-[13px] font-bold text-ink">{c._count.leads}</div><div className="text-[9px] uppercase tracking-[0.06em] text-muted">Leads</div></div>
                    <div><div className="text-[13px] font-bold text-ink">{active}</div><div className="text-[9px] uppercase tracking-[0.06em] text-muted">Active</div></div>
                    <div><div className="text-[12px] font-bold text-ink">{money(value, { compact: true })}</div><div className="text-[9px] uppercase tracking-[0.06em] text-muted">Value</div></div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <SortTh label="Customer" column="name" pathname="/crm/customers" params={params} />
                    <SortTh label="City" column="city" pathname="/crm/customers" params={params} />
                    <th>Contact</th>
                    <th>Assigned rep</th>
                    <th className="text-right">Leads</th>
                    <th className="text-right">Projects</th>
                    <th className="text-right">Contract value</th>
                    <SortTh label="Since" column="createdAt" pathname="/crm/customers" params={params} />
                    <SortTh label="Status" column="status" pathname="/crm/customers" params={params} />
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const value = c.projects.reduce((s, p) => s + p.contractValue, 0);
                    return (
                      <tr key={c.id} data-clickable="true">
                        <td>
                          <Link href={`/crm/customers/${c.id}`} className="cell-strong hover:text-brand">{c.company ?? c.name}</Link>
                          <div className="cell-sub mono">{c.customerNo}{c.company ? ` · ${c.name}` : ""}</div>
                        </td>
                        <td className="text-[11.5px]">{c.city}, {c.state}</td>
                        <td>
                          <div className="text-[11.5px]">{c.phone}</div>
                          {c.email && <div className="cell-sub flex items-center gap-1"><Mail size={9} /> {c.email}</div>}
                        </td>
                        <td>
                          {c.assignedRep ? (
                            <span className="flex items-center gap-1.5">
                              <Avatar name={`${c.assignedRep.firstName} ${c.assignedRep.lastName}`} color={c.assignedRep.avatarColor} size="sm" />
                              <span className="text-[11.5px]">{c.assignedRep.firstName}</span>
                            </span>
                          ) : <span className="text-[11px] text-amber-600">Unassigned</span>}
                        </td>
                        <td className="text-right mono text-[11.5px]">{c._count.leads}</td>
                        <td className="text-right mono text-[11.5px]">{c._count.projects}</td>
                        <td className="text-right mono font-semibold text-ink">{money(value, { compact: true })}</td>
                        <td className="nowrap text-[11.5px] text-muted">{fmtDate(c.createdAt, "MMM yyyy")}</td>
                        <td><Badge value={c.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} pathname="/crm/customers" params={params} />
          </>
        )}
      </div>
    </>
  );
}
