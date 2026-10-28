import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, CalendarClock, CheckCircle2, FileText, Mail, MapPin, Phone, Plus, Pencil, Building2,
} from "lucide-react";
import { requireModule, leadScope, canEditLead } from "@/lib/access";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/options";
import { LEAD_SOURCES, LEAD_STAGES, PRIORITIES, fmtDate, fmtDateTime, money, statusMeta, timeAgo, titleCase } from "@/lib/utils";
import { Avatar, Badge, EmptyState, MetaRow, PageHeader, Progress } from "@/components/ui";
import { ActionButton, ActionModal, InlineNoteForm, StatusSelect } from "@/components/action-form";
import { EstimateItemsEditor } from "@/components/estimate-items";
import {
  addLeadNote, completeFollowUp, convertLeadToProject, createFollowUp, deleteLead, updateLead, updateLeadStatus,
} from "@/app/actions/leads";
import { createCall } from "@/app/actions/calls";
import { createEstimate } from "@/app/actions/estimates";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("leads");
  const { id } = await params;

  const lead = await db.lead.findFirst({
    where: { AND: [{ id }, leadScope(user)] },
    include: {
      customer: true,
      service: true,
      assignedTo: true,
      createdBy: { select: { name: true } },
      requests: { select: { id: true, requestNo: true, status: true, urgency: true, createdAt: true, source: true } },
      estimates: { select: { id: true, estimateNo: true, title: true, status: true, total: true, validUntil: true } },
      calls: { include: { employee: { select: { firstName: true, lastName: true } } }, orderBy: { startedAt: "desc" } },
      followUps: { where: { status: "PENDING" }, include: { assignedTo: { select: { firstName: true, lastName: true } } }, orderBy: { dueAt: "asc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 14 },
    },
  });
  if (!lead) notFound();

  const options = await getFormOptions();
  const editable = canEditLead(user, lead);
  const statusOptions = LEAD_STAGES.map((s) => ({ value: s, label: statusMeta(s).label }));
  const contacted = lead.lastContactAt;
  const stageIndex = LEAD_STAGES.indexOf(lead.status as (typeof LEAD_STAGES)[number]);
  const progress = lead.status === "WON" ? 100 : lead.status === "LOST" ? 0 : Math.round(((stageIndex + 1) / 7) * 100);

  return (
    <>
      <Link href="/crm/leads" className="mb-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted hover:text-ink">
        <ArrowLeft size={13} /> Back to leads
      </Link>

      <PageHeader
        eyebrow={`${lead.leadNo} · ${titleCase(lead.source)} lead`}
        title={lead.title}
        subtitle={`${lead.customer.company ?? lead.customer.name} · ${lead.service?.name ?? "No service"} · created ${fmtDate(lead.createdAt)}`}
        actions={
          <>
            <StatusSelect value={lead.status} options={statusOptions} action={updateLeadStatus.bind(null, lead.id)} label="Change lead stage" width={170} />
            <ActionModal
              trigger={<button className="btn btn-outline" disabled={!editable}><Pencil size={14} /> Edit</button>}
              title="Edit lead"
              subtitle={lead.leadNo}
              size="lg"
              action={updateLead}
              submitLabel="Save changes"
            >
              <input type="hidden" name="id" value={lead.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="field sm:col-span-2">
                  <label className="label" htmlFor="title">Lead title</label>
                  <input id="title" name="title" className="input" defaultValue={lead.title} required />
                </div>
                <div className="field">
                  <label className="label" htmlFor="serviceId">Service</label>
                  <select id="serviceId" name="serviceId" className="select" defaultValue={lead.serviceId ?? ""}>
                    <option value="">Not selected</option>
                    {options.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="projectType">Project type</label>
                  <select id="projectType" name="projectType" className="select" defaultValue={lead.projectType}>
                    <option>Residential</option><option>Commercial</option><option>Industrial</option><option>Repair / Service</option>
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="estimatedValue">Estimated value</label>
                  <input id="estimatedValue" name="estimatedValue" className="input" defaultValue={lead.estimatedValue} inputMode="decimal" />
                </div>
                <div className="field">
                  <label className="label" htmlFor="source">Source</label>
                  <select id="source" name="source" className="select" defaultValue={lead.source}>
                    {[...new Set([lead.source, ...LEAD_SOURCES])].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="assignedToId">Assigned rep</label>
                  <select id="assignedToId" name="assignedToId" className="select" defaultValue={lead.assignedToId ?? ""}>
                    <option value="">Unassigned</option>
                    {options.salesEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="priority">Priority</label>
                  <select id="priority" name="priority" className="select" defaultValue={lead.priority}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{statusMeta(p).label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="status">Stage</label>
                  <select id="status" name="status" className="select" defaultValue={lead.status}>
                    {LEAD_STAGES.map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="nextFollowUp">Next follow-up</label>
                  <input id="nextFollowUp" name="nextFollowUp" type="date" className="input" defaultValue={lead.nextFollowUp ? fmtDate(lead.nextFollowUp, "yyyy-MM-dd") : ""} />
                </div>
                <div className="field sm:col-span-2">
                  <label className="label" htmlFor="description">Description</label>
                  <textarea id="description" name="description" className="textarea" rows={3} defaultValue={lead.description ?? ""} />
                </div>
                {lead.status === "LOST" && (
                  <div className="field sm:col-span-2">
                    <label className="label" htmlFor="lostReason">Lost reason</label>
                    <input id="lostReason" name="lostReason" className="input" defaultValue={lead.lostReason ?? ""} />
                  </div>
                )}
              </div>
            </ActionModal>
            <ActionModal
              trigger={<button className="btn btn-primary" disabled={lead.status === "WON"}><Plus size={14} /> Convert to project</button>}
              title="Convert lead to project"
              subtitle="Creates the project and an unscheduled kickoff job."
              action={convertLeadToProject}
              submitLabel="Create project"
              successRedirect="/crm/projects"
            >
              <input type="hidden" name="leadId" value={lead.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="field sm:col-span-2">
                  <label className="label" htmlFor="name">Project name</label>
                  <input id="name" name="name" className="input" defaultValue={lead.title} required />
                </div>
                <div className="field">
                  <label className="label" htmlFor="contractValue">Contract value</label>
                  <input id="contractValue" name="contractValue" className="input" defaultValue={lead.estimatedValue} inputMode="decimal" />
                </div>
                <div className="field">
                  <label className="label" htmlFor="managerId">Project manager</label>
                  <select id="managerId" name="managerId" className="select" defaultValue="">
                    <option value="">Auto-assign</option>
                    {options.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label" htmlFor="startDate">Start date</label>
                  <input id="startDate" name="startDate" type="date" className="input" />
                </div>
                <div className="field">
                  <label className="label" htmlFor="expectedEnd">Expected completion</label>
                  <input id="expectedEnd" name="expectedEnd" type="date" className="input" />
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted">The lead will be marked won and a kickoff job will be created for dispatch.</p>
            </ActionModal>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Deal overview</div><div className="card-sub">Stage progress and key figures</div></div>
              <Badge value={lead.priority} />
            </div>
            <div className="p-5">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="font-semibold text-ink2">Pipeline stage</span>
                <span className="font-bold text-ink">{statusMeta(lead.status).label}</span>
              </div>
              <Progress value={progress} tone={lead.status === "LOST" ? "red" : lead.status === "WON" ? "green" : "brand"} />
              <div className="mt-1 flex justify-between text-[9px] uppercase tracking-[0.06em] text-muted">
                <span>New</span><span>Qualified</span><span>Estimate</span><span>Won</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Estimated value</div>
                  <div className="mt-1 text-[18px] font-[750] tracking-[-0.03em] text-ink">{money(lead.estimatedValue)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Response time</div>
                  <div className="mt-1 text-[18px] font-[750] tracking-[-0.03em] text-ink">
                    {lead.responseMins ? `${lead.responseMins}m` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Last contact</div>
                  <div className="mt-1 text-[13px] font-semibold text-ink">{contacted ? timeAgo(contacted) : "No contact yet"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Next follow-up</div>
                  <div className="mt-1 text-[13px] font-semibold text-ink">{lead.nextFollowUp ? fmtDate(lead.nextFollowUp) : "Not set"}</div>
                </div>
              </div>

              {lead.description && (
                <div className="mt-5 rounded-lg border border-line bg-panel2 p-3.5">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Scope</div>
                  <p className="text-[12.5px] leading-relaxed text-ink2">{lead.description}</p>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Activity timeline</div><div className="card-sub">Calls, notes, status changes and requests</div></div>
            </div>
            <div className="p-5">
              <InlineNoteForm action={addLeadNote} hidden={{ leadId: lead.id }} placeholder="Add a note about this opportunity…" />
              {lead.activities.length ? (
                <div className="mt-4 timeline">
                  {lead.activities.map((a) => (
                    <div key={a.id} className="timeline-item">
                      <span className="timeline-dot"><CheckCircle2 size={13} /></span>
                      <div className="timeline-body">
                        <div className="timeline-title">{a.title}</div>
                        <div className="timeline-meta">{a.actorName ?? "System"} · {fmtDateTime(a.createdAt)}</div>
                        {a.description && <div className="timeline-text">{a.description}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No activity yet" description="Notes, calls and status changes will appear here." />
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="card">
            <div className="card-header"><div><div className="card-title">Customer</div><div className="card-sub">{lead.customer.customerNo}</div></div></div>
            <div className="p-4">
              <Link href={`/crm/customers/${lead.customerId}`} className="flex items-center gap-2.5 hover:text-brand">
                <Avatar name={lead.customer.name} size="lg" />
                <div>
                  <div className="text-[13px] font-semibold text-ink">{lead.customer.name}</div>
                  {lead.customer.company && <div className="text-[11px] text-muted">{lead.customer.company}</div>}
                </div>
              </Link>
              <div className="mt-3 space-y-2 text-[11.5px] text-ink2">
                <a href={`tel:${lead.customer.phone}`} className="flex items-center gap-2 hover:text-brand"><Phone size={12} className="text-muted" /> {lead.customer.phone}</a>
                {lead.customer.email && <a href={`mailto:${lead.customer.email}`} className="flex items-center gap-2 hover:text-brand"><Mail size={12} className="text-muted" /> {lead.customer.email}</a>}
                <div className="flex items-start gap-2"><MapPin size={12} className="mt-0.5 text-muted" /> {lead.customer.serviceAddress}, {lead.customer.city}, {lead.customer.state} {lead.customer.zip}</div>
                <div className="flex items-center gap-2"><Pencil size={12} className="text-muted" /> Assigned rep: {lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : "Unassigned"}</div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><div><div className="card-title">Quick actions</div></div></div>
            <div className="flex flex-col gap-2 p-4">
              <ActionModal
                trigger={<button className="btn btn-outline btn-sm w-full justify-start"><Phone size={13} /> Log a call</button>}
                title="Log a call"
                subtitle={`${lead.customer.name} · ${lead.leadNo}`}
                action={createCall}
                submitLabel="Save call"
              >
                <input type="hidden" name="customerId" value={lead.customerId} />
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="employeeId" value={user.employeeId ?? ""} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="field">
                    <label className="label" htmlFor="date">Date</label>
                    <input id="date" name="date" type="date" className="input" defaultValue={fmtDate(new Date(), "yyyy-MM-dd")} />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="direction">Direction</label>
                    <select id="direction" name="direction" className="select" defaultValue="OUTGOING">
                      <option value="OUTGOING">Outgoing</option><option value="INCOMING">Incoming</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="startTime">Start time</label>
                    <input id="startTime" name="startTime" type="time" className="input" defaultValue="09:00" />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="durationMins">Duration (minutes)</label>
                    <input id="durationMins" name="durationMins" className="input" inputMode="numeric" defaultValue="15" />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="outcome">Outcome</label>
                    <select id="outcome" name="outcome" className="select" defaultValue="CONNECTED">
                      <option value="CONNECTED">Connected</option><option value="VOICEMAIL">Voicemail</option>
                      <option value="NO_ANSWER">No answer</option><option value="CALLBACK">Callback</option><option value="BUSY">Busy</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="callType">Call type</label>
                    <select id="callType" name="callType" className="select" defaultValue="Sales">
                      <option>Sales</option><option>Follow-up</option><option>Dispatch</option><option>Support</option>
                    </select>
                  </div>
                  <div className="field sm:col-span-2">
                    <label className="label" htmlFor="notes">Notes</label>
                    <textarea id="notes" name="notes" className="textarea" rows={2} placeholder="What was discussed?" />
                  </div>
                </div>
              </ActionModal>

              <ActionModal
                trigger={<button className="btn btn-outline btn-sm w-full justify-start"><FileText size={13} /> Create estimate</button>}
                title="New estimate"
                subtitle={`For ${lead.customer.name}`}
                size="lg"
                action={createEstimate}
                submitLabel="Save estimate"
                successRedirect="/crm/estimates"
              >
                <input type="hidden" name="customerId" value={lead.customerId} />
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="status" value="DRAFT" />
                <div className="grid gap-4">
                  <div className="field">
                    <label className="label" htmlFor="estTitle">Title</label>
                    <input id="estTitle" name="title" className="input" defaultValue={`${lead.title} — estimate`} required />
                  </div>
                  <div className="field">
                    <label className="label">Line items</label>
                    <EstimateItemsEditor defaultItems={[{ description: "Project management", category: "LABOR", quantity: 1, unit: "ea", unitPrice: 1200 }, { description: "Materials & labor", category: "MATERIAL", quantity: 1, unit: "ea", unitPrice: 0 }]} />
                  </div>
                </div>
              </ActionModal>

              <ActionModal
                trigger={<button className="btn btn-outline btn-sm w-full justify-start"><CalendarClock size={13} /> Schedule follow-up</button>}
                title="Schedule a follow-up"
                action={createFollowUp}
                submitLabel="Schedule"
              >
                <input type="hidden" name="leadId" value={lead.id} />
                <input type="hidden" name="customerId" value={lead.customerId} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="field sm:col-span-2">
                    <label className="label" htmlFor="subject">Subject</label>
                    <input id="subject" name="subject" className="input" placeholder="Estimate review call" required />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="dueAt">Due date</label>
                    <input id="dueAt" name="dueAt" type="date" className="input" required />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="assignedToId">Assigned to</label>
                    <select id="assignedToId" name="assignedToId" className="select" defaultValue={lead.assignedToId ?? ""}>
                      <option value="">Me</option>
                      {options.salesEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div className="field sm:col-span-2">
                    <label className="label" htmlFor="fuNotes">Notes</label>
                    <textarea id="fuNotes" name="notes" className="textarea" rows={2} />
                  </div>
                </div>
              </ActionModal>

              {lead.status === "LOST" && (
                <ActionButton
                  action={deleteLead.bind(null, lead.id)}
                  label="Archive lead"
                  variant="danger"
                  confirm="Archive this lead? It will remain in history as lost."
                  className="w-full justify-start"
                />
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header"><div><div className="card-title">Estimates & requests</div></div></div>
            <div className="p-4">
              {lead.estimates.length > 0 && (
                <div className="mb-3">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Estimates</div>
                  {lead.estimates.map((e) => (
                    <Link key={e.id} href={`/crm/estimates/${e.id}`} className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-0 hover:text-brand">
                      <div className="min-w-0">
                        <div className="truncate text-[11.5px] font-medium text-ink">{e.estimateNo} · {e.title}</div>
                        <div className="text-[10px] text-muted">Valid to {fmtDate(e.validUntil)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11.5px] font-semibold text-ink">{money(e.total)}</div>
                        <Badge value={e.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {lead.requests.map((r) => (
                <Link key={r.id} href={`/crm/requests/${r.id}`} className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-0 hover:text-brand">
                  <div>
                    <div className="text-[11.5px] font-medium text-ink">{r.requestNo}</div>
                    <div className="text-[10px] text-muted">{r.source} · {timeAgo(r.createdAt)}</div>
                  </div>
                  <Badge value={r.status} />
                </Link>
              ))}
              {!lead.estimates.length && !lead.requests.length && (
                <div className="py-3 text-center text-[11px] text-muted">No estimates or requests linked yet.</div>
              )}
            </div>
          </section>

          {lead.followUps.length > 0 && (
            <section className="card">
              <div className="card-header"><div><div className="card-title">Open follow-ups</div><div className="card-sub">{lead.followUps.length} pending</div></div></div>
              <div className="divide-y divide-line">
                {lead.followUps.map((f) => (
                  <div key={f.id} className="px-4 py-2.5">
                    <div className="text-[11.5px] font-medium text-ink">{f.subject}</div>
                    <div className="text-[10px] text-muted">Due {fmtDate(f.dueAt)} · {f.assignedTo ? `${f.assignedTo.firstName} ${f.assignedTo.lastName}` : "Unassigned"}</div>
                    <ActionButton action={completeFollowUp.bind(null, f.id)} label="Mark done" variant="ghost" className="mt-1 px-0 text-brand" />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="card p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Record details</div>
            <MetaRow label="Lead ID" value={<span className="mono">{lead.leadNo}</span>} />
            <MetaRow label="Created" value={fmtDateTime(lead.createdAt)} />
            <MetaRow label="Created by" value={lead.createdBy?.name ?? "Website"} />
            <MetaRow label="Updated" value={timeAgo(lead.updatedAt)} />
            <MetaRow label="Source" value={lead.source} />
            <MetaRow label="Project type" value={lead.projectType} />
            {lead.wonAt && <MetaRow label="Won" value={fmtDateTime(lead.wonAt)} />}
            {lead.lostAt && <MetaRow label="Lost" value={`${fmtDateTime(lead.lostAt)}${lead.lostReason ? ` · ${lead.lostReason}` : ""}`} />}
          </section>
        </div>
      </div>
    </>
  );
}
