import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { FileText, Plus, TrendingUp, Trophy, Send } from "lucide-react";
import { requireModule, estimateScope } from "@/lib/access";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/options";
import { ESTIMATE_STATUSES, fmtDate, money, number, pct, statusMeta } from "@/lib/utils";
import { resolveRange } from "@/lib/dates";
import { Badge, EmptyState, PageHeader, Progress } from "@/components/ui";
import { FilterBar } from "@/components/filters";
import { Pagination, SortTh } from "@/components/table";
import { ActionModal } from "@/components/action-form";
import { EstimateItemsEditor } from "@/components/estimate-items";
import { createEstimate } from "@/app/actions/estimates";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("estimates");
  const params = await searchParams;
  const str = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const q = str("q");
  const status = str("status");
  const customer = str("customer");
  const sort = str("sort") || "createdAt";
  const dir = (str("dir") || "desc") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(str("page")) || 1);
  const resolved = str("range") ? resolveRange({ range: str("range"), from: str("from"), to: str("to") }) : null;

  const where: Prisma.EstimateWhereInput = {
    AND: [
      estimateScope(user),
      status ? { status } : {},
      customer ? { customerId: customer } : {},
      resolved ? { createdAt: { gte: resolved.from, lte: resolved.to } } : {},
      q
        ? {
            OR: [
              { estimateNo: { contains: q } },
              { title: { contains: q } },
              { customer: { name: { contains: q } } },
              { customer: { company: { contains: q } } },
            ],
          }
        : {},
    ],
  };

  const orderBy: Prisma.EstimateOrderByWithRelationInput =
    sort === "total" ? { total: dir }
    : sort === "status" ? { status: dir }
    : sort === "customer" ? { customer: { name: dir } }
    : sort === "estimateNo" ? { estimateNo: dir }
    : { createdAt: dir };

  const [estimates, total, options, all] = await Promise.all([
    db.estimate.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, company: true } },
        lead: { select: { id: true, leadNo: true } },
        createdBy: { select: { name: true } },
        _count: { select: { items: true } },
        project: { select: { id: true, projectNo: true } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.estimate.count({ where }),
    getFormOptions(),
    db.estimate.findMany({ where: estimateScope(user), select: { status: true, total: true } }),
  ]);

  const totalValue = all.reduce((s, e) => s + e.total, 0);
  const accepted = all.filter((e) => e.status === "ACCEPTED");
  const acceptedValue = accepted.reduce((s, e) => s + e.total, 0);
  const sent = all.filter((e) => ["SENT", "VIEWED"].includes(e.status)).length;
  const decided = all.filter((e) => ["ACCEPTED", "REJECTED", "EXPIRED"].includes(e.status)).length;

  const filterDefs = [
    { key: "status", label: "All statuses", options: ESTIMATE_STATUSES.map((s) => ({ value: s, label: statusMeta(s).label })), width: "150px" },
    { key: "customer", label: "All customers", options: options.customers.map((c) => ({ value: c.id, label: c.company ?? c.name })), width: "180px" },
  ];

  const newEstimate = (
    <ActionModal
      trigger={<button className="btn btn-primary"><Plus size={15} /> New estimate</button>}
      title="Create an estimate"
      subtitle="Line items calculate subtotal, tax and total automatically."
      size="lg"
      action={createEstimate}
      submitLabel="Save estimate"
      successRedirect="/crm/estimates"
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
          <label className="label" htmlFor="leadId">Lead</label>
          <select id="leadId" name="leadId" className="select" defaultValue="">
            <option value="">No linked lead</option>
            {options.leads.map((l) => <option key={l.id} value={l.id}>{l.leadNo} · {l.title}</option>)}
          </select>
        </div>
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="title">Estimate title<span className="req">*</span></label>
          <input id="title" name="title" className="input" required placeholder="e.g. Primary bath renovation — 1180 S Gaylord" />
        </div>
        <div className="field">
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="select" defaultValue="DRAFT">
            {ESTIMATE_STATUSES.map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="validUntil">Valid until</label>
          <input id="validUntil" name="validUntil" type="date" className="input" defaultValue={fmtDate(new Date(Date.now() + 30 * 86_400_000), "yyyy-MM-dd")} />
        </div>
        <div className="field sm:col-span-2">
          <label className="label">Line items</label>
          <EstimateItemsEditor defaultItems={[{ description: "Labor & materials", category: "LABOR", quantity: 1, unit: "ea", unitPrice: 0 }]} />
        </div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="notes">Notes to customer</label><textarea id="notes" name="notes" className="textarea" rows={2} /></div>
      </div>
    </ActionModal>
  );

  return (
    <>
      <PageHeader
        eyebrow="Pricing"
        title="Estimates"
        subtitle="Build itemized proposals, track the customer decision, then convert accepted work into a project."
        actions={newEstimate}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Estimates", value: number(all.length), hint: `${sent} awaiting decision`, icon: <FileText size={15} /> },
          { label: "Quoted value", value: money(totalValue, { compact: true }), hint: "all time", icon: <TrendingUp size={15} /> },
          { label: "Accepted value", value: money(acceptedValue, { compact: true }), hint: `${accepted.length} accepted`, icon: <Trophy size={15} /> },
          { label: "Close rate", value: `${pct(accepted.length, decided)}%`, hint: `${decided} decided`, icon: <Send size={15} /> },
        ].map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <div className="flex items-center justify-between"><div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">{s.label}</div><span className="text-muted">{s.icon}</span></div>
            <div className="mt-1 text-[19px] font-[750] tracking-[-0.04em] text-ink">{s.value}</div>
            <div className="text-[10px] text-muted">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <FilterBar placeholder="Search estimate no, title, customer…" filters={filterDefs} showRange />
        {total === 0 ? (
          <EmptyState icon={<FileText />} title="No estimates found" description="Create an estimate from a lead or start one here." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <SortTh label="Estimate" column="estimateNo" pathname="/crm/estimates" params={params} />
                    <SortTh label="Customer" column="customer" pathname="/crm/estimates" params={params} />
                    <th>Prepared by</th>
                    <th className="text-right">Items</th>
                    <SortTh label="Total" column="total" pathname="/crm/estimates" params={params} align="right" />
                    <SortTh label="Status" column="status" pathname="/crm/estimates" params={params} />
                    <th>Valid until</th>
                    <th>Project</th>
                  </tr>
                </thead>
                <tbody>
                  {estimates.map((e) => (
                    <tr key={e.id} data-clickable="true">
                      <td>
                        <Link href={`/crm/estimates/${e.id}`} className="cell-strong hover:text-brand">{e.title}</Link>
                        <div className="cell-sub mono">{e.estimateNo}{e.lead ? ` · ${e.lead.leadNo}` : ""}</div>
                      </td>
                      <td>
                        <Link href={`/crm/customers/${e.customer.id}`} className="hover:text-brand">{e.customer.company ?? e.customer.name}</Link>
                      </td>
                      <td className="text-[11.5px] text-muted">{e.createdBy?.name ?? "—"}</td>
                      <td className="text-right mono text-[11.5px]">{e._count.items}</td>
                      <td className="text-right mono font-semibold text-ink">{money(e.total)}</td>
                      <td><Badge value={e.status} /></td>
                      <td className="nowrap text-[11.5px]">{fmtDate(e.validUntil, "MMM d, yyyy")}</td>
                      <td className="text-[11.5px]">
                        {e.project ? <Link href={`/crm/projects/${e.project.id}`} className="text-brand hover:underline">{e.project.projectNo}</Link> : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} pathname="/crm/estimates" params={params} />
          </>
        )}
      </div>
    </>
  );
}
