import Link from "next/link";
import { Plus, Target, Download } from "lucide-react";
import { requireModule, leadScope } from "@/lib/access";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/options";
import { LEAD_SOURCES, LEAD_STAGES, PRIORITIES, fmtDate, money, number, pct, statusMeta } from "@/lib/utils";
import { resolveRange } from "@/lib/dates";
import type { Prisma } from "@prisma/client";
import { Badge, EmptyState, Avatar, PageHeader } from "@/components/ui";
import { FilterBar, ViewToggle } from "@/components/filters";
import { SortTh, Pagination } from "@/components/table";
import { LeadBoard } from "@/components/lead-board";
import { ActionModal } from "@/components/action-form";
import { createLead } from "@/app/actions/leads";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("leads");
  const params = await searchParams;
  const str = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const q = str("q");
  const status = str("status");
  const source = str("source");
  const rep = str("rep");
  const priority = str("priority");
  const range = str("range");
  const sort = str("sort") || "createdAt";
  const dir = (str("dir") || "desc") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(str("page")) || 1);
  const view = str("view");
  const resolved = range ? resolveRange({ range, from: str("from"), to: str("to") }) : null;

  const where = {
    AND: [
      leadScope(user),
      status ? { status } : {},
      source ? { source } : {},
      rep ? { assignedToId: rep } : {},
      priority ? { priority } : {},
      resolved ? { createdAt: { gte: resolved.from, lte: resolved.to } } : {},
      q
        ? {
            OR: [
              { leadNo: { contains: q } },
              { title: { contains: q } },
              { customer: { name: { contains: q } } },
              { customer: { company: { contains: q } } },
              { customer: { phone: { contains: q } } },
              { customer: { email: { contains: q } } },
            ],
          }
        : {},
    ],
  };

  const orderBy: Prisma.LeadOrderByWithRelationInput =
    sort === "value" ? { estimatedValue: dir as "asc" | "desc" }
    : sort === "customer" ? { customer: { name: dir } }
    : sort === "status" ? { status: dir }
    : sort === "priority" ? { priority: dir }
    : sort === "followUp" ? { nextFollowUp: dir }
    : sort === "leadNo" ? { leadNo: dir }
    : { createdAt: dir as "asc" | "desc" };

  const [leads, total, options, aggregate] = await Promise.all([
    db.lead.findMany({
      where,
      include: {
        customer: { select: { name: true, company: true, city: true, phone: true } },
        service: { select: { name: true } },
        assignedTo: { select: { firstName: true, lastName: true, avatarColor: true } },
      },
      orderBy,
      skip: view === "board" ? 0 : (page - 1) * PAGE_SIZE,
      take: view === "board" ? 500 : PAGE_SIZE,
    }),
    db.lead.count({ where }),
    getFormOptions(),
    db.lead.aggregate({ where, _sum: { estimatedValue: true } }),
  ]);

  const won = await db.lead.count({ where: { AND: [where.AND[0], { status: "WON" }] } });
  const lost = await db.lead.count({ where: { AND: [where.AND[0], { status: "LOST" }] } });
  const newCount = await db.lead.count({ where: { ...where, status: "NEW" } });

  const filterDefs = [
    { key: "status", label: "All statuses", options: LEAD_STAGES.map((s) => ({ value: s, label: statusMeta(s).label })) },
    { key: "source", label: "All sources", options: LEAD_SOURCES.map((s) => ({ value: s, label: s })) },
    { key: "rep", label: "All reps", options: options.employees.filter((e) => options.salesEmployees.some((x) => x.id === e.id)).map((e) => ({ value: e.id, label: e.name })) },
    { key: "priority", label: "All priorities", options: PRIORITIES.map((p) => ({ value: p, label: statusMeta(p).label })) },
  ];

  const newLeadModal = (
    <ActionModal
      trigger={<button className="btn btn-primary"><Plus size={15} /> New lead</button>}
      title="Create a lead"
      subtitle="Log a phone, email, referral or walk-in opportunity."
      size="lg"
      action={createLead}
      submitLabel="Create lead"
      successRedirect="/crm/leads"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="customerId">Customer<span className="req">*</span></label>
          <select id="customerId" name="customerId" className="select" required defaultValue="">
            <option value="" disabled>Select a customer…</option>
            {options.customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>
            ))}
          </select>
          <div className="field-hint">Need a new customer? <Link href="/crm/customers" className="text-brand">Create one first</Link> to avoid duplicates.</div>
        </div>
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="title">Lead title<span className="req">*</span></label>
          <input id="title" name="title" className="input" placeholder="e.g. Kitchen remodel — Hayes residence" required />
        </div>
        <div className="field">
          <label className="label" htmlFor="serviceId">Service</label>
          <select id="serviceId" name="serviceId" className="select" defaultValue="">
            <option value="">Not selected</option>
            {options.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="projectType">Project type</label>
          <select id="projectType" name="projectType" className="select" defaultValue="Residential">
            <option>Residential</option><option>Commercial</option><option>Industrial</option><option>Repair / Service</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="estimatedValue">Estimated value</label>
          <input id="estimatedValue" name="estimatedValue" className="input" inputMode="decimal" placeholder="0" defaultValue="" />
        </div>
        <div className="field">
          <label className="label" htmlFor="source">Lead source</label>
          <select id="source" name="source" className="select" defaultValue="Phone">
            {LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="assignedToId">Assigned rep</label>
          <select id="assignedToId" name="assignedToId" className="select" defaultValue={user.role === "SALES_REP" ? user.employeeId ?? "" : ""}>
            <option value="">Unassigned</option>
            {options.salesEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="priority">Priority</label>
          <select id="priority" name="priority" className="select" defaultValue="MEDIUM">
            {PRIORITIES.map((p) => <option key={p} value={p}>{statusMeta(p).label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="status">Stage</label>
          <select id="status" name="status" className="select" defaultValue="NEW">
            {LEAD_STAGES.filter((s) => s !== "WON" && s !== "LOST").map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="nextFollowUp">Next follow-up</label>
          <input id="nextFollowUp" name="nextFollowUp" type="date" className="input" />
        </div>
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" className="textarea" rows={3} placeholder="Scope, timeline, budget signals…" />
        </div>
      </div>
    </ActionModal>
  );

  return (
    <>
      <PageHeader
        eyebrow="Sales CRM"
        title="Leads"
        subtitle="Every opportunity from first contact to won or lost, with response times and follow-up tracking."
        actions={
          <>
            <Link href="/crm/reports?type=leads" className="btn btn-outline"><Download size={14} /> Reports</Link>
            {newLeadModal}
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Matching leads", value: number(total), hint: `${newCount} new` },
          { label: "Pipeline value", value: money(aggregate._sum.estimatedValue ?? 0, { compact: true }), hint: "estimated" },
          { label: "Won", value: number(won), hint: "closed won" },
          { label: "Win rate", value: pct(won, won + lost), hint: `${lost} lost` },
        ].map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">{s.label}</div>
            <div className="mt-1 text-[19px] font-[750] tracking-[-0.04em] text-ink">{s.value}</div>
            <div className="text-[10px] text-muted">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <FilterBar
          placeholder="Search leads, customers, phone…"
          filters={filterDefs}
          showRange
        >
          <ViewToggle boardLabel="Kanban" tableLabel="Table" />
        </FilterBar>

        {view === "board" ? (
          <div className="p-3">
            {total === 0 ? (
              <EmptyState icon={<Target />} title="No leads match these filters" description="Try clearing filters or create a new lead." />
            ) : (
              <LeadBoard
                leads={leads.map((l) => ({
                  id: l.id,
                  leadNo: l.leadNo,
                  title: l.title,
                  status: l.status,
                  priority: l.priority,
                  estimatedValue: l.estimatedValue,
                  customerName: l.customer.name,
                  company: l.customer.company,
                  city: l.customer.city,
                  assignedTo: l.assignedTo ? { name: `${l.assignedTo.firstName} ${l.assignedTo.lastName}`, color: l.assignedTo.avatarColor } : null,
                  nextFollowUp: l.nextFollowUp ? fmtDate(l.nextFollowUp, "MMM d") : null,
                }))}
              />
            )}
          </div>
        ) : total === 0 ? (
          <EmptyState
            icon={<Target />}
            title="No leads found"
            description={q || status ? "No records match your search. Try clearing filters." : "Website inquiries and manual leads will appear here."}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <SortTh label="Lead" column="leadNo" pathname="/crm/leads" params={params} />
                    <SortTh label="Customer" column="customer" pathname="/crm/leads" params={params} />
                    <th>Service</th>
                    <SortTh label="Value" column="value" pathname="/crm/leads" params={params} align="right" />
                    <th>Assigned</th>
                    <SortTh label="Priority" column="priority" pathname="/crm/leads" params={params} />
                    <SortTh label="Stage" column="status" pathname="/crm/leads" params={params} />
                    <SortTh label="Follow-up" column="followUp" pathname="/crm/leads" params={params} />
                    <SortTh label="Created" column="createdAt" pathname="/crm/leads" params={params} />
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} data-clickable="true">
                      <td>
                        <Link href={`/crm/leads/${l.id}`} className="cell-strong hover:text-brand">{l.title}</Link>
                        <div className="cell-sub mono">{l.leadNo} · {l.source}</div>
                      </td>
                      <td>
                        <Link href={`/crm/customers/${l.customerId}`} className="hover:text-brand">{l.customer.company ?? l.customer.name}</Link>
                        <div className="cell-sub">{l.customer.city} · {l.customer.phone}</div>
                      </td>
                      <td className="text-[11.5px]">{l.service?.name ?? "—"}</td>
                      <td className="text-right mono font-semibold text-ink">{money(l.estimatedValue)}</td>
                      <td>
                        {l.assignedTo ? (
                          <span className="flex items-center gap-1.5">
                            <Avatar name={`${l.assignedTo.firstName} ${l.assignedTo.lastName}`} color={l.assignedTo.avatarColor} size="sm" />
                            <span className="text-[11.5px]">{l.assignedTo.firstName}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-600">Unassigned</span>
                        )}
                      </td>
                      <td><Badge value={l.priority} /></td>
                      <td><Badge value={l.status} /></td>
                      <td className="nowrap text-[11.5px]">
                        {l.nextFollowUp ? (
                          <span className={l.nextFollowUp < new Date() ? "font-semibold text-red-600" : ""}>{fmtDate(l.nextFollowUp, "MMM d")}</span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="nowrap text-[11.5px] text-muted">{fmtDate(l.createdAt, "MMM d")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} pathname="/crm/leads" params={params} />
          </>
        )}
      </div>
    </>
  );
}
