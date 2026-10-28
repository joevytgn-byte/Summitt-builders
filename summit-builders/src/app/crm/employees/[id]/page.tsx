import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, CalendarDays, CheckCircle2, Clock, Mail, MapPin, Pencil, Phone, ShieldCheck, Truck, UserRound, Users, Wallet,
} from "lucide-react";
import { requireModule } from "@/lib/access";
import { db } from "@/lib/db";
import { fmtDate, fmtDateTime, money, statusMeta, timeAgo } from "@/lib/utils";
import { Avatar, Badge, EmptyState, MetaRow, PageHeader, StatCard } from "@/components/ui";
import { ActionModal, StatusSelect } from "@/components/action-form";
import { updateEmployee, setEmployeeStatus } from "@/app/actions/employees";
import { isAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireModule("employees");
  const { id } = await params;

  const employee = await db.employee.findFirst({
    where: { id },
    include: {
      department: true,
      manager: { select: { id: true, firstName: true, lastName: true, position: true } },
      reports: { select: { id: true, firstName: true, lastName: true, position: true, avatarColor: true } },
      user: { select: { id: true, email: true, role: true, active: true, lastLoginAt: true } },
      jobAssignments: {
        include: { job: { select: { id: true, jobNo: true, jobType: true, scheduledDate: true, startTime: true, status: true, customer: { select: { name: true, company: true } } } } },
        take: 12,
      },
      attendance: { orderBy: { date: "desc" }, take: 14 },
      calls: { orderBy: { startedAt: "desc" }, take: 6, include: { customer: { select: { id: true, name: true, company: true } } } },
      leads: { orderBy: { createdAt: "desc" }, take: 6, include: { customer: { select: { name: true, company: true } } } },
      projects: { orderBy: { createdAt: "desc" }, take: 6 },
      _count: { select: { jobAssignments: true, leads: true, calls: true, attendance: true, projects: true, customers: true, requests: true } },
    },
  });
  if (!employee) notFound();

  const departments = await db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const admin = isAdmin(user.role);
  const attendanceCount = employee.attendance.length;
  const present = employee.attendance.filter((a) => ["PRESENT", "LATE", "REMOTE"].includes(a.status)).length;
  const hours = employee.attendance.reduce((s, a) => s + a.totalHours, 0);
  const overtime = employee.attendance.reduce((s, a) => s + a.overtimeHours, 0);
  const attendanceRate = attendanceCount ? Math.round((present / attendanceCount) * 1000) / 10 : 0;
  const tenure = (Date.now() - employee.hireDate.getTime()) / (365.25 * 86_400_000);
  const skills = employee.skills.split(",").map((s) => s.trim()).filter(Boolean);

  const editEmployee = admin ? (
    <ActionModal
      trigger={<button className="btn btn-outline"><Pencil size={14} /> Edit</button>}
      title="Edit employee"
      subtitle={employee.employeeNo}
      size="lg"
      action={updateEmployee}
      submitLabel="Save changes"
    >
      <input type="hidden" name="id" value={employee.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field"><label className="label" htmlFor="firstName">First name</label><input id="firstName" name="firstName" className="input" defaultValue={employee.firstName} /></div>
        <div className="field"><label className="label" htmlFor="lastName">Last name</label><input id="lastName" name="lastName" className="input" defaultValue={employee.lastName} /></div>
        <div className="field"><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" defaultValue={employee.email} /></div>
        <div className="field"><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" className="input" defaultValue={employee.phone ?? ""} /></div>
        <div className="field"><label className="label" htmlFor="position">Position</label><input id="position" name="position" className="input" defaultValue={employee.position} /></div>
        <div className="field">
          <label className="label" htmlFor="departmentId">Department</label>
          <select id="departmentId" name="departmentId" className="select" defaultValue={employee.departmentId ?? ""}>
            <option value="">Unassigned</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field"><label className="label" htmlFor="hireDate">Hire date</label><input id="hireDate" name="hireDate" type="date" className="input" defaultValue={fmtDate(employee.hireDate, "yyyy-MM-dd")} /></div>
        <div className="field"><label className="label" htmlFor="hourlyRate">Hourly rate ($)</label><input id="hourlyRate" name="hourlyRate" className="input" inputMode="decimal" defaultValue={employee.hourlyRate} /></div>
        <div className="field"><label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="select" defaultValue={employee.status}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="ARCHIVED">Archived</option></select>
        </div>
        <div className="field"><label className="label" htmlFor="managerId">Reports to</label>
          <select id="managerId" name="managerId" className="select" defaultValue={employee.managerId ?? ""}><option value="">—</option></select>
        </div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="skills">Skills</label><input id="skills" name="skills" className="input" defaultValue={employee.skills} /></div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="address">Address</label><input id="address" name="address" className="input" defaultValue={employee.address ?? ""} /></div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="emergencyContact">Emergency contact</label><input id="emergencyContact" name="emergencyContact" className="input" defaultValue={employee.emergencyContact ?? ""} /></div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="notes">Notes</label><textarea id="notes" name="notes" className="textarea" rows={2} defaultValue={employee.notes ?? ""} /></div>
      </div>
    </ActionModal>
  ) : null;

  const statusOptions = ["ACTIVE", "INACTIVE", "ARCHIVED"].map((s) => ({ value: s, label: statusMeta(s).label }));

  return (
    <>
      <Link href="/crm/employees" className="mb-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted hover:text-ink">
        <ArrowLeft size={13} /> Back to employees
      </Link>

      <PageHeader
        eyebrow={`${employee.employeeNo} · ${employee.department?.name ?? "Summit Builders"}`}
        title={`${employee.firstName} ${employee.lastName}`}
        subtitle={`${employee.position} · with the team since ${fmtDate(employee.hireDate)}`}
        actions={
          <>
            {admin && <StatusSelect value={employee.status} options={statusOptions} action={setEmployeeStatus.bind(null, employee.id)} label="Change employment status" width={140} />}
            {editEmployee}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Attendance rate" value={`${attendanceRate}%`} foot={<span>{present} of {attendanceCount} recent days</span>} icon={<Clock size={16} />} />
        <StatCard label="Hours logged" value={`${Math.round(hours)}h`} foot={<span>{Math.round(overtime)}h overtime</span>} icon={<CheckCircle2 size={16} />} />
        <StatCard label="Jobs assigned" value={employee._count.jobAssignments} foot={<span>{employee._count.projects} projects managed</span>} icon={<Truck size={16} />} href={`/crm/jobs?view=table&q=${encodeURIComponent(employee.firstName)}`} />
        <StatCard label="Tenure" value={`${tenure.toFixed(1)} yrs`} foot={<span>{money(employee.hourlyRate)}/hr</span>} icon={<CalendarDays size={16} />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <section className="card">
            <div className="card-header">
              <div className="flex items-center gap-3">
                <Avatar name={`${employee.firstName} ${employee.lastName}`} color={employee.avatarColor} size="xl" />
                <div>
                  <div className="text-[15px] font-bold text-ink">{employee.firstName} {employee.lastName}</div>
                  <div className="text-[11.5px] text-muted">{employee.position}</div>
                </div>
              </div>
              <Badge value={employee.status} />
            </div>
            <div className="p-5">
              <div className="grid gap-3 text-[12px] text-ink2 sm:grid-cols-2">
                <a href={`mailto:${employee.email}`} className="flex items-center gap-2 hover:text-brand"><Mail size={13} className="text-muted" /> {employee.email}</a>
                {employee.phone && <a href={`tel:${employee.phone}`} className="flex items-center gap-2 hover:text-brand"><Phone size={13} className="text-muted" /> {employee.phone}</a>}
                {employee.address && <div className="flex items-start gap-2"><MapPin size={13} className="mt-0.5 text-muted" /> {employee.address}</div>}
                <div className="flex items-center gap-2"><CalendarDays size={13} className="text-muted" /> Hired {fmtDate(employee.hireDate)}</div>
              </div>

              {skills.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Skills</div>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s) => <span key={s} className="rounded-full border border-line bg-panel2 px-2 py-0.5 text-[10.5px] text-ink2">{s}</span>)}
                  </div>
                </div>
              )}

              {employee.notes && (
                <div className="mt-4 rounded-lg border border-line bg-panel2 p-3 text-[11.5px] leading-relaxed text-ink2">{employee.notes}</div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Job history</div><div className="card-sub">Most recent assignments</div></div>
              <Link href="/crm/jobs" className="text-[11px] font-semibold text-brand hover:underline">Dispatch board</Link>
            </div>
            {employee.jobAssignments.length ? (
              <div className="divide-y divide-line">
                {employee.jobAssignments.map((a) => (
                  <Link key={a.id} href={`/crm/jobs/${a.job.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-panel2">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-ink">{a.job.jobType}</div>
                      <div className="text-[10.5px] text-muted">{a.job.jobNo} · {a.job.customer.company ?? a.job.customer.name} · {a.job.scheduledDate ? fmtDate(a.job.scheduledDate, "MMM d") : "Unscheduled"} {a.job.startTime ?? ""}</div>
                    </div>
                    <Badge value={a.job.status} />
                  </Link>
                ))}
              </div>
            ) : <EmptyState icon={<Truck />} title="No jobs yet" description="Assign this crew member from the dispatch board." />}
          </section>

          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Recent attendance</div><div className="card-sub">Last 14 records</div></div>
              <Link href={`/crm/attendance?employee=${employee.id}`} className="text-[11px] font-semibold text-brand hover:underline">Full timesheet</Link>
            </div>
            {employee.attendance.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Date</th><th>Clock in</th><th>Clock out</th><th className="text-right">Hours</th><th>Status</th></tr></thead>
                  <tbody>
                    {employee.attendance.map((a) => (
                      <tr key={a.id}>
                        <td className="text-[11.5px] font-medium text-ink">{fmtDate(a.date, "EEE, MMM d")}</td>
                        <td className="mono text-[11.5px]">{a.clockIn ?? "—"}</td>
                        <td className="mono text-[11.5px]">{a.clockOut ?? "—"}</td>
                        <td className="text-right mono text-[11.5px]">{a.totalHours.toFixed(1)}</td>
                        <td><Badge value={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={<Clock />} title="No attendance records" description="Clock-in data appears here." />}
          </section>

          <section className="card">
            <div className="card-header">
              <div><div className="card-title">Leads & calls</div><div className="card-sub">Sales activity for this team member</div></div>
            </div>
            <div className="grid gap-0 divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div>
                <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Assigned leads</div>
                {employee.leads.length ? employee.leads.map((l) => (
                  <Link key={l.id} href={`/crm/leads/${l.id}`} className="flex items-center justify-between gap-2 px-4 py-2 hover:bg-panel2">
                    <span className="min-w-0">
                      <span className="block truncate text-[11.5px] font-medium text-ink">{l.title}</span>
                      <span className="block text-[9.5px] text-muted">{l.customer.company ?? l.customer.name}</span>
                    </span>
                    <Badge value={l.status} />
                  </Link>
                )) : <div className="px-4 py-5 text-[11px] text-muted">No assigned leads.</div>}
              </div>
              <div>
                <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Recent calls</div>
                {employee.calls.length ? employee.calls.map((c) => (
                  <div key={c.id} className="px-4 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11.5px] font-medium text-ink">{c.customer?.company ?? c.customer?.name ?? "Unlinked call"}</span>
                      <Badge value={c.outcome} />
                    </div>
                    <div className="text-[9.5px] text-muted">{fmtDate(c.startedAt, "MMM d")} · {Math.max(1, Math.round(c.durationSec / 60))} min · {c.direction.toLowerCase()}</div>
                  </div>
                )) : <div className="px-4 py-5 text-[11px] text-muted">No calls logged.</div>}
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="card">
            <div className="card-header"><div><div className="card-title">Access & role</div><div className="card-sub">System login</div></div></div>
            <div className="p-4">
              {employee.user ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><ShieldCheck size={15} /></span>
                    <div>
                      <Badge value={employee.user.role} />
                      <div className="mt-0.5 text-[10px] text-muted">{employee.user.email}</div>
                    </div>
                  </div>
                  <MetaRow label="Account status" value={employee.user.active ? "Active" : "Disabled"} />
                  <MetaRow label="Last login" value={employee.user.lastLoginAt ? fmtDateTime(employee.user.lastLoginAt) : "Never"} />
                  <Link href="/crm/admin/users" className="btn btn-outline btn-sm mt-2 w-full justify-start"><UserRound size={13} /> Manage users</Link>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[11px] text-muted">
                  No CRM login linked to this employee.
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header"><div><div className="card-title">Reporting line</div></div></div>
            <div className="space-y-3 p-4">
              {employee.manager ? (
                <div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Reports to</div>
                  <Link href={`/crm/employees/${employee.manager.id}`} className="flex items-center gap-2.5 hover:text-brand">
                    <Avatar name={`${employee.manager.firstName} ${employee.manager.lastName}`} size="sm" />
                    <span><span className="block text-[12px] font-semibold text-ink">{employee.manager.firstName} {employee.manager.lastName}</span><span className="block text-[10px] text-muted">{employee.manager.position}</span></span>
                  </Link>
                </div>
              ) : <div className="text-[11px] text-muted">No manager assigned.</div>}
              <div className="border-t border-line pt-3">
                <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted"><Users size={11} /> Direct reports ({employee.reports.length})</div>
                {employee.reports.length ? employee.reports.map((r) => (
                  <Link key={r.id} href={`/crm/employees/${r.id}`} className="flex items-center gap-2 py-1 hover:text-brand">
                    <Avatar name={`${r.firstName} ${r.lastName}`} color={r.avatarColor} size="sm" />
                    <span className="text-[11.5px]">{r.firstName} {r.lastName}</span>
                    <span className="ml-auto text-[9.5px] text-muted">{r.position}</span>
                  </Link>
                )) : <div className="text-[11px] text-muted">No direct reports.</div>}
              </div>
            </div>
          </section>

          <section className="card p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">Record details</div>
            <MetaRow label="Employee ID" value={<span className="mono">{employee.employeeNo}</span>} />
            <MetaRow label="Department" value={employee.department?.name ?? "—"} />
            <MetaRow label="Hourly rate" value={`${money(employee.hourlyRate)}/hr`} />
            <MetaRow label="Emergency contact" value={employee.emergencyContact ?? "—"} />
            <MetaRow label="Created" value={timeAgo(employee.createdAt)} />
            <MetaRow label="Leads owned" value={employee._count.leads} />
            <MetaRow label="Requests owned" value={employee._count.requests} />
            <MetaRow label="Customers" value={employee._count.customers} />
          </section>

          <section className="card p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted"><Wallet size={11} /> Payroll snapshot</div>
            <div className="flex items-baseline justify-between"><span className="text-[11px] text-muted">Regular hours</span><span className="mono text-[12px] font-semibold text-ink">{(hours - overtime).toFixed(1)}h</span></div>
            <div className="mt-1 flex items-baseline justify-between"><span className="text-[11px] text-muted">Overtime</span><span className="mono text-[12px] font-semibold text-ink">{overtime.toFixed(1)}h</span></div>
            <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2"><span className="text-[11px] font-semibold text-ink2">Estimated pay</span><span className="mono text-[14px] font-bold text-ink">{money(hours * employee.hourlyRate)}</span></div>
            <p className="mt-2 text-[9.5px] text-muted">Based on the last {employee.attendance.length} attendance records.</p>
          </section>
        </div>
      </div>
    </>
  );
}
