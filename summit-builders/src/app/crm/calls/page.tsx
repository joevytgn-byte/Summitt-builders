import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Phone, PhoneCall, PhoneIncoming, PhoneMissed, Plus } from "lucide-react";
import { requireModule, callScope } from "@/lib/access";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/options";
import { CALL_OUTCOMES, fmtDate, fmtTime, number, pct, statusMeta } from "@/lib/utils";
import { resolveRange } from "@/lib/dates";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui";
import { FilterBar } from "@/components/filters";
import { Pagination, SortTh } from "@/components/table";
import { ActionModal } from "@/components/action-form";
import { createCall } from "@/app/actions/calls";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function CallsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("calls");
  const params = await searchParams;
  const str = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const q = str("q");
  const outcome = str("outcome");
  const direction = str("direction");
  const employee = str("employee");
  const sort = str("sort") || "startedAt";
  const dir = (str("dir") || "desc") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(str("page")) || 1);
  const resolved = str("range") ? resolveRange({ range: str("range"), from: str("from"), to: str("to") }) : null;

  const where: Prisma.CallWhereInput = {
    AND: [
      callScope(user),
      outcome ? { outcome } : {},
      direction ? { direction } : {},
      employee ? { employeeId: employee } : {},
      resolved ? { startedAt: { gte: resolved.from, lte: resolved.to } } : {},
      q
        ? {
            OR: [
              { customer: { name: { contains: q } } },
              { customer: { company: { contains: q } } },
              { lead: { title: { contains: q } } },
              { notes: { contains: q } },
              { employee: { firstName: { contains: q } } },
              { employee: { lastName: { contains: q } } },
            ],
          }
        : {},
    ],
  };

  const orderBy: Prisma.CallOrderByWithRelationInput =
    sort === "duration" ? { durationSec: dir }
    : sort === "outcome" ? { outcome: dir }
    : sort === "employee" ? { employee: { firstName: dir } }
    : { startedAt: dir };

  const [calls, total, options, all] = await Promise.all([
    db.call.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, avatarColor: true, position: true } },
        customer: { select: { id: true, name: true, company: true } },
        lead: { select: { id: true, leadNo: true, title: true } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.call.count({ where }),
    getFormOptions(),
    db.call.findMany({ where: callScope(user), select: { outcome: true, durationSec: true, connected: true, direction: true, startedAt: true } }),
  ]);

  const connected = all.filter((c) => c.connected).length;
  const totalMins = Math.round(all.reduce((s, c) => s + c.durationSec, 0) / 60);
  const todayCalls = all.filter((c) => fmtDate(c.startedAt, "yyyy-MM-dd") === fmtDate(new Date(), "yyyy-MM-dd")).length;
  const followUp = await db.call.count({ where: { AND: [callScope(user), { followUpRequired: true }] } });

  const filterDefs = [
    { key: "outcome", label: "All outcomes", options: CALL_OUTCOMES.map((o) => ({ value: o, label: statusMeta(o).label })), width: "150px" },
    { key: "direction", label: "Both directions", options: [{ value: "OUTGOING", label: "Outgoing" }, { value: "INCOMING", label: "Incoming" }] },
    { key: "employee", label: "All team", options: options.employees.map((e) => ({ value: e.id, label: e.name })), width: "160px" },
  ];

  const logCall = (
    <ActionModal
      trigger={<button className="btn btn-primary"><Plus size={15} /> Log a call</button>}
      title="Log a call"
      subtitle="Calls update lead contact status and can create a follow-up."
      size="lg"
      action={createCall}
      submitLabel="Save call"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field">
          <label className="label" htmlFor="customerId">Customer</label>
          <select id="customerId" name="customerId" className="select" defaultValue="">
            <option value="">No customer</option>
            {options.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="leadId">Lead</label>
          <select id="leadId" name="leadId" className="select" defaultValue="">
            <option value="">No lead</option>
            {options.leads.map((l) => <option key={l.id} value={l.id}>{l.leadNo} · {l.title}</option>)}
          </select>
        </div>
        {!["SALES_REP", "FIELD"].includes(user.role) && (
          <div className="field">
            <label className="label" htmlFor="employeeId">Team member</label>
            <select id="employeeId" name="employeeId" className="select" defaultValue={user.employeeId ?? ""}>
              <option value="">Me</option>
              {options.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        )}
        <div className="field"><label className="label" htmlFor="date">Date</label><input id="date" name="date" type="date" className="input" defaultValue={fmtDate(new Date(), "yyyy-MM-dd")} /></div>
        <div className="field"><label className="label" htmlFor="direction">Direction</label>
          <select id="direction" name="direction" className="select" defaultValue="OUTGOING"><option value="OUTGOING">Outgoing</option><option value="INCOMING">Incoming</option></select>
        </div>
        <div className="field"><label className="label" htmlFor="callType">Call type</label>
          <select id="callType" name="callType" className="select" defaultValue="Sales"><option>Sales</option><option>Follow-up</option><option>Dispatch</option><option>Support</option></select>
        </div>
        <div className="field"><label className="label" htmlFor="startTime">Start time</label><input id="startTime" name="startTime" type="time" className="input" defaultValue="09:00" /></div>
        <div className="field"><label className="label" htmlFor="durationMins">Duration (minutes)</label><input id="durationMins" name="durationMins" className="input" inputMode="numeric" defaultValue="15" /></div>
        <div className="field"><label className="label" htmlFor="outcome">Outcome</label>
          <select id="outcome" name="outcome" className="select" defaultValue="CONNECTED">{CALL_OUTCOMES.map((o) => <option key={o} value={o}>{statusMeta(o).label}</option>)}</select>
        </div>
        <div className="field"><label className="label" htmlFor="followUpDate">Follow-up date</label><input id="followUpDate" name="followUpDate" type="date" className="input" /></div>
        <div className="field sm:col-span-2">
          <label className="check-row"><input type="checkbox" name="followUpRequired" className="checkbox" /> Follow-up required</label>
        </div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="notes">Notes</label><textarea id="notes" name="notes" className="textarea" rows={3} placeholder="What was discussed? Next step?" /></div>
      </div>
    </ActionModal>
  );

  return (
    <>
      <PageHeader
        eyebrow="Conversations"
        title="Calls"
        subtitle="Every inbound and outbound call, tied to the customer and lead it belongs to."
        actions={logCall}
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Calls logged", value: number(all.length), hint: `${todayCalls} today`, icon: <PhoneCall size={15} /> },
          { label: "Connect rate", value: `${pct(connected, all.length)}%`, hint: `${connected} connected`, icon: <PhoneIncoming size={15} /> },
          { label: "Talk time", value: `${number(totalMins)}m`, hint: "total logged", icon: <Phone size={15} /> },
          { label: "Follow-ups", value: number(followUp), hint: "required", icon: <PhoneMissed size={15} /> },
        ].map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <div className="flex items-center justify-between"><div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">{s.label}</div><span className="text-muted">{s.icon}</span></div>
            <div className="mt-1 text-[19px] font-[750] tracking-[-0.04em] text-ink">{s.value}</div>
            <div className="text-[10px] text-muted">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <FilterBar placeholder="Search customer, lead or notes…" filters={filterDefs} showRange />
        {total === 0 ? (
          <EmptyState icon={<Phone />} title="No calls found" description="Log a call or adjust your filters." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <SortTh label="When" column="startedAt" pathname="/crm/calls" params={params} />
                    <th>Contact</th>
                    <SortTh label="Team member" column="employee" pathname="/crm/calls" params={params} />
                    <th>Type</th>
                    <SortTh label="Outcome" column="outcome" pathname="/crm/calls" params={params} />
                    <SortTh label="Duration" column="duration" pathname="/crm/calls" params={params} align="right" />
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((c) => (
                    <tr key={c.id}>
                      <td className="nowrap">
                        <div className="text-[11.5px] font-medium text-ink">{fmtDate(c.startedAt, "MMM d, yyyy")}</div>
                        <div className="cell-sub">{fmtTime(c.startedAt)} · {c.direction === "INCOMING" ? "Inbound" : "Outbound"}</div>
                      </td>
                      <td>
                        {c.customer ? (
                          <Link href={`/crm/customers/${c.customer.id}`} className="cell-strong hover:text-brand">{c.customer.company ?? c.customer.name}</Link>
                        ) : c.lead ? (
                          <Link href={`/crm/leads/${c.lead.id}`} className="cell-strong hover:text-brand">{c.lead.title}</Link>
                        ) : <span className="text-muted">Unlinked call</span>}
                        {c.customer && c.lead && <div className="cell-sub"><Link href={`/crm/leads/${c.lead.id}`} className="hover:text-brand">{c.lead.leadNo}</Link></div>}
                      </td>
                      <td>
                        <span className="flex items-center gap-1.5">
                          <Avatar name={`${c.employee.firstName} ${c.employee.lastName}`} color={c.employee.avatarColor} size="sm" />
                          <span>
                            <span className="block text-[11.5px]">{c.employee.firstName} {c.employee.lastName}</span>
                            <span className="block text-[9.5px] text-muted">{c.employee.position}</span>
                          </span>
                        </span>
                      </td>
                      <td className="text-[11.5px]">{c.callType}</td>
                      <td><Badge value={c.outcome} /></td>
                      <td className="text-right mono text-[11.5px]">{Math.max(1, Math.round(c.durationSec / 60))}m</td>
                      <td className="max-w-[280px]">
                        {c.notes ? <span className="line-clamp-2 text-[11px] text-ink2">{c.notes}</span> : <span className="text-[11px] text-muted">—</span>}
                        {c.followUpRequired && <div className="mt-1 text-[9.5px] font-semibold text-amber-600">Follow-up {c.followUpDate ? fmtDate(c.followUpDate, "MMM d") : "required"}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} pathname="/crm/calls" params={params} />
          </>
        )}
      </div>
    </>
  );
}
