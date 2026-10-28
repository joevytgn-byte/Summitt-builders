import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, Clock, FileText, HardHat, MapPin, Pencil, Plus, Truck, Users,
} from "lucide-react";
import { requireModule } from "@/lib/access";
import { db } from "@/lib/db";
import { getFormOptions } from "@/lib/options";
import { JOB_STATUSES, PRIORITIES, PROJECT_STATUSES, fmtDate, fmtDateTime, money, statusMeta, timeAgo } from "@/lib/utils";
import { Avatar, Badge, EmptyState, MetaRow, PageHeader, Progress, StatCard } from "@/components/ui";
import { ActionModal, InlineNoteForm, StatusSelect } from "@/components/action-form";
import { addProjectNote, setProjectProgress, updateProject, updateProjectStatus } from "@/app/actions/projects";
import { createJob } from "@/app/actions/jobs";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("projects");
  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id },
    include: {
      customer: true,
      service: true,
      manager: true,
      estimate: { select: { id: true, estimateNo: true, total: true, status: true } },
      jobs: {
        orderBy: [{ scheduledDate: "asc" }, { startTime: "asc" }],
        include: {
          assignments: { include: { employee: { select: { id: true, firstName: true, lastName: true, avatarColor: true } } } },
        },
      },
    },
  });
  if (!project) notFound();

  const [options, activities] = await Promise.all([
    getFormOptions(),
    db.activity.findMany({ where: { customerId: project.customerId }, orderBy: { createdAt: "desc" }, take: 14 }),
  ]);

  const completed = project.jobs.filter((j) => j.status === "COMPLETED").length;
  const scheduled = project.jobs.filter((j) => ["SCHEDULED", "DISPATCHED", "EN_ROUTE", "IN_PROGRESS"].includes(j.status)).length;
  const daysLeft = project.expectedEnd ? Math.ceil((project.expectedEnd.getTime() - Date.now()) / 86_400_000) : null;
  const statusOptions = PROJECT_STATUSES.map((s) => ({ value: s, label: statusMeta(s).label }));
  const crewIds = new Set(project.jobs.flatMap((j) => j.assignments.map((a) => a.employeeId)));

  const editProject = (
    <ActionModal
      trigger={<button className="btn btn-outline"><Pencil size={14} /> Edit</button>}
      title="Edit project"
      subtitle={project.projectNo}
      size="lg"
      action={updateProject}
      submitLabel="Save changes"
    >
      <input type="hidden" name="id" value={project.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2"><label className="label" htmlFor="name">Project name</label><input id="name" name="name" className="input" defaultValue={project.name} /></div>
        <div className="field"><label className="label" htmlFor="projectType">Type</label>
          <select id="projectType" name="projectType" className="select" defaultValue={project.projectType}><option>Residential</option><option>Commercial</option><option>Industrial</option><option>Repair / Service</option></select>
        </div>
        <div className="field"><label className="label" htmlFor="serviceId">Service</label>
          <select id="serviceId" name="serviceId" className="select" defaultValue={project.serviceId ?? ""}><option value="">General</option>{options.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <div className="field"><label className="label" htmlFor="contractValue">Contract value</label><input id="contractValue" name="contractValue" className="input" inputMode="decimal" defaultValue={project.contractValue} /></div>
        <div className="field"><label className="label" htmlFor="managerId">Project manager</label>
          <select id="managerId" name="managerId" className="select" defaultValue={project.managerId ?? ""}><option value="">Unassigned</option>{options.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        </div>
        <div className="field"><label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="select" defaultValue={project.status}>{PROJECT_STATUSES.map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}</select>
        </div>
        <div className="field"><label className="label" htmlFor="priority">Priority</label>
          <select id="priority" name="priority" className="select" defaultValue={project.priority}>{PRIORITIES.map((p) => <option key={p} value={p}>{statusMeta(p).label}</option>)}</select>
        </div>
        <div className="field"><label className="label" htmlFor="startDate">Start date</label><input id="startDate" name="startDate" type="date" className="input" defaultValue={project.startDate ? fmtDate(project.startDate, "yyyy-MM-dd") : ""} /></div>
        <div className="field"><label className="label" htmlFor="expectedEnd">Expected completion</label><input id="expectedEnd" name="expectedEnd" type="date" className="input" defaultValue={project.expectedEnd ? fmtDate(project.expectedEnd, "yyyy-MM-dd") : ""} /></div>
        <div className="field"><label className="label" htmlFor="progress">Progress %</label><input id="progress" name="progress" className="input" inputMode="numeric" defaultValue={project.progress} /></div>
        <div className="field"><label className="label" htmlFor="serviceAddress">Service address</label><input id="serviceAddress" name="serviceAddress" className="input" defaultValue={project.serviceAddress} /></div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="description">Scope</label><textarea id="description" name="description" className="textarea" rows={2} defaultValue={project.description ?? ""} /></div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="notes">Internal notes</label><textarea id="notes" name="notes" className="textarea" rows={2} defaultValue={project.notes ?? ""} /></div>
      </div>
    </ActionModal>
  );

  const addJob = (
    <ActionModal
      trigger={<button className="btn btn-primary"><Plus size={14} /> Add job</button>}
      title="Add a job to this project"
      subtitle={project.name}
      size="lg"
      action={createJob}
      submitLabel="Create job"
      successRedirect="/crm/jobs"
    >
      <input type="hidden" name="customerId" value={project.customerId} />
      <input type="hidden" name="projectId" value={project.id} />
      <input type="hidden" name="address" value={project.serviceAddress} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2"><label className="label" htmlFor="jobType">Job type<span className="req">*</span></label><input id="jobType" name="jobType" className="input" required placeholder="e.g. Tile & waterproofing" /></div>
        <div className="field"><label className="label" htmlFor="scheduledDate">Date</label><input id="scheduledDate" name="scheduledDate" type="date" className="input" /></div>
        <div className="field"><label className="label" htmlFor="startTime">Start time</label><input id="startTime" name="startTime" type="time" className="input" defaultValue="08:00" /></div>
        <div className="field"><label className="label" htmlFor="durationMins">Duration (min)</label><input id="durationMins" name="durationMins" className="input" inputMode="numeric" defaultValue="240" /></div>
        <div className="field"><label className="label" htmlFor="priority">Priority</label>
          <select id="priority" name="priority" className="select" defaultValue="MEDIUM">{PRIORITIES.map((p) => <option key={p} value={p}>{statusMeta(p).label}</option>)}</select>
        </div>
        <div className="field"><label className="label" htmlFor="managerId">Manager</label>
          <select id="managerId" name="managerId" className="select" defaultValue={project.managerId ?? ""}><option value="">Unassigned</option>{options.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        </div>
        <div className="field"><label className="label" htmlFor="dispatcherId">Dispatcher</label>
          <select id="dispatcherId" name="dispatcherId" className="select" defaultValue=""><option value="">Unassigned</option>{options.dispatchers.map((d) => <option key={d.id} value={d.id}>{d.firstName} {d.lastName}</option>)}</select>
        </div>
        <div className="field sm:col-span-2">
          <label className="label">Crew</label>
          <div className="grid max-h-[150px] grid-cols-2 gap-1.5 overflow-y-auto rounded-lg border border-line p-2.5">
            {options.employees.map((e) => (
              <label key={e.id} className="check-row text-[11.5px]"><input type="checkbox" name="crewIds" value={e.id} className="checkbox" /> {e.name}</label>
            ))}
          </div>
          <div className="field-hint">Crew conflicts are checked when a date and start time are set.</div>
        </div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="notes">Notes for the crew</label><textarea id="notes" name="notes" className="textarea" rows={2} /></div>
      </div>
    </ActionModal>
  );

  return (
    <>
      <Link href="/crm/projects" className="mb-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted hover:text-ink">
        <ArrowLeft size={13} /> Back to projects
      </Link>

      <PageHeader
        eyebrow={`${project.projectNo} · ${project.projectType}`}
        title={project.name}
        subtitle={`${project.customer.company ?? project.customer.name} · ${project.serviceAddress}`}
        actions={
          <>
            <StatusSelect value={project.status} options={statusOptions} action={updateProjectStatus.bind(null, project.id)} label="Change project status" width={150} />
            {editProject}
            {addJob}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Contract value" value={money(project.contractValue, { compact: true })} foot={<span>{money(project.contractValue - project.contractValue * 0.35, { compact: true })} cost to date</span>} icon={<FileText size={16} />} />
        <StatCard label="Jobs complete" value={`${completed}/${project.jobs.length}`} foot={<span>{scheduled} in flight</span>} icon={<Truck size={16} />} />
        <StatCard label="Progress" value={`${project.progress}%`} foot={<span>{project.status === "COMPLETED" ? "delivered" : "on the board"}</span>} icon={<HardHat size={16} />} />
        <StatCard label="Schedule" value={daysLeft === null ? "—" : daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : `${daysLeft}d left`} foot={<span>{project.expectedEnd ? `Due ${fmtDate(project.expectedEnd)}` : "No due date"}</span>} icon={<CalendarDays size={16} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Job schedule</div><div className="card-sub">{project.jobs.length} jobs · drag-free list view</div></div>
              <Link href={`/crm/jobs?project=${project.id}`} className="text-[11px] font-semibold text-brand hover:underline">Dispatch board</Link>
            </div>
            {project.jobs.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Job</th><th>Date</th><th>Crew</th><th>Status</th><th className="text-right">Duration</th></tr>
                  </thead>
                  <tbody>
                    {project.jobs.map((job) => (
                      <tr key={job.id} data-clickable="true">
                        <td>
                          <Link href={`/crm/jobs/${job.id}`} className="cell-strong hover:text-brand">{job.jobType}</Link>
                          <div className="cell-sub mono">{job.jobNo}</div>
                        </td>
                        <td className="nowrap text-[11.5px]">{job.scheduledDate ? `${fmtDate(job.scheduledDate, "MMM d")}${job.startTime ? ` · ${job.startTime}` : ""}` : <span className="text-muted">Unscheduled</span>}</td>
                        <td>
                          <div className="avatar-stack">
                            {job.assignments.slice(0, 3).map((a) => <Avatar key={a.id} name={`${a.employee.firstName} ${a.employee.lastName}`} color={a.employee.avatarColor} size="sm" />)}
                            {!job.assignments.length && <span className="text-[10.5px] text-amber-600">No crew</span>}
                          </div>
                        </td>
                        <td><Badge value={job.status} /></td>
                        <td className="text-right mono text-[11.5px]">{Math.round(job.durationMins / 60)}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={<Truck />} title="No jobs yet" description="Add the first job to start the delivery schedule." action={undefined} />}
          </section>

          <section className="card">
            <div className="card-header"><div><div className="card-title">Progress & updates</div><div className="card-sub">Update the completion percentage and post site notes</div></div></div>
            <div className="p-5">
              <div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="font-semibold text-ink2">Completion</span><span className="font-bold text-ink">{project.progress}%</span></div>
              <Progress value={project.progress} tone={project.progress === 100 ? "green" : "brand"} />
              <form action={async (fd: FormData) => { await setProjectProgress(fd); }} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="projectId" value={project.id} />
                <div className="field w-[130px]"><label className="label" htmlFor="progress">New progress %</label><input id="progress" name="progress" type="number" min={0} max={100} step={5} defaultValue={project.progress} className="input input-sm" /></div>
                <button className="btn btn-outline btn-sm" type="submit">Update progress</button>
                <span className="text-[10.5px] text-muted">Marking 100% completes the project.</span>
              </form>

              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Site notes</div>
                <InlineNoteForm action={addProjectNote} hidden={{ projectId: project.id }} placeholder="Log a site update, change order or blocker…" />
                {project.notes && <div className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-panel2 p-3 text-[11.5px] leading-relaxed text-ink2">{project.notes}</div>}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><div><div className="card-title">Activity</div><div className="card-sub">Customer, project and dispatch events</div></div></div>
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
              ) : <EmptyState title="No activity yet" />}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="card">
            <div className="card-header"><div><div className="card-title">Customer</div><div className="card-sub">{project.customer.customerNo}</div></div></div>
            <div className="p-4">
              <Link href={`/crm/customers/${project.customer.id}`} className="flex items-center gap-2.5 hover:text-brand">
                <Avatar name={project.customer.name} size="lg" />
                <div>
                  <div className="text-[13px] font-semibold text-ink">{project.customer.company ?? project.customer.name}</div>
                  <div className="text-[11px] text-muted">{project.customer.phone}</div>
                </div>
              </Link>
              <div className="mt-3 flex items-start gap-2 text-[11.5px] text-ink2"><MapPin size={12} className="mt-0.5 text-muted" /> {project.serviceAddress}, {project.customer.city}, {project.customer.state} {project.customer.zip}</div>
            </div>
          </section>

          <section className="card">
            <div className="card-header"><div><div className="card-title">Project team</div></div></div>
            <div className="p-4">
              {project.manager ? (
                <div className="flex items-center gap-2.5">
                  <Avatar name={`${project.manager.firstName} ${project.manager.lastName}`} color={project.manager.avatarColor} />
                  <div>
                    <div className="text-[12.5px] font-semibold text-ink">{project.manager.firstName} {project.manager.lastName}</div>
                    <div className="text-[10.5px] text-muted">Project manager · {project.manager.position}</div>
                  </div>
                </div>
              ) : <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-3 py-2.5 text-[11.5px] text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">No project manager assigned.</div>}
              <div className="mt-3 border-t border-line pt-3">
                <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted"><Users size={11} /> Assigned crew ({crewIds.size})</div>
                <div className="flex flex-wrap gap-1.5">
                  {[...crewIds].slice(0, 8).map((cid) => {
                    const emp = project.jobs.flatMap((j) => j.assignments).find((a) => a.employeeId === cid)?.employee;
                    if (!emp) return null;
                    return (
                      <span key={cid} className="flex items-center gap-1.5 rounded-full border border-line bg-panel2 py-0.5 pl-0.5 pr-2">
                        <Avatar name={`${emp.firstName} ${emp.lastName}`} color={emp.avatarColor} size="sm" />
                        <span className="text-[10.5px] text-ink2">{emp.firstName}</span>
                      </span>
                    );
                  })}
                  {!crewIds.size && <span className="text-[11px] text-muted">No crew assigned yet.</span>}
                </div>
              </div>
            </div>
          </section>

          {project.estimate && (
            <section className="card">
              <div className="card-header"><div><div className="card-title">Source estimate</div><div className="card-sub">{project.estimate.estimateNo}</div></div><Badge value={project.estimate.status} /></div>
              <div className="p-4">
                <Link href={`/crm/estimates/${project.estimate.id}`} className="flex items-center justify-between text-[12px] font-semibold text-ink hover:text-brand">
                  <span>{money(project.estimate.total)}</span><span className="inline-flex items-center gap-1 text-brand">View <ArrowUpRight size={12} /></span>
                </Link>
              </div>
            </section>
          )}

          <section className="card p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Project details</div>
            <MetaRow label="Project ID" value={<span className="mono">{project.projectNo}</span>} />
            <MetaRow label="Service" value={project.service?.name ?? "General"} />
            <MetaRow label="Type" value={project.projectType} />
            <MetaRow label="Priority" value={<Badge value={project.priority} />} />
            <MetaRow label="Start" value={project.startDate ? fmtDate(project.startDate) : "Not set"} />
            <MetaRow label="Expected end" value={project.expectedEnd ? fmtDate(project.expectedEnd) : "Not set"} />
            <MetaRow label="Actual end" value={project.actualEnd ? fmtDate(project.actualEnd) : "—"} />
            <MetaRow label="Created" value={timeAgo(project.createdAt)} />
            {project.description && <div className="mt-3 rounded-lg border border-line bg-panel2 p-3 text-[11.5px] leading-relaxed text-ink2">{project.description}</div>}
          </section>

          <section className="card p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted"><Clock size={11} /> Job status mix</div>
            {JOB_STATUSES.map((s) => {
              const count = project.jobs.filter((j) => j.status === s).length;
              if (!count) return null;
              return <MetaRow key={s} label={statusMeta(s).label} value={count} />;
            })}
          </section>
        </div>
      </div>
    </>
  );
}
