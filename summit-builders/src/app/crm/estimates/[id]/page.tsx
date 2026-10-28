import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, CheckCircle2, Copy, FileText, Mail, MapPin, Pencil, Phone, Printer, Send, Sparkles,
} from "lucide-react";
import { requireModule, estimateScope } from "@/lib/access";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/options";
import { ESTIMATE_STATUSES, fmtDate, fmtDateTime, humanize, money, statusMeta } from "@/lib/utils";
import { Avatar, Badge, EmptyState, MetaRow, PageHeader, Progress } from "@/components/ui";
import { ActionButton, ActionModal, StatusSelect } from "@/components/action-form";
import { EstimateItemsEditor } from "@/components/estimate-items";
import { convertEstimateToProject, reviseEstimate, updateEstimate, updateEstimateStatus } from "@/app/actions/estimates";

export const dynamic = "force-dynamic";

export default async function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("estimates");
  const { id } = await params;

  const estimate = await db.estimate.findFirst({
    where: { AND: [{ id }, estimateScope(user)] },
    include: {
      customer: true,
      lead: { select: { id: true, leadNo: true, title: true, status: true, assignedTo: { select: { firstName: true, lastName: true, avatarColor: true } } } },
      items: { orderBy: { sortOrder: "asc" } },
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      project: { select: { id: true, projectNo: true, name: true, status: true, progress: true } },
    },
  });
  if (!estimate) notFound();

  const options = await getFormOptions();
  const activities = await db.activity.findMany({
    where: estimate.leadId ? { leadId: estimate.leadId } : { customerId: estimate.customerId },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const statusOptions = ESTIMATE_STATUSES.map((s) => ({ value: s, label: statusMeta(s).label }));
  const canConvert = !estimate.project && !["REJECTED", "EXPIRED"].includes(estimate.status);
  const stageIndex = ESTIMATE_STATUSES.indexOf(estimate.status as (typeof ESTIMATE_STATUSES)[number]);
  const progress = estimate.status === "REJECTED" || estimate.status === "EXPIRED" ? 100 : Math.round(((stageIndex + 1) / 4) * 100);

  return (
    <>
      <Link href="/crm/estimates" className="mb-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted hover:text-ink">
        <ArrowLeft size={13} /> Back to estimates
      </Link>

      <PageHeader
        eyebrow={`${estimate.estimateNo} · ${humanize(estimate.status)}`}
        title={estimate.title}
        subtitle={`${estimate.customer.company ?? estimate.customer.name} · prepared ${fmtDate(estimate.createdAt)} · valid through ${fmtDate(estimate.validUntil)}`}
        actions={
          <>
            <StatusSelect value={estimate.status} options={statusOptions} action={updateEstimateStatus.bind(null, estimate.id)} label="Change estimate status" width={150} />
            <ActionButton action={reviseEstimate.bind(null, estimate.id)} label="Revise" icon={<Copy size={14} />} variant="outline" />
            <ActionModal
              trigger={<button className="btn btn-outline"><Pencil size={14} /> Edit</button>}
              title="Edit estimate"
              subtitle={estimate.estimateNo}
              size="lg"
              action={updateEstimate}
              submitLabel="Save estimate"
            >
              <input type="hidden" name="id" value={estimate.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="field sm:col-span-2"><label className="label" htmlFor="title">Title</label><input id="title" name="title" className="input" defaultValue={estimate.title} required /></div>
                <div className="field">
                  <label className="label" htmlFor="customerId">Customer</label>
                  <select id="customerId" name="customerId" className="select" defaultValue={estimate.customerId}>
                    {options.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="status">Status</label>
                  <select id="status" name="status" className="select" defaultValue={estimate.status}>
                    {ESTIMATE_STATUSES.map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="leadId">Lead</label>
                  <select id="leadId" name="leadId" className="select" defaultValue={estimate.leadId ?? ""}>
                    <option value="">No linked lead</option>
                    {options.leads.map((l) => <option key={l.id} value={l.id}>{l.leadNo} · {l.title}</option>)}
                  </select>
                </div>
                <div className="field"><label className="label" htmlFor="validUntil">Valid until</label><input id="validUntil" name="validUntil" type="date" className="input" defaultValue={fmtDate(estimate.validUntil, "yyyy-MM-dd")} /></div>
                <div className="field sm:col-span-2">
                  <label className="label">Line items</label>
                  <EstimateItemsEditor
                    discount={estimate.discount}
                    taxRate={estimate.taxRate}
                    defaultItems={estimate.items.map((i) => ({ description: i.description, category: i.category, quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice }))}
                  />
                </div>
                <div className="field sm:col-span-2"><label className="label" htmlFor="notes">Notes to customer</label><textarea id="notes" name="notes" className="textarea" rows={2} defaultValue={estimate.notes ?? ""} /></div>
              </div>
            </ActionModal>
            {canConvert && (
              <ActionModal
                trigger={<button className="btn btn-primary"><Sparkles size={14} /> Convert to project</button>}
                title="Convert estimate to project"
                subtitle="Creates the project and an unscheduled kickoff job, and marks the lead won."
                action={convertEstimateToProject}
                submitLabel="Create project"
                successRedirect="/crm/projects"
              >
                <input type="hidden" name="estimateId" value={estimate.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="field sm:col-span-2"><label className="label" htmlFor="name">Project name</label><input id="name" name="name" className="input" defaultValue={estimate.title} /></div>
                  <div className="field"><label className="label" htmlFor="managerId">Project manager</label>
                    <select id="managerId" name="managerId" className="select" defaultValue=""><option value="">Auto-assign</option>{options.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                  </div>
                  <div className="field"><label className="label" htmlFor="startDate">Start date</label><input id="startDate" name="startDate" type="date" className="input" /></div>
                  <div className="field"><label className="label" htmlFor="expectedEnd">Expected completion</label><input id="expectedEnd" name="expectedEnd" type="date" className="input" /></div>
                </div>
                <p className="mt-3 text-[11px] text-muted">Contract value is taken from the estimate total of {money(estimate.total)}.</p>
              </ActionModal>
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <section className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><FileText size={15} /></span>
                <div><div className="card-title">Proposal</div><div className="card-sub">{estimate.estimateNo}</div></div>
              </div>
              <div className="flex items-center gap-2"><Badge value={estimate.status} /><button className="btn btn-ghost btn-sm" aria-label="Print estimate"><Printer size={13} /></button></div>
            </div>
            <div className="p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted">Prepared for</div>
                  <div className="mt-1 text-[14px] font-bold text-ink">{estimate.customer.company ?? estimate.customer.name}</div>
                  <div className="text-[11.5px] text-muted">{estimate.customer.serviceAddress}, {estimate.customer.city}, {estimate.customer.state} {estimate.customer.zip}</div>
                  <div className="text-[11.5px] text-muted">{estimate.customer.phone}{estimate.customer.email ? ` · ${estimate.customer.email}` : ""}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted">Total</div>
                  <div className="text-[24px] font-[750] tracking-[-0.04em] text-ink">{money(estimate.total)}</div>
                  <div className="text-[10.5px] text-muted">Valid through {fmtDate(estimate.validUntil)}</div>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-line">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="text-right">Qty</th>
                      <th>Unit</th>
                      <th className="text-right">Unit price</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimate.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="text-[12px] font-medium text-ink">{item.description}</div>
                          <div className="cell-sub">{humanize(item.category)}</div>
                        </td>
                        <td className="text-right mono text-[11.5px]">{item.quantity}</td>
                        <td className="text-[11.5px]">{item.unit}</td>
                        <td className="text-right mono text-[11.5px]">{money(item.unitPrice)}</td>
                        <td className="text-right mono font-semibold text-ink">{money(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <div className="w-full max-w-[280px] space-y-1.5 text-[12px]">
                  <div className="flex justify-between text-muted"><span>Subtotal</span><span className="mono text-ink2">{money(estimate.subtotal)}</span></div>
                  {estimate.discount > 0 && <div className="flex justify-between text-muted"><span>Discount</span><span className="mono text-red-600">−{money(estimate.discount)}</span></div>}
                  <div className="flex justify-between text-muted"><span>Tax ({estimate.taxRate}%)</span><span className="mono text-ink2">{money(estimate.taxAmount)}</span></div>
                  <div className="flex justify-between border-t border-line pt-2 text-[14px] font-bold text-ink"><span>Total</span><span className="mono">{money(estimate.total)}</span></div>
                </div>
              </div>

              {estimate.notes && <div className="mt-4 rounded-lg border border-line bg-panel2 p-3.5 text-[12px] leading-relaxed text-ink2">{estimate.notes}</div>}

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                <ActionButton action={updateEstimateStatus.bind(null, estimate.id, "SENT")} label="Mark as sent" icon={<Send size={13} />} variant="outline" />
                <ActionButton action={updateEstimateStatus.bind(null, estimate.id, "ACCEPTED")} label="Mark accepted" icon={<CheckCircle2 size={13} />} variant="outline" />
                <span className="ml-auto text-[10.5px] text-muted">Status changes are logged to the audit trail.</span>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><div><div className="card-title">Decision history</div><div className="card-sub">Activity linked to this deal</div></div></div>
            <div className="p-5">
              {activities.length ? (
                <div className="timeline">
                  {activities.map((a) => (
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
              ) : <EmptyState title="No decision activity yet" description="Sending and accepting the estimate will appear here." />}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="card">
            <div className="card-header"><div><div className="card-title">Customer</div><div className="card-sub">{estimate.customer.customerNo}</div></div></div>
            <div className="p-4">
              <Link href={`/crm/customers/${estimate.customer.id}`} className="flex items-center gap-2.5 hover:text-brand">
                <Avatar name={estimate.customer.name} size="lg" />
                <div>
                  <div className="text-[13px] font-semibold text-ink">{estimate.customer.name}</div>
                  {estimate.customer.company && <div className="text-[11px] text-muted">{estimate.customer.company}</div>}
                </div>
              </Link>
              <div className="mt-3 space-y-2 text-[11.5px] text-ink2">
                <a href={`tel:${estimate.customer.phone}`} className="flex items-center gap-2 hover:text-brand"><Phone size={12} className="text-muted" /> {estimate.customer.phone}</a>
                {estimate.customer.email && <a href={`mailto:${estimate.customer.email}`} className="flex items-center gap-2 hover:text-brand"><Mail size={12} className="text-muted" /> {estimate.customer.email}</a>}
                <div className="flex items-start gap-2"><MapPin size={12} className="mt-0.5 text-muted" /> {estimate.customer.serviceAddress}, {estimate.customer.city}</div>
              </div>
            </div>
          </section>

          {estimate.lead && (
            <section className="card">
              <div className="card-header">
                <div><div className="card-title">Linked lead</div><div className="card-sub">{estimate.lead.leadNo}</div></div>
                <Badge value={estimate.lead.status} />
              </div>
              <div className="p-4">
                <Link href={`/crm/leads/${estimate.lead.id}`} className="text-[12.5px] font-semibold text-ink hover:text-brand">{estimate.lead.title}</Link>
                {estimate.lead.assignedTo && (
                  <div className="mt-2 flex items-center gap-2">
                    <Avatar name={`${estimate.lead.assignedTo.firstName} ${estimate.lead.assignedTo.lastName}`} color={estimate.lead.assignedTo.avatarColor} size="sm" />
                    <span className="text-[11px] text-muted">{estimate.lead.assignedTo.firstName} {estimate.lead.assignedTo.lastName} · deal owner</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {estimate.project && (
            <section className="card">
              <div className="card-header">
                <div><div className="card-title">Project</div><div className="card-sub">{estimate.project.projectNo}</div></div>
                <Badge value={estimate.project.status} />
              </div>
              <div className="p-4">
                <Link href={`/crm/projects/${estimate.project.id}`} className="text-[12.5px] font-semibold text-ink hover:text-brand">{estimate.project.name}</Link>
                <div className="mt-2 flex items-center gap-2"><Progress value={estimate.project.progress} className="flex-1" /><span className="text-[10px] font-semibold text-muted">{estimate.project.progress}%</span></div>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-header"><div><div className="card-title">Approval status</div></div></div>
            <div className="p-5">
              <div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="font-semibold text-ink2">Proposal lifecycle</span><span className="font-bold text-ink">{statusMeta(estimate.status).label}</span></div>
              <Progress value={progress} tone={estimate.status === "ACCEPTED" ? "green" : estimate.status === "REJECTED" ? "red" : "brand"} />
              <div className="mt-1 flex justify-between text-[9px] uppercase tracking-[0.06em] text-muted"><span>Draft</span><span>Sent</span><span>Viewed</span><span>Decision</span></div>
              {estimate.sentAt && <MetaRow label="Sent" value={fmtDateTime(estimate.sentAt)} />}
              {estimate.decidedAt && <MetaRow label="Decided" value={fmtDateTime(estimate.decidedAt)} />}
              {estimate.approvedBy && <MetaRow label="Approved by" value={estimate.approvedBy.name} />}
              <MetaRow label="Prepared by" value={estimate.createdBy?.name ?? "—"} />
            </div>
          </section>

          <section className="card p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Record details</div>
            <MetaRow label="Estimate ID" value={<span className="mono">{estimate.estimateNo}</span>} />
            <MetaRow label="Customer" value={<Link href={`/crm/customers/${estimate.customer.id}`} className="text-brand">{estimate.customer.customerNo}</Link>} />
            <MetaRow label="Created" value={fmtDateTime(estimate.createdAt)} />
            <MetaRow label="Updated" value={fmtDateTime(estimate.updatedAt)} />
            <MetaRow label="Line items" value={estimate.items.length} />
            {estimate.lead && <MetaRow label="Lead value" value={<Link href={`/crm/leads/${estimate.lead.id}`} className="inline-flex items-center gap-1 text-brand">{estimate.lead.leadNo} <ArrowUpRight size={11} /></Link>} />}
          </section>
        </div>
      </div>
    </>
  );
}
