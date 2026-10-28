import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, Clock, FileText, HardHat, Mail, MapPin, Pencil, Phone,
  Plus, Truck, UserPlus, Users, XCircle,
} from "lucide-react";
import { requireModule, jobScope } from "@/lib/access";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/options";
import { JOB_STATUSES, PRIORITIES, fmtDate, fmtDateTime, money, statusMeta, timeAgo } from "@/lib/utils";
import { Avatar, Badge, EmptyState, MetaRow, PageHeader, StatCard } from "@/components/ui";
import { ActionButton, ActionModal, StatusSelect } from "@/components/action-form";
import { assignCrewFromForm, completeJob, scheduleJobFromForm, updateJob, updateJobStatus } from "@/app/actions/jobs";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("jobs");
  const { id } = await params;

  const job = await db.job.findFirst({
    where: { AND: [{ id }, jobScope(user)] },
    include: {
      customer: true,
      project: { select: { id: true, projectNo: true, name: true, status: true, progress: true, managerId: true } },
      manager: true,
      dispatcher: true,
      assignments: { include: { employee: true } },
    },
  });
  if (!job) notFound();

  const [options, activities, nearbyJobs] = await Promise.all([
    getFormOptions(),
    db.activity.findMany({ where: { customerId: job.customerId }, orderBy: { createdAt: "desc" }, take: 14 }),
    db.job.findMany({
      where: {
        AND: [
          jobScope(user),
          { id: { not: job.id } },
          job.scheduledDate ? { scheduledDate: job.scheduledDate } : { scheduledDate: null },
        ],
      },
      select: { id: true, jobNo: true, jobType: true, startTime: true, status: true },
      orderBy: { startTime: "asc" },
      take: 6,
    }),
  ]);

  const isField = user.role === "FIELD";
  const statusOptions = JOB_STATUSES.map((s) => ({ value: s, label: statusMeta(s).label }));
  const crewIds = job.assignments.map((a) => a.employeeId);
  const endTime = job.startTime
    ? (() => {
        const [h, m] = job.startTime!.split(":").map(Number);
        const total = h * 60 + m + job.durationMins;
        return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      })()
    : null;

  return (
    <>
      <Link href="/crm/jobs" className="mb-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted hover:text-ink">
        <ArrowLeft size={13} /> Back to jobs & dispatch
      </Link>

      <PageHeader
        eyebrow={`${job.jobNo} · ${job.project?.projectNo ?? "Standalone job"}`}
        title={job.jobType}
        subtitle={`${job.customer.company ?? job.customer.name} · ${job.address}`}
        actions={
          <>
            <StatusSelect value={job.status} options={statusOptions} action={updateJobStatus.bind(null, job.id)} label="Change job status" width={160} />
            {!isField && (
              <>
                <ActionModal
                  trigger={<button className="btn btn-outline"><Pencil size={14} /> Edit</button>}
                  title="Edit job"
                  subtitle={job.jobNo}
                  size="lg"
                  action={updateJob}
                  submitLabel="Save changes"
                >
                  <input type="hidden" name="id" value={job.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="field sm:col-span-2"><label className="label" htmlFor="jobType">Job type</label><input id="jobType" name="jobType" className="input" defaultValue={job.jobType} required /></div>
                    <div className="field">
                      <label className="label" htmlFor="customerId">Customer</label>
                      <select id="customerId" name="customerId" className="select" defaultValue={job.customerId}>
                        {options.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="projectId">Project</label>
                      <select id="projectId" name="projectId" className="select" defaultValue={job.projectId ?? ""}>
                        <option value="">No project</option>
                        {options.projects.map((p) => <option key={p.id} value={p.id}>{p.projectNo} · {p.name}</option>)}
                      </select>
                    </div>
                    <div className="field"><label className="label" htmlFor="scheduledDate">Date</label><input id="scheduledDate" name="scheduledDate" type="date" className="input" defaultValue={job.scheduledDate ? fmtDate(job.scheduledDate, "yyyy-MM-dd") : ""} /></div>
                    <div className="field"><label className="label" htmlFor="startTime">Start time</label><input id="startTime" name="startTime" type="time" className="input" defaultValue={job.startTime ?? "08:00"} /></div>
                    <div className="field"><label className="label" htmlFor="durationMins">Duration (min)</label><input id="durationMins" name="durationMins" className="input" inputMode="numeric" defaultValue={job.durationMins} /></div>
                    <div className="field">
                      <label className="label" htmlFor="status">Status</label>
                      <select id="status" name="status" className="select" defaultValue={job.status}>
                        {JOB_STATUSES.map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="priority">Priority</label>
                      <select id="priority" name="priority" className="select" defaultValue={job.priority}>
                        {PRIORITIES.map((p) => <option key={p} value={p}>{statusMeta(p).label}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="managerId">Manager</label>
                      <select id="managerId" name="managerId" className="select" defaultValue={job.managerId ?? ""}>
                        <option value="">Unassigned</option>
                        {options.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label className="label" htmlFor="dispatcherId">Dispatcher</label>
                      <select id="dispatcherId" name="dispatcherId" className="select" defaultValue={job.dispatcherId ?? ""}>
                        <option value="">Unassigned</option>
                        {options.dispatchers.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}
                      </select>
                    </div>
                    <div className="field sm:col-span-2">
                      <label className="label">Crew</label>
                      <div className="grid max-h-[150px] grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-line p-2.5">
                        {options.employees.map((e) => (
                          <label key={e.id} className="check-row text-[11.5px]">
                            <input type="checkbox" name="crewIds" value={e.id} defaultChecked={crewIds.includes(e.id)} className="checkbox" /> {e.name}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="field sm:col-span-2"><label className="label" htmlFor="address">Address</label><input id="address" name="address" className="input" defaultValue={job.address} /></div>
                    <div className="field sm:col-span-2"><label className="label" htmlFor="notes">Notes</label><textarea id="notes" name="notes" className="textarea" rows={2} defaultValue={job.notes ?? ""} /></div>
                    <div className="field sm:col-span-2"><label className="label" htmlFor="completionNotes">Completion notes</label><textarea id="completionNotes" name="completionNotes" className="textarea" rows={2} defaultValue={job.completionNotes ?? ""} /></div>
                  </div>
                </ActionModal>
                <ActionModal
                  trigger={<button className="btn btn-outline"><UserPlus size={14} /> Assign crew</button>}
                  title="Assign crew"
                  subtitle="Conflicts are checked against the scheduled time."
                  action={assignCrewFromForm}
                  submitLabel="Save crew"
                >
                  <input type="hidden" name="jobId" value={job.id} />
                  <div className="grid max-h-[320px] grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-2">
                    {options.employees.map((e) => (
                      <label key={e.id} className="check-row text-[12px]">
                        <input type="checkbox" name="crewIds" value={e.id} defaultChecked={crewIds.includes(e.id)} className="checkbox" />
                        <span>
                          <span className="block font-medium text-ink">{e.name}</span>
                          <span className="block text-[10px] text-muted">{e.position}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </ActionModal>
                <ActionModal
                  trigger={<button className="btn btn-outline"><CalendarDays size={14} /> Reschedule</button>}
                  title="Reschedule job"
                  subtitle={job.jobNo}
                  action={scheduleJobFromForm}
                  submitLabel="Update schedule"
                >
                  <input type="hidden" name="jobId" value={job.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="field"><label className="label" htmlFor="scheduledDate">Date</label><input id="scheduledDate" name="scheduledDate" type="date" className="input" required defaultValue={job.scheduledDate ? fmtDate(job.scheduledDate, "yyyy-MM-dd") : ""} /></div>
                    <div className="field"><label className="label" htmlFor="startTime">Start time</label><input id="startTime" name="startTime" type="time" className="input" defaultValue={job.startTime ?? "08:00"} /></div>
                    <div className="field sm:col-span-2"><label className="label" htmlFor="durationMins">Duration (min)</label><input id="durationMins" name="durationMins" className="input" inputMode="numeric" defaultValue={job.durationMins} /></div>
                  </div>
                </ActionModal>
              </>
            )}
            <ActionModal
              trigger={<button className="btn btn-primary"><CheckCircle2 size={14} /> Complete</button>}
              title="Complete this job"
              subtitle={job.jobNo}
              action={completeJob}
              submitLabel="Mark complete"
            >
              <input type="hidden" name="jobId" value={job.id} />
              <div className="field"><label className="label" htmlFor="completionNotes">Completion notes</label><textarea id="completionNotes" name="completionNotes" className="textarea" rows={4} placeholder="Work performed, punch list, customer sign-off…" /></div>
              <p className="mt-2 text-[11px] text-muted">Completing a job updates the linked project progress automatically.</p>
            </ActionModal>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Schedule" value={job.scheduledDate ? fmtDate(job.scheduledDate, "MMM d") : "Unscheduled"} foot={<span>{job.startTime ?? "TBD"}{endTime ? ` – ${endTime}` : ""} · {Math.round(job.durationMins / 60)}h</span>} icon={<CalendarDays size={16} />} />
        <StatCard label="Crew" value={job.assignments.length} foot={<span>{job.assignments.map((a) => a.employee.firstName).slice(0, 3).join(", ") || "No crew assigned"}</span>} icon={<Users size={16} />} />
        <StatCard label="Priority" value={statusMeta(job.priority).label} foot={<span>dispatcher {job.dispatcher ? `${job.dispatcher.firstName} ${job.dispatcher.lastName}` : "unassigned"}</span>} icon={<Clock size={16} />} />
        <StatCard label="Project" value={job.project ? job.project.projectNo : "—"} foot={<span>{job.project ? `${job.project.progress}% complete` : "Standalone job"}</span>} icon={<HardHat size={16} />} href={job.project ? `/crm/projects/${job.project.id}` : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Job brief</div><div className="card-sub">Scope, site and crew instructions</div></div>
              <Badge value={job.status} />
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge value={job.priority} />
                {job.scheduledDate && <span className="text-[11px] text-muted">{fmtDate(job.scheduledDate, "EEEE, MMMM d, yyyy")}</span>}
                {job.startTime && <span className="text-[11px] text-muted">· {job.startTime}{endTime ? ` – ${endTime}` : ""}</span>}
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-ink2">{job.description ?? job.notes ?? "No additional scope notes were provided for this job."}</p>
              {job.notes && job.description && (
                <div className="mt-3 rounded-lg border border-line bg-panel2 p-3 text-[11.5px] leading-relaxed text-ink2">{job.notes}</div>
              )}
              {job.completionNotes && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 text-[11.5px] leading-relaxed text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em]">Completion notes</div>
                  {job.completionNotes}
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
                <div><div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Job</div><div className="mt-1 mono text-[12.5px] font-semibold text-ink">{job.jobNo}</div></div>
                <div><div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Duration</div><div className="mt-1 text-[12.5px] font-semibold text-ink">{Math.round(job.durationMins / 60)} hours</div></div>
                <div><div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Completed</div><div className="mt-1 text-[12.5px] font-semibold text-ink">{job.completedAt ? fmtDate(job.completedAt) : "—"}</div></div>
                <div><div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">Created</div><div className="mt-1 text-[12.5px] font-semibold text-ink">{timeAgo(job.createdAt)}</div></div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Assigned crew</div><div className="card-sub">{job.assignments.length} assigned · conflict-checked</div></div>
              {!isField && (
                <ActionModal
                  trigger={<button className="btn btn-ghost btn-sm"><UserPlus size={13} /> Manage</button>}
                  title="Assign crew"
                  subtitle={job.jobNo}
                  action={assignCrewFromForm}
                  submitLabel="Save crew"
                >
                  <input type="hidden" name="jobId" value={job.id} />
                  <div className="grid max-h-[320px] grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-line p-3 sm:grid-cols-2">
                    {options.employees.map((e) => (
                      <label key={e.id} className="check-row text-[12px]">
                        <input type="checkbox" name="crewIds" value={e.id} defaultChecked={crewIds.includes(e.id)} className="checkbox" /> {e.name}
                      </label>
                    ))}
                  </div>
                </ActionModal>
              )}
            </div>
            {job.assignments.length ? (
              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {job.assignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-panel2 p-2.5">
                    <Avatar name={`${a.employee.firstName} ${a.employee.lastName}`} color={a.employee.avatarColor} />
                    <div className="min-w-0">
                      <Link href={`/crm/employees/${a.employee.id}`} className="block truncate text-[12px] font-semibold text-ink hover:text-brand">{a.employee.firstName} {a.employee.lastName}</Link>
                      <div className="truncate text-[10px] text-muted">{a.employee.position}</div>
                    </div>
                    {a.employee.phone && <a href={`tel:${a.employee.phone}`} className="ml-auto text-muted hover:text-brand" aria-label={`Call ${a.employee.firstName}`}><Phone size={13} /></a>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-[11.5px] text-muted">No crew assigned yet. Assign at least one crew member before dispatching.</div>
            )}
          </section>

          <section className="card">
            <div className="card-header"><div><div className="card-title">Activity</div><div className="card-sub">Customer and dispatch history</div></div></div>
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
              ) : <EmptyState title="No activity yet" description="Status changes and schedule updates appear here." />}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="card">
            <div className="card-header"><div><div className="card-title">Customer</div><div className="card-sub">{job.customer.customerNo}</div></div></div>
            <div className="p-4">
              <Link href={`/crm/customers/${job.customer.id}`} className="flex items-center gap-2.5 hover:text-brand">
                <Avatar name={job.customer.name} size="lg" />
                <div>
                  <div className="text-[13px] font-semibold text-ink">{job.customer.company ?? job.customer.name}</div>
                  {job.customer.company && <div className="text-[11px] text-muted">{job.customer.name}</div>}
                </div>
              </Link>
              <div className="mt-3 space-y-2 text-[11.5px] text-ink2">
                <a href={`tel:${job.customer.phone}`} className="flex items-center gap-2 hover:text-brand"><Phone size={12} className="text-muted" /> {job.customer.phone}</a>
                {job.customer.email && <a href={`mailto:${job.customer.email}`} className="flex items-center gap-2 break-all hover:text-brand"><Mail size={12} className="text-muted" /> {job.customer.email}</a>}
                <div className="flex items-start gap-2"><MapPin size={12} className="mt-0.5 text-muted" /> {job.address}<br />{job.customer.city}, {job.customer.state} {job.customer.zip}</div>
              </div>
            </div>
          </section>

          {job.project && (
            <section className="card">
              <div className="card-header"><div><div className="card-title">Project</div><div className="card-sub">{job.project.projectNo}</div></div><Badge value={job.project.status} /></div>
              <div className="p-4">
                <Link href={`/crm/projects/${job.project.id}`} className="text-[12.5px] font-semibold text-ink hover:text-brand">{job.project.name}</Link>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted"><span>Progress</span><span className="font-semibold text-ink">{job.project.progress}%</span></div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel3"><div className="h-full rounded-full bg-brand" style={{ width: `${job.project.progress}%` }} /></div>
                <Link href={`/crm/projects/${job.project.id}`} className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">Open project <ArrowUpRight size={11} /></Link>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-header"><div><div className="card-title">Dispatch team</div></div></div>
            <div className="space-y-3 p-4">
              {job.manager && (
                <div className="flex items-center gap-2.5">
                  <Avatar name={`${job.manager.firstName} ${job.manager.lastName}`} color={job.manager.avatarColor} />
                  <div><div className="text-[12px] font-semibold text-ink">{job.manager.firstName} {job.manager.lastName}</div><div className="text-[10px] text-muted">Project manager</div></div>
                </div>
              )}
              {job.dispatcher && (
                <div className="flex items-center gap-2.5">
                  <Avatar name={`${job.dispatcher.firstName} ${job.dispatcher.lastName}`} color={job.dispatcher.avatarColor} />
                  <div><div className="text-[12px] font-semibold text-ink">{job.dispatcher.firstName} {job.dispatcher.lastName}</div><div className="text-[10px] text-muted">Dispatcher</div></div>
                </div>
              )}
              {!job.manager && !job.dispatcher && <div className="text-[11px] text-muted">No manager or dispatcher assigned.</div>}
            </div>
          </section>

          {nearbyJobs.length > 0 && (
            <section className="card">
              <div className="card-header"><div><div className="card-title">Also this day</div><div className="card-sub">{job.scheduledDate ? fmtDate(job.scheduledDate, "MMM d") : "Unscheduled backlog"}</div></div></div>
              <div className="divide-y divide-line">
                {nearbyJobs.map((n) => (
                  <Link key={n.id} href={`/crm/jobs/${n.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-panel2">
                    <span className="min-w-0">
                      <span className="block truncate text-[11.5px] font-semibold text-ink">{n.jobType}</span>
                      <span className="block text-[10px] text-muted">{n.jobNo} · {n.startTime ?? "TBD"}</span>
                    </span>
                    <Badge value={n.status} />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="card p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Record details</div>
            <MetaRow label="Job ID" value={<span className="mono">{job.jobNo}</span>} />
            <MetaRow label="Project" value={job.project ? <Link href={`/crm/projects/${job.project.id}`} className="text-brand">{job.project.projectNo}</Link> : "—"} />
            <MetaRow label="Customer" value={<Link href={`/crm/customers/${job.customer.id}`} className="text-brand">{job.customer.customerNo}</Link>} />
            <MetaRow label="Created" value={fmtDateTime(job.createdAt)} />
            <MetaRow label="Updated" value={timeAgo(job.updatedAt)} />
            {job.completedAt && <MetaRow label="Completed" value={fmtDateTime(job.completedAt)} />}
            {!isField && job.status !== "COMPLETED" && (
              <div className="mt-3">
                <ActionButton
                  action={updateJobStatus.bind(null, job.id, "CANCELLED")}
                  label="Cancel job"
                  icon={<XCircle size={13} />}
                  variant="danger"
                  confirm="Cancel this job? It will stay on the record for reporting."
                  className="w-full"
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
