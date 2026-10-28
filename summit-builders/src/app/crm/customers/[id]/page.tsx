import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Building2, CalendarDays, CheckCircle2, FileText, HardHat, Mail, MapPin, Pencil, Phone, Plus, Target, Truck,
} from "lucide-react";
import { requireModule, customerScope } from "@/lib/access";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/options";
import { LEAD_SOURCES, fmtDate, fmtDateTime, money, statusMeta, timeAgo } from "@/lib/utils";
import { Avatar, Badge, EmptyState, MetaRow, PageHeader, Progress, StatCard } from "@/components/ui";
import { ActionButton, ActionModal, InlineNoteForm, StatusSelect } from "@/components/action-form";
import { EstimateItemsEditor } from "@/components/estimate-items";
import { addCustomerNote, setCustomerStatus, updateCustomer } from "@/app/actions/customers";
import { createLead } from "@/app/actions/leads";
import { createEstimate } from "@/app/actions/estimates";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("customers");
  const { id } = await params;

  const customer = await db.customer.findFirst({
    where: { AND: [{ id }, customerScope(user)] },
    include: {
      assignedRep: true,
      leads: { orderBy: { createdAt: "desc" }, include: { service: { select: { name: true } }, assignedTo: { select: { firstName: true, lastName: true, avatarColor: true } } } },
      requests: { orderBy: { createdAt: "desc" }, include: { service: { select: { name: true } } } },
      estimates: { orderBy: { createdAt: "desc" }, include: { items: { select: { id: true } } } },
      projects: { orderBy: { createdAt: "desc" }, include: { manager: { select: { firstName: true, lastName: true } }, _count: { select: { jobs: true } } } },
      jobs: { orderBy: { scheduledDate: "desc" }, take: 8, include: { assignments: { include: { employee: { select: { firstName: true, lastName: true, avatarColor: true } } } } } },
      calls: { orderBy: { startedAt: "desc" }, take: 6, include: { employee: { select: { firstName: true, lastName: true } } } },
      activities: { orderBy: { createdAt: "desc" }, take: 25 },
    },
  });
  if (!customer) notFound();

  const options = await getFormOptions();
  const contractValue = customer.projects.reduce((s, p) => s + p.contractValue, 0);
  const openWork = customer.projects.filter((p) => ["PENDING", "SCHEDULED", "ACTIVE", "ON_HOLD", "DELAYED"].includes(p.status)).length;
  const wonLeads = customer.leads.filter((l) => l.status === "WON").length;
  const openPipeline = customer.leads.filter((l) => !["WON", "LOST"].includes(l.status)).reduce((s, l) => s + l.estimatedValue, 0);
  const latestProject = customer.projects[0];

  const statusOptions = ["ACTIVE", "INACTIVE", "ARCHIVED"].map((s) => ({ value: s, label: statusMeta(s).label }));

  return (
    <>
      <Link href="/crm/customers" className="mb-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted hover:text-ink">
        <ArrowLeft size={13} /> Back to customers
      </Link>

      <PageHeader
        eyebrow={`${customer.customerNo} · Customer since ${fmtDate(customer.createdAt, "MMM yyyy")}`}
        title={customer.company ?? customer.name}
        subtitle={`${customer.company ? `${customer.name} · ` : ""}${customer.serviceAddress}, ${customer.city}, ${customer.state} ${customer.zip}`}
        actions={
          <>
            {user.role !== "SALES_REP" && (
              <StatusSelect value={customer.status} options={statusOptions} action={setCustomerStatus.bind(null, customer.id)} label="Change customer status" width={136} />
            )}
            <ActionModal
              trigger={<button className="btn btn-outline"><Pencil size={14} /> Edit</button>}
              title="Edit customer"
              subtitle={customer.customerNo}
              size="lg"
              action={updateCustomer}
              submitLabel="Save changes"
            >
              <input type="hidden" name="id" value={customer.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="field"><label className="label" htmlFor="name">Full name</label><input id="name" name="name" className="input" defaultValue={customer.name} /></div>
                <div className="field"><label className="label" htmlFor="company">Company</label><input id="company" name="company" className="input" defaultValue={customer.company ?? ""} /></div>
                <div className="field"><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" className="input" defaultValue={customer.phone} /></div>
                <div className="field"><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" defaultValue={customer.email ?? ""} /></div>
                <div className="field sm:col-span-2"><label className="label" htmlFor="serviceAddress">Service address</label><input id="serviceAddress" name="serviceAddress" className="input" defaultValue={customer.serviceAddress} /></div>
                <div className="field"><label className="label" htmlFor="city">City</label><input id="city" name="city" className="input" defaultValue={customer.city} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="field"><label className="label" htmlFor="state">State</label><input id="state" name="state" className="input" defaultValue={customer.state} /></div>
                  <div className="field"><label className="label" htmlFor="zip">ZIP</label><input id="zip" name="zip" className="input" defaultValue={customer.zip} /></div>
                </div>
                <div className="field"><label className="label" htmlFor="leadSource">Lead source</label>
                  <select id="leadSource" name="leadSource" className="select" defaultValue={customer.leadSource}>
                    {[...new Set([customer.leadSource, ...LEAD_SOURCES])].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field"><label className="label" htmlFor="assignedRepId">Assigned rep</label>
                  <select id="assignedRepId" name="assignedRepId" className="select" defaultValue={customer.assignedRepId ?? ""}>
                    <option value="">Unassigned</option>
                    {options.salesEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="field sm:col-span-2"><label className="label" htmlFor="notes">Notes</label><textarea id="notes" name="notes" className="textarea" rows={2} defaultValue={customer.notes ?? ""} /></div>
              </div>
            </ActionModal>
            <ActionModal
              trigger={<button className="btn btn-primary"><Plus size={14} /> New lead</button>}
              title="Create a lead"
              subtitle={`For ${customer.name}`}
              size="lg"
              action={createLead}
              submitLabel="Create lead"
              successRedirect="/crm/leads"
            >
              <input type="hidden" name="customerId" value={customer.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="field sm:col-span-2"><label className="label" htmlFor="title">Lead title</label><input id="title" name="title" className="input" required placeholder="e.g. Kitchen refresh" /></div>
                <div className="field"><label className="label" htmlFor="serviceId">Service</label>
                  <select id="serviceId" name="serviceId" className="select" defaultValue=""><option value="">Not selected</option>{options.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                </div>
                <div className="field"><label className="label" htmlFor="estimatedValue">Estimated value</label><input id="estimatedValue" name="estimatedValue" className="input" inputMode="decimal" /></div>
                <div className="field"><label className="label" htmlFor="source">Source</label><select id="source" name="source" className="select" defaultValue="Phone">{LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
                <div className="field"><label className="label" htmlFor="assignedToId">Assigned rep</label>
                  <select id="assignedToId" name="assignedToId" className="select" defaultValue={customer.assignedRepId ?? ""}>
                    <option value="">Unassigned</option>{options.salesEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="field sm:col-span-2"><label className="label" htmlFor="description">Description</label><textarea id="description" name="description" className="textarea" rows={2} /></div>
              </div>
            </ActionModal>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Lifetime contract value" value={money(contractValue, { compact: true })} foot={<span>{customer.projects.length} projects · {wonLeads} won</span>} icon={<Building2 size={16} />} />
        <StatCard label="Open pipeline" value={money(openPipeline, { compact: true })} foot={<span>{customer.leads.length} total leads</span>} icon={<Target size={16} />} />
        <StatCard label="Active projects" value={openWork} foot={<span>{latestProject ? `Latest ${latestProject.projectNo}` : "No projects yet"}</span>} icon={<HardHat size={16} />} href="/crm/projects" />
        <StatCard label="Open requests" value={customer.requests.filter((r) => !["COMPLETED", "CLOSED", "CANCELLED"].includes(r.status)).length} foot={<span>{customer.calls.length} recent calls</span>} icon={<Truck size={16} />} href="/crm/requests" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Customer timeline</div><div className="card-sub">Every interaction across leads, estimates, projects and jobs</div></div>
            </div>
            <div className="p-5">
              <InlineNoteForm action={addCustomerNote} hidden={{ customerId: customer.id }} placeholder="Log a note, preference or site detail…" />
              {customer.activities.length ? (
                <div className="timeline mt-5">
                  {customer.activities.map((a) => (
                    <div key={a.id} className="timeline-item">
                      <span className="timeline-dot"><CheckCircle2 size={12} /></span>
                      <div className="timeline-body">
                        <div className="timeline-title">{a.title}</div>
                        <div className="timeline-meta">{a.actorName ?? "System"} · {fmtDateTime(a.createdAt)}</div>
                        {a.description && <div className="timeline-text">{a.description}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="No activity yet" description="Notes, calls and status changes will appear here." />}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Leads</div><div className="card-sub">{customer.leads.length} opportunities</div></div>
              <Link href="/crm/pipeline" className="text-[11px] font-semibold text-brand hover:underline">Pipeline</Link>
            </div>
            {customer.leads.length ? (
              <div className="divide-y divide-line">
                {customer.leads.slice(0, 6).map((l) => (
                  <Link key={l.id} href={`/crm/leads/${l.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-panel2">
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-semibold text-ink">{l.title}</div>
                      <div className="text-[10.5px] text-muted">{l.leadNo} · {l.service?.name ?? "General"} · {l.source}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="mono text-[12px] font-semibold text-ink">{money(l.estimatedValue, { compact: true })}</span>
                      <Badge value={l.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : <EmptyState title="No leads" description="Create a lead to start the sales process." />}
          </section>

          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Projects & jobs</div><div className="card-sub">Delivery history</div></div>
              <Link href="/crm/projects" className="text-[11px] font-semibold text-brand hover:underline">All projects</Link>
            </div>
            {customer.projects.length ? (
              <div className="divide-y divide-line">
                {customer.projects.map((p) => (
                  <Link key={p.id} href={`/crm/projects/${p.id}`} className="block px-5 py-3 hover:bg-panel2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-semibold text-ink">{p.name}</div>
                        <div className="text-[10.5px] text-muted">{p.projectNo} · {p._count.jobs} jobs · {p.manager ? `${p.manager.firstName} ${p.manager.lastName}` : "No manager"}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="mono text-[12px] font-semibold text-ink">{money(p.contractValue, { compact: true })}</span>
                        <Badge value={p.status} />
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={p.progress} className="flex-1" />
                      <span className="w-8 text-right text-[10px] font-semibold text-muted">{p.progress}%</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <EmptyState title="No projects yet" description="Won estimates convert into projects and kickoff jobs." />}
            {customer.jobs.length > 0 && (
              <div className="border-t border-line">
                <div className="px-5 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Recent jobs</div>
                {customer.jobs.map((j) => (
                  <Link key={j.id} href={`/crm/jobs/${j.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-panel2">
                    <div className="min-w-0">
                      <div className="truncate text-[11.5px] font-medium text-ink">{j.jobType}</div>
                      <div className="text-[10px] text-muted">{j.jobNo} · {j.scheduledDate ? fmtDate(j.scheduledDate, "MMM d") : "Unscheduled"} {j.startTime ?? ""}</div>
                    </div>
                    <Badge value={j.status} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Estimates</div><div className="card-sub">{customer.estimates.length} prepared</div></div>
              <Link href="/crm/estimates" className="text-[11px] font-semibold text-brand hover:underline">All estimates</Link>
            </div>
            {customer.estimates.length ? (
              <div className="divide-y divide-line">
                {customer.estimates.map((e) => (
                  <Link key={e.id} href={`/crm/estimates/${e.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-panel2">
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-semibold text-ink">{e.title}</div>
                      <div className="text-[10.5px] text-muted">{e.estimateNo} · {e.items.length} line items · valid to {fmtDate(e.validUntil)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="mono text-[12px] font-semibold text-ink">{money(e.total)}</span>
                      <Badge value={e.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : <EmptyState title="No estimates" description="Create one from a lead to send pricing." />}
          </section>

          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Service requests</div><div className="card-sub">{customer.requests.length} received</div></div>
              <Link href="/crm/requests" className="text-[11px] font-semibold text-brand hover:underline">All requests</Link>
            </div>
            {customer.requests.length ? (
              <div className="divide-y divide-line">
                {customer.requests.map((r) => (
                  <Link key={r.id} href={`/crm/requests/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-panel2">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-medium text-ink">{r.description}</div>
                      <div className="text-[10.5px] text-muted">{r.requestNo} · {r.service?.name ?? "General"} · {timeAgo(r.createdAt)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2"><Badge value={r.urgency} /><Badge value={r.status} /></div>
                  </Link>
                ))}
              </div>
            ) : <EmptyState title="No requests" description="Website and phone requests appear here." />}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="card">
            <div className="card-header"><div><div className="card-title">Contact</div></div></div>
            <div className="p-4">
              <div className="space-y-2.5 text-[12px] text-ink2">
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2 hover:text-brand"><Phone size={13} className="text-muted" /> {customer.phone}</a>
                {customer.email && <a href={`mailto:${customer.email}`} className="flex items-center gap-2 break-all hover:text-brand"><Mail size={13} className="text-muted" /> {customer.email}</a>}
                <div className="flex items-start gap-2"><MapPin size={13} className="mt-0.5 text-muted" /> {customer.serviceAddress}<br />{customer.city}, {customer.state} {customer.zip}</div>
                <div className="flex items-center gap-2"><CalendarDays size={13} className="text-muted" /> Since {fmtDate(customer.createdAt)}</div>
              </div>
              {customer.assignedRep && (
                <div className="mt-4 flex items-center gap-2.5 border-t border-line pt-3">
                  <Avatar name={`${customer.assignedRep.firstName} ${customer.assignedRep.lastName}`} color={customer.assignedRep.avatarColor} />
                  <div>
                    <div className="text-[12px] font-semibold text-ink">{customer.assignedRep.firstName} {customer.assignedRep.lastName}</div>
                    <div className="text-[10px] text-muted">Account rep · {customer.assignedRep.position}</div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header"><div><div className="card-title">Recent calls</div><div className="card-sub">{customer.calls.length} logged</div></div></div>
            {customer.calls.length ? (
              <div className="divide-y divide-line">
                {customer.calls.map((c) => (
                  <div key={c.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-medium text-ink">{c.employee.firstName} {c.employee.lastName}</span>
                      <Badge value={c.outcome} />
                    </div>
                    <div className="text-[10px] text-muted">{fmtDateTime(c.startedAt)} · {Math.max(1, Math.round(c.durationSec / 60))} min · {c.direction.toLowerCase()}</div>
                    {c.notes && <div className="mt-1 text-[10.5px] text-ink2">{c.notes}</div>}
                  </div>
                ))}
              </div>
            ) : <div className="px-4 py-6 text-center text-[11px] text-muted">No calls logged yet.</div>}
          </section>

          <section className="card p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Record details</div>
            <MetaRow label="Customer ID" value={<span className="mono">{customer.customerNo}</span>} />
            <MetaRow label="Lead source" value={customer.leadSource} />
            <MetaRow label="Status" value={<Badge value={customer.status} />} />
            <MetaRow label="Billing address" value={customer.billingAddress ?? "Same as service"} />
            <MetaRow label="Created" value={fmtDateTime(customer.createdAt)} />
            <MetaRow label="Updated" value={timeAgo(customer.updatedAt)} />
            {customer.notes && (
              <div className="mt-3 rounded-lg border border-line bg-panel2 p-3 text-[11.5px] leading-relaxed text-ink2">{customer.notes}</div>
            )}
          </section>

          <section className="card">
            <div className="card-header"><div><div className="card-title">Quick actions</div></div></div>
            <div className="flex flex-col gap-2 p-4">
              <ActionModal
                trigger={<button className="btn btn-outline btn-sm w-full justify-start"><FileText size={13} /> New estimate</button>}
                title="Create estimate"
                subtitle={`For ${customer.name}`}
                action={createEstimate}
                submitLabel="Create estimate"
                successRedirect="/crm/estimates"
              >
                <input type="hidden" name="customerId" value={customer.id} />
                <input type="hidden" name="status" value="DRAFT" />
                <div className="field"><label className="label" htmlFor="title">Title</label><input id="title" name="title" className="input" required defaultValue={`${customer.company ?? customer.name} — estimate`} /></div>
                <div className="field mt-4"><label className="label">Line items</label>
                  <EstimateItemsEditor defaultItems={[{ description: "Labor & materials", category: "LABOR", quantity: 1, unit: "ea", unitPrice: 0 }]} />
                </div>
              </ActionModal>
              <Link href={`/crm/requests?q=${encodeURIComponent(customer.name)}`} className="btn btn-outline btn-sm w-full justify-start"><Plus size={13} /> View requests</Link>
              <Link href={`/crm/jobs?customer=${customer.id}`} className="btn btn-outline btn-sm w-full justify-start"><Truck size={13} /> Schedule a job</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
