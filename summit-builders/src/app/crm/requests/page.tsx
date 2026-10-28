import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { CheckCircle2, Inbox, Plus, Zap } from "lucide-react";
import { requireModule, requestScope } from "@/lib/access";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/options";
import { REQUEST_STATUSES, URGENCIES, fmtDate, number, statusMeta, timeAgo } from "@/lib/utils";
import { resolveRange } from "@/lib/dates";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui";
import { FilterBar } from "@/components/filters";
import { Pagination, SortTh } from "@/components/table";
import { ActionModal } from "@/components/action-form";
import { createRequest } from "@/app/actions/requests";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("requests");
  const params = await searchParams;
  const str = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const q = str("q");
  const status = str("status");
  const urgency = str("urgency");
  const service = str("service");
  const rep = str("rep");
  const sort = str("sort") || "createdAt";
  const dir = (str("dir") || "desc") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(str("page")) || 1);
  const resolved = str("range") ? resolveRange({ range: str("range"), from: str("from"), to: str("to") }) : null;

  const where: Prisma.ServiceRequestWhereInput = {
    AND: [
      requestScope(user),
      status ? { status } : {},
      urgency ? { urgency } : {},
      service ? { serviceId: service } : {},
      rep ? { assignedToId: rep } : {},
      resolved ? { createdAt: { gte: resolved.from, lte: resolved.to } } : {},
      q
        ? {
            OR: [
              { requestNo: { contains: q } },
              { description: { contains: q } },
              { customer: { name: { contains: q } } },
              { customer: { company: { contains: q } } },
              { customer: { phone: { contains: q } } },
              { city: { contains: q } },
            ],
          }
        : {},
    ],
  };

  const orderBy: Prisma.ServiceRequestOrderByWithRelationInput =
    sort === "urgency" ? { urgency: dir }
    : sort === "status" ? { status: dir }
    : sort === "requestNo" ? { requestNo: dir }
    : sort === "preferred" ? { preferredDate: dir }
    : sort === "customer" ? { customer: { name: dir } }
    : { createdAt: dir };

  const [requests, total, options, counts] = await Promise.all([
    db.serviceRequest.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, company: true, phone: true, city: true } },
        service: { select: { name: true } },
        lead: { select: { id: true, leadNo: true, status: true } },
        assignedTo: { select: { firstName: true, lastName: true, avatarColor: true } },
        _count: { select: { attachments: true } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.serviceRequest.count({ where }),
    getFormOptions(),
    db.serviceRequest.groupBy({ by: ["status"], where: requestScope(user), _count: true }),
  ]);

  const countFor = (key: string) => counts.find((c) => c.status === key)?._count ?? 0;
  const open = counts.filter((c) => !["COMPLETED", "CLOSED", "CANCELLED"].includes(c.status)).reduce((s, c) => s + c._count, 0);
  const urgent = await db.serviceRequest.count({ where: { AND: [requestScope(user), { urgency: { in: ["URGENT", "EMERGENCY"] } }, { status: { notIn: ["COMPLETED", "CLOSED", "CANCELLED"] } }] } });
  const avgResponse = await db.serviceRequest.findMany({
    where: { AND: [requestScope(user), { lead: { responseMins: { not: null } } }] },
    select: { lead: { select: { responseMins: true } } },
    take: 200,
    orderBy: { createdAt: "desc" },
  });
  const responseValues = avgResponse.map((r) => r.lead?.responseMins ?? 0).filter((n) => n > 0);
  const avgMins = responseValues.length ? Math.round(responseValues.reduce((s, n) => s + n, 0) / responseValues.length) : 0;

  const filterDefs = [
    { key: "status", label: "All statuses", options: REQUEST_STATUSES.map((s) => ({ value: s, label: statusMeta(s).label })), width: "158px" },
    { key: "urgency", label: "All urgency", options: URGENCIES.map((u) => ({ value: u, label: statusMeta(u).label })) },
    ...(options.services.length ? [{ key: "service", label: "All services", options: options.services.map((s) => ({ value: s.id, label: s.name })), width: "160px" }] : []),
  ];

  const newRequest = (
    <ActionModal
      trigger={<button className="btn btn-primary"><Plus size={15} /> New request</button>}
      title="Log a service request"
      subtitle="Captures the request and opens a matching sales lead."
      size="lg"
      action={createRequest}
      submitLabel="Create request"
      successRedirect="/crm/requests"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="customerId">Customer<span className="req">*</span></label>
          <select id="customerId" name="customerId" className="select" required defaultValue="">
            <option value="" disabled>Select a customer…</option>
            {options.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
          </select>
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
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="description">Work requested<span className="req">*</span></label>
          <textarea id="description" name="description" className="textarea" rows={3} required placeholder="What does the customer need?" />
        </div>
        <div className="field">
          <label className="label" htmlFor="urgency">Urgency</label>
          <select id="urgency" name="urgency" className="select" defaultValue="NORMAL">
            {URGENCIES.map((u) => <option key={u} value={u}>{statusMeta(u).label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="select" defaultValue="NEW">
            {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="source">Source</label>
          <select id="source" name="source" className="select" defaultValue="Phone">
            <option>Phone</option><option>Website</option><option>Email</option><option>Referral</option><option>Manual</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="assignedToId">Assigned to</label>
          <select id="assignedToId" name="assignedToId" className="select" defaultValue={user.role === "SALES_REP" ? user.employeeId ?? "" : ""}>
            <option value="">Unassigned</option>
            {options.salesEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="preferredDate">Preferred date</label>
          <input id="preferredDate" name="preferredDate" type="date" className="input" />
        </div>
        <div className="field">
          <label className="label" htmlFor="estimatedSize">Estimated size</label>
          <input id="estimatedSize" name="estimatedSize" className="input" placeholder="e.g. 1,200 sq ft" />
        </div>
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="address">Service address</label>
          <input id="address" name="address" className="input" placeholder="Defaults to the customer's service address" />
        </div>
        <div className="field">
          <label className="label" htmlFor="city">City</label>
          <input id="city" name="city" className="input" />
        </div>
        <div className="field">
          <label className="label" htmlFor="zip">ZIP</label>
          <input id="zip" name="zip" className="input" inputMode="numeric" />
        </div>
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="notes">Internal notes</label>
          <textarea id="notes" name="notes" className="textarea" rows={2} />
        </div>
      </div>
    </ActionModal>
  );

  return (
    <>
      <PageHeader
        eyebrow="Inbound demand"
        title="Service requests"
        subtitle="Website inquiries, phone requests and site-visit bookings — each one opens a tracked sales lead automatically."
        actions={newRequest}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Open requests", value: number(open), hint: `${countFor("NEW")} new` },
          { label: "Urgent / emergency", value: number(urgent), hint: "needs same-day contact" },
          { label: "Estimate pending", value: number(countFor("ESTIMATE_PENDING")), hint: "awaiting pricing" },
          { label: "Avg. response", value: avgMins ? `${avgMins}m` : "—", hint: "first contact time" },
        ].map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">{s.label}</div>
            <div className="mt-1 text-[19px] font-[750] tracking-[-0.04em] text-ink">{s.value}</div>
            <div className="text-[10px] text-muted">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <FilterBar placeholder="Search request no, customer, city…" filters={filterDefs} showRange />

        {total === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title="No service requests found"
            description={q || status ? "No records match your filters. Try clearing them." : "Website inquiries will appear here the moment they are submitted."}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <SortTh label="Request" column="requestNo" pathname="/crm/requests" params={params} />
                    <SortTh label="Customer" column="customer" pathname="/crm/requests" params={params} />
                    <th>Service</th>
                    <SortTh label="Urgency" column="urgency" pathname="/crm/requests" params={params} />
                    <SortTh label="Status" column="status" pathname="/crm/requests" params={params} />
                    <th>Assigned</th>
                    <SortTh label="Preferred" column="preferred" pathname="/crm/requests" params={params} />
                    <SortTh label="Received" column="createdAt" pathname="/crm/requests" params={params} />
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} data-clickable="true">
                      <td>
                        <Link href={`/crm/requests/${r.id}`} className="cell-strong hover:text-brand">{r.requestNo}</Link>
                        <div className="cell-sub">{r.source}{r._count.attachments ? ` · ${r._count.attachments} file${r._count.attachments === 1 ? "" : "s"}` : ""}</div>
                      </td>
                      <td>
                        <Link href={`/crm/customers/${r.customer.id}`} className="hover:text-brand">{r.customer.company ?? r.customer.name}</Link>
                        <div className="cell-sub">{r.customer.city} · {r.customer.phone}</div>
                      </td>
                      <td className="text-[11.5px]">{r.service?.name ?? "General"}</td>
                      <td><Badge value={r.urgency} /></td>
                      <td><Badge value={r.status} /></td>
                      <td>
                        {r.assignedTo ? (
                          <span className="flex items-center gap-1.5">
                            <Avatar name={`${r.assignedTo.firstName} ${r.assignedTo.lastName}`} color={r.assignedTo.avatarColor} size="sm" />
                            <span className="text-[11.5px]">{r.assignedTo.firstName}</span>
                          </span>
                        ) : <span className="text-[11px] text-amber-600">Unassigned</span>}
                      </td>
                      <td className="nowrap text-[11.5px]">{r.preferredDate ? fmtDate(r.preferredDate, "MMM d") : <span className="text-muted">—</span>}</td>
                      <td className="nowrap text-[11.5px] text-muted">{timeAgo(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} pathname="/crm/requests" params={params} />
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10.5px] text-muted">
        <span className="flex items-center gap-1.5"><Zap size={11} className="text-brand" /> Website inquiries create a request + lead in one transaction.</span>
        <span className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-emerald-600" /> Status changes roll up to the linked lead stage.</span>
        <span className="flex items-center gap-1.5"><Inbox size={11} /> Attachments stay attached to the request for office review.</span>
      </div>
    </>
  );
}
