import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, Download, FileText, Mail, MapPin, Paperclip, Phone, Plus, XCircle,
} from "lucide-react";
import { requireModule, requestScope } from "@/lib/access";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/options";
import { REQUEST_STATUSES, URGENCIES, fmtDate, fmtDateTime, humanize, money, statusMeta, timeAgo } from "@/lib/utils";
import { Avatar, Badge, EmptyState, MetaRow, PageHeader, Progress } from "@/components/ui";
import { ActionButton, ActionModal, InlineNoteForm, StatusSelect } from "@/components/action-form";
import { addRequestNote, cancelRequest, updateRequest, updateRequestStatus } from "@/app/actions/requests";

export const dynamic = "force-dynamic";

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("requests");
  const { id } = await params;

  const request = await db.serviceRequest.findFirst({
    where: { AND: [{ id }, requestScope(user)] },
    include: {
      customer: true,
      service: true,
      lead: { include: { assignedTo: { select: { firstName: true, lastName: true, avatarColor: true } }, estimates: { select: { id: true, estimateNo: true, total: true, status: true } } } },
      assignedTo: true,
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!request) notFound();

  const [options, activities, relatedRequests] = await Promise.all([
    getFormOptions(),
    db.activity.findMany({ where: { customerId: request.customerId }, orderBy: { createdAt: "desc" }, take: 12 }),
    db.serviceRequest.findMany({
      where: { customerId: request.customerId, NOT: { id: request.id } },
      select: { id: true, requestNo: true, status: true, description: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  const statusOptions = REQUEST_STATUSES.map((s) => ({ value: s, label: statusMeta(s).label }));
  const stageIndex = REQUEST_STATUSES.indexOf(request.status as (typeof REQUEST_STATUSES)[number]);
  const progress = request.status === "CANCELLED" ? 0 : Math.round(((stageIndex + 1) / REQUEST_STATUSES.length) * 100);

  return (
    <>
      <Link href="/crm/requests" className="mb-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted hover:text-ink">
        <ArrowLeft size={13} /> Back to service requests
      </Link>

      <PageHeader
        eyebrow={`${request.requestNo} · ${request.source} request`}
        title={request.service?.name ?? "Service request"}
        subtitle={`${request.customer.company ?? request.customer.name} · received ${fmtDateTime(request.createdAt)}`}
        actions={
          <>
            <StatusSelect value={request.status} options={statusOptions} action={updateRequestStatus.bind(null, request.id)} label="Change request status" width={186} />
            <ActionModal
              trigger={<button className="btn btn-outline"><FileText size={14} /> Edit</button>}
              title="Edit service request"
              subtitle={request.requestNo}
              size="lg"
              action={updateRequest}
              submitLabel="Save changes"
            >
              <input type="hidden" name="id" value={request.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="field sm:col-span-2">
                  <label className="label" htmlFor="description">Work requested</label>
                  <textarea id="description" name="description" className="textarea" rows={3} defaultValue={request.description} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="serviceId">Service</label>
                  <select id="serviceId" name="serviceId" className="select" defaultValue={request.serviceId ?? ""}>
                    <option value="">Not selected</option>
                    {options.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="status">Status</label>
                  <select id="status" name="status" className="select" defaultValue={request.status}>
                    {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="urgency">Urgency</label>
                  <select id="urgency" name="urgency" className="select" defaultValue={request.urgency}>
                    {URGENCIES.map((u) => <option key={u} value={u}>{statusMeta(u).label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="assignedToId">Assigned to</label>
                  <select id="assignedToId" name="assignedToId" className="select" defaultValue={request.assignedToId ?? ""}>
                    <option value="">Unassigned</option>
                    {options.salesEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="preferredDate">Preferred date</label>
                  <input id="preferredDate" name="preferredDate" type="date" className="input" defaultValue={request.preferredDate ? fmtDate(request.preferredDate, "yyyy-MM-dd") : ""} />
                </div>
                <div className="field">
                  <label className="label" htmlFor="projectType">Project type</label>
                  <select id="projectType" name="projectType" className="select" defaultValue={request.projectType}>
                    <option>Residential</option><option>Commercial</option><option>Industrial</option><option>Repair / Service</option>
                  </select>
                </div>
                <div className="field sm:col-span-2">
                  <label className="label" htmlFor="address">Address</label>
                  <input id="address" name="address" className="input" defaultValue={request.address} />
                </div>
                <div className="field"><label className="label" htmlFor="city">City</label><input id="city" name="city" className="input" defaultValue={request.city} /></div>
                <div className="field"><label className="label" htmlFor="zip">ZIP</label><input id="zip" name="zip" className="input" defaultValue={request.zip} /></div>
                <div className="field sm:col-span-2"><label className="label" htmlFor="notes">Internal notes</label><textarea id="notes" name="notes" className="textarea" rows={2} defaultValue={request.notes ?? ""} /></div>
              </div>
            </ActionModal>
            {request.lead && (
              <Link href={`/crm/leads/${request.lead.id}`} className="btn btn-primary"><ArrowUpRight size={14} /> Open lead</Link>
            )}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Request detail</div><div className="card-sub">What the customer asked for</div></div>
              <Badge value={request.urgency} />
            </div>
            <div className="p-5">
              <p className="text-[13px] leading-relaxed text-ink2">{request.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Request</div>
                  <div className="mt-1 mono text-[13px] font-semibold text-ink">{request.requestNo}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Project type</div>
                  <div className="mt-1 text-[13px] font-semibold text-ink">{request.projectType}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Size</div>
                  <div className="mt-1 text-[13px] font-semibold text-ink">{request.estimatedSize ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Preferred date</div>
                  <div className="mt-1 text-[13px] font-semibold text-ink">{request.preferredDate ? fmtDate(request.preferredDate) : "Flexible"}</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-ink2">Request progress</span>
                  <span className="font-bold text-ink">{statusMeta(request.status).label}</span>
                </div>
                <Progress value={progress} tone={request.status === "CANCELLED" ? "red" : request.status === "COMPLETED" || request.status === "CLOSED" ? "green" : "brand"} />
                <div className="mt-1 flex justify-between text-[9px] uppercase tracking-[0.06em] text-muted">
                  <span>New</span><span>Contacted</span><span>Qualified</span><span>Estimate</span><span>Complete</span>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Attachments</div><div className="card-sub">Photos and documents from the customer</div></div>
              <span className="text-[11px] text-muted">{request.attachments.length} file{request.attachments.length === 1 ? "" : "s"}</span>
            </div>
            <div className="p-5">
              {request.attachments.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {request.attachments.map((a) => (
                    <a key={a.id} href={`/api/attachments/${a.id}`} className="flex items-center gap-3 rounded-lg border border-line bg-panel2 px-3 py-2.5 hover:border-line2" download={a.name}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-panel text-brand"><Paperclip size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-ink">{a.name}</span>
                        <span className="block text-[10px] text-muted">{bytes(a.size)} · {a.mime}</span>
                      </span>
                      <Download size={14} className="text-muted" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[11.5px] text-muted">
                  No attachments were uploaded with this request.
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Activity & notes</div><div className="card-sub">Customer timeline across every module</div></div>
            </div>
            <div className="p-5">
              <InlineNoteForm action={addRequestNote} hidden={{ requestId: request.id }} placeholder="Add an internal note about this request…" />
              {activities.length ? (
                <div className="timeline mt-5">
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
              ) : (
                <EmptyState title="No activity yet" description="Notes and status changes will appear here." />
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="card">
            <div className="card-header"><div><div className="card-title">Customer</div><div className="card-sub">{request.customer.customerNo}</div></div></div>
            <div className="p-4">
              <Link href={`/crm/customers/${request.customer.id}`} className="flex items-center gap-2.5 hover:text-brand">
                <Avatar name={request.customer.name} size="lg" />
                <div>
                  <div className="text-[13px] font-semibold text-ink">{request.customer.name}</div>
                  {request.customer.company && <div className="text-[11px] text-muted">{request.customer.company}</div>}
                </div>
              </Link>
              <div className="mt-3 space-y-2 text-[11.5px] text-ink2">
                <a href={`tel:${request.customer.phone}`} className="flex items-center gap-2 hover:text-brand"><Phone size={12} className="text-muted" /> {request.customer.phone}</a>
                {request.customer.email && <a href={`mailto:${request.customer.email}`} className="flex items-center gap-2 hover:text-brand"><Mail size={12} className="text-muted" /> {request.customer.email}</a>}
                <div className="flex items-start gap-2"><MapPin size={12} className="mt-0.5 text-muted" /> {request.address}, {request.city}, {request.state} {request.zip}</div>
                <div className="flex items-center gap-2"><CalendarDays size={12} className="text-muted" /> Customer since {fmtDate(request.customer.createdAt, "MMM yyyy")}</div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><div><div className="card-title">Assignment</div></div></div>
            <div className="p-4">
              {request.assignedTo ? (
                <div className="flex items-center gap-2.5">
                  <Avatar name={`${request.assignedTo.firstName} ${request.assignedTo.lastName}`} color={request.assignedTo.avatarColor} />
                  <div>
                    <div className="text-[12.5px] font-semibold text-ink">{request.assignedTo.firstName} {request.assignedTo.lastName}</div>
                    <div className="text-[10.5px] text-muted">{request.assignedTo.position}</div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2.5 text-[11.5px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                  No owner assigned — use Edit to assign a rep.
                </div>
              )}
              {request.lead?.assignedTo && request.lead.assignedTo && (
                <div className="mt-3 border-t border-line pt-3">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Lead owner</div>
                  <div className="flex items-center gap-2">
                    <Avatar name={`${request.lead.assignedTo.firstName} ${request.lead.assignedTo.lastName}`} color={request.lead.assignedTo.avatarColor} size="sm" />
                    <Link href={`/crm/leads/${request.lead.id}`} className="text-[11.5px] font-medium text-ink hover:text-brand">
                      {request.lead.assignedTo.firstName} {request.lead.assignedTo.lastName}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </section>

          {request.lead && (
            <section className="card">
              <div className="card-header">
                <div><div className="card-title">Linked lead</div><div className="card-sub">{request.lead.leadNo}</div></div>
                <Badge value={request.lead.status} />
              </div>
              <div className="p-4">
                <Link href={`/crm/leads/${request.lead.id}`} className="text-[12.5px] font-semibold text-ink hover:text-brand">{request.lead.title}</Link>
                <div className="mt-1 text-[11px] text-muted">Estimated {money(request.lead.estimatedValue)}</div>
                {request.lead.estimates.length > 0 && (
                  <div className="mt-3 border-t border-line pt-2">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Estimates</div>
                    {request.lead.estimates.map((e) => (
                      <Link key={e.id} href={`/crm/estimates/${e.id}`} className="flex items-center justify-between py-1 text-[11.5px] hover:text-brand">
                        <span>{e.estimateNo}</span>
                        <span className="flex items-center gap-2">{money(e.total)} <Badge value={e.status} /></span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {relatedRequests.length > 0 && (
            <section className="card">
              <div className="card-header"><div><div className="card-title">Other requests</div><div className="card-sub">Same customer</div></div></div>
              <div className="divide-y divide-line">
                {relatedRequests.map((r) => (
                  <Link key={r.id} href={`/crm/requests/${r.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-panel2">
                    <span className="min-w-0">
                      <span className="block text-[11.5px] font-semibold text-ink">{r.requestNo}</span>
                      <span className="block truncate text-[10px] text-muted">{r.description}</span>
                    </span>
                    <Badge value={r.status} />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="card p-4">
            <MetaRow label="Source" value={humanize(request.source)} />
            <MetaRow label="Service" value={request.service?.name ?? "—"} />
            <MetaRow label="Created" value={fmtDateTime(request.createdAt)} />
            <MetaRow label="Updated" value={timeAgo(request.updatedAt)} />
            <MetaRow label="Lead" value={request.lead ? <Link href={`/crm/leads/${request.lead.id}`} className="text-brand">{request.lead.leadNo}</Link> : "—"} />
            <div className="mt-3">
              <ActionButton
                action={cancelRequest.bind(null, request.id)}
                label="Cancel request"
                icon={<XCircle size={13} />}
                variant="danger"
                confirm="Cancel this service request? The linked lead will remain for reporting."
                className="w-full"
              />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
