import Link from "next/link";
import { addDays, format, startOfWeek } from "date-fns";
import { CalendarDays, CheckCircle2, Clock, Coffee, LogIn, LogOut, Plus, Timer, UserX } from "lucide-react";
import { requireModule, attendanceScope } from "@/lib/access";
import { db } from "@/lib/db";
import { fmtDate, money, number, statusMeta } from "@/lib/utils";
import { Avatar, Badge, EmptyState, PageHeader, Progress, StatCard } from "@/components/ui";
import { ActionButton, ActionModal } from "@/components/action-form";
import { clockIn, clockOut, saveAttendance } from "@/app/actions/attendance";
import { isAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUSES = ["PRESENT", "LATE", "ABSENT", "LEAVE", "REMOTE", "HOLIDAY"];

export default async function AttendancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("attendance");
  const params = await searchParams;
  const str = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const selectedDate = str("date") ? new Date(`${str("date")}T12:00:00`) : new Date();
  const day = Number.isNaN(selectedDate.getTime()) ? new Date() : selectedDate;
  const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
  const employeeFilter = str("employee");
  const statusFilter = str("status");
  const scope = attendanceScope(user);
  const admin = isAdmin(user.role);
  const canManage = !["FIELD", "SALES_REP"].includes(user.role);

  const [records, employees, todayMine, weekRecords] = await Promise.all([
    db.attendance.findMany({
      where: {
        AND: [
          scope,
          { date: { gte: dayStart, lte: dayEnd } },
          employeeFilter ? { employeeId: employeeFilter } : {},
          statusFilter ? { status: statusFilter } : {},
        ],
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true, position: true, avatarColor: true, department: { select: { name: true } } } } },
      orderBy: [{ status: "asc" }, { employee: { firstName: "asc" } }],
    }),
    db.employee.findMany({ where: { status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, position: true }, orderBy: { firstName: "asc" } }),
    user.employeeId
      ? db.attendance.findFirst({ where: { employeeId: user.employeeId, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } })
      : Promise.resolve(null),
    db.attendance.findMany({
      where: { AND: [scope, { date: { gte: addDays(dayStart, -6), lte: dayEnd } }] },
      select: { employeeId: true, totalHours: true, overtimeHours: true, status: true, lateMinutes: true },
    }),
  ]);

  const present = records.filter((r) => ["PRESENT", "LATE", "REMOTE"].includes(r.status)).length;
  const late = records.filter((r) => r.status === "LATE").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const leave = records.filter((r) => r.status === "LEAVE").length;
  const totalHours = records.reduce((s, r) => s + r.totalHours, 0);
  const overtime = records.reduce((s, r) => s + r.overtimeHours, 0);
  const scheduleRate = records.length ? Math.round((present / records.length) * 100) : 0;

  const weekly = employees
    .map((e) => {
      const rows = weekRecords.filter((r) => r.employeeId === e.id);
      return {
        employee: e,
        hours: rows.reduce((s, r) => s + r.totalHours, 0),
        overtime: rows.reduce((s, r) => s + r.overtimeHours, 0),
        late: rows.filter((r) => r.status === "LATE").length,
        present: rows.filter((r) => ["PRESENT", "LATE", "REMOTE"].includes(r.status)).length,
        rows: rows.length,
      };
    })
    .sort((a, b) => b.hours - a.hours);
  const weekStart = startOfWeek(day, { weekStartsOn: 1 });

  const logForm = canManage ? (
    <ActionModal
      trigger={<button className="btn btn-primary"><Plus size={15} /> Log attendance</button>}
      title="Log attendance"
      subtitle="Create or update a day record for any employee."
      action={saveAttendance}
      submitLabel="Save attendance"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field sm:col-span-2">
          <label className="label" htmlFor="employeeId">Employee<span className="req">*</span></label>
          <select id="employeeId" name="employeeId" className="select" required defaultValue={employees[0]?.id ?? ""}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.position}</option>)}
          </select>
        </div>
        <div className="field"><label className="label" htmlFor="date">Date</label><input id="date" name="date" type="date" className="input" defaultValue={format(day, "yyyy-MM-dd")} /></div>
        <div className="field"><label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="select" defaultValue="PRESENT">{STATUSES.map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}</select>
        </div>
        <div className="field"><label className="label" htmlFor="clockIn">Clock in</label><input id="clockIn" name="clockIn" type="time" className="input" defaultValue="08:00" /></div>
        <div className="field"><label className="label" htmlFor="clockOut">Clock out</label><input id="clockOut" name="clockOut" type="time" className="input" defaultValue="16:30" /></div>
        <div className="field"><label className="label" htmlFor="breakMins">Break (min)</label><input id="breakMins" name="breakMins" className="input" inputMode="numeric" defaultValue="30" /></div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="notes">Notes</label><textarea id="notes" name="notes" className="textarea" rows={2} /></div>
      </div>
    </ActionModal>
  ) : null;

  const self = todayMine;
  const selfEmployee = user.employeeId ? await db.employee.findUnique({ where: { id: user.employeeId }, select: { firstName: true, lastName: true } }) : null;

  return (
    <>
      <PageHeader
        eyebrow="Time & attendance"
        title="Attendance"
        subtitle="Daily roster, clock-in status and weekly hours across the crew."
        actions={
          <>
            {logForm}
            {user.employeeId && (
              <div className="flex items-center gap-2">
                {!self?.clockIn && <ActionButton action={clockIn.bind(null, undefined)} label="Clock in" icon={<LogIn size={14} />} variant="primary" />}
                {self?.clockIn && !self.clockOut && <ActionButton action={clockOut.bind(null, undefined)} label="Clock out" icon={<LogOut size={14} />} variant="outline" />}
                {self?.clockOut && <span className="badge" data-tone="green">Done for today · {self.totalHours.toFixed(1)}h</span>}
              </div>
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="On site / present" value={number(present)} foot={<span>{records.length} records logged</span>} icon={<CheckCircle2 size={16} />} />
        <StatCard label="Late arrivals" value={number(late)} foot={<span>{absent} absent · {leave} on leave</span>} icon={<Timer size={16} />} />
        <StatCard label="Hours logged" value={`${totalHours.toFixed(1)}h`} foot={<span>{overtime.toFixed(1)}h overtime</span>} icon={<Clock size={16} />} />
        <StatCard label="Attendance rate" value={`${scheduleRate}%`} foot={<span>{fmtDate(day, "EEE, MMM d")}</span>} icon={<UserX size={16} />} />
      </div>

      {user.employeeId && (
        <section className="card mb-4 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand"><Clock size={16} /></span>
            <div>
              <div className="text-[12.5px] font-semibold text-ink">My time clock · {selfEmployee?.firstName} {selfEmployee?.lastName}</div>
              <div className="text-[10.5px] text-muted">
                {self ? (
                  self.clockIn ? `${self.clockIn} in · ${self.clockOut ? `${self.clockOut} out · ${self.totalHours.toFixed(1)}h` : "currently on the clock"}` : "No clock-in recorded today."
                ) : "No record for today yet."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge value={self?.status ?? "NO_RECORD"} />
            {self?.clockIn && (
              <span className="text-[10.5px] text-muted">Break {self.breakMins}m · OT {self.overtimeHours.toFixed(1)}h</span>
            )}
          </div>
        </section>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <form method="get" className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted" htmlFor="date">Date</label>
            <input id="date" name="date" type="date" className="input input-sm w-[150px]" defaultValue={format(day, "yyyy-MM-dd")} />
            <select name="employee" className="select input-sm w-[170px]" defaultValue={employeeFilter} aria-label="Employee">
              <option value="">All employees</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
            <select name="status" className="select input-sm w-[140px]" defaultValue={statusFilter} aria-label="Status">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{statusMeta(s).label}</option>)}
            </select>
            <button type="submit" className="btn btn-outline btn-sm">Apply</button>
            <Link href={`/crm/attendance?date=${format(new Date(), "yyyy-MM-dd")}`} className="btn btn-ghost btn-sm">Today</Link>
          </form>
          <div className="ml-auto flex items-center gap-2 text-[10.5px] text-muted">
            <CalendarDays size={12} /> {fmtDate(day, "EEEE, MMMM d, yyyy")}
          </div>
        </div>

        {records.length === 0 ? (
          <EmptyState icon={<Clock />} title="No attendance records" description="Nothing logged for this date and filter combination." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Clock in</th>
                  <th>Clock out</th>
                  <th className="text-right">Break</th>
                  <th className="text-right">Hours</th>
                  <th className="text-right">Overtime</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={`${r.employee.firstName} ${r.employee.lastName}`} color={r.employee.avatarColor} size="sm" />
                        <div>
                          <Link href={`/crm/employees/${r.employee.id}`} className="cell-strong hover:text-brand">{r.employee.firstName} {r.employee.lastName}</Link>
                          <div className="cell-sub">{r.employee.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-[11.5px]">{r.employee.department?.name ?? "—"}</td>
                    <td className="mono text-[11.5px]">{r.clockIn ?? "—"}</td>
                    <td className="mono text-[11.5px]">{r.clockOut ?? "—"}</td>
                    <td className="text-right text-[11.5px]">{r.breakMins}m</td>
                    <td className="text-right mono font-semibold text-ink">{r.totalHours.toFixed(1)}</td>
                    <td className={cn("text-right mono text-[11.5px]", r.overtimeHours > 0 && "text-amber-600 font-semibold")}>{r.overtimeHours.toFixed(1)}</td>
                    <td><Badge value={r.status} /></td>
                    <td className="max-w-[220px] text-[10.5px] text-muted">{r.notes ?? (r.lateMinutes ? `${r.lateMinutes} min late` : "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <section className="card mt-4">
        <div className="card-header">
          <div><div className="card-title">Weekly hours</div><div className="card-sub">{fmtDate(weekStart, "MMM d")} – {fmtDate(addDays(weekStart, 6), "MMM d, yyyy")}</div></div>
          <span className="text-[10.5px] text-muted">{number(weekly.reduce((s, w) => s + w.hours, 0))}h logged</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>Employee</th><th className="text-right">Days</th><th className="text-right">Hours</th><th className="text-right">Overtime</th><th>Utilization</th><th>Late</th></tr>
            </thead>
            <tbody>
              {weekly.map((w) => (
                <tr key={w.employee.id}>
                  <td>
                    <Link href={`/crm/employees/${w.employee.id}`} className="cell-strong hover:text-brand">{w.employee.firstName} {w.employee.lastName}</Link>
                    <div className="cell-sub">{w.employee.position}</div>
                  </td>
                  <td className="text-right mono text-[11.5px]">{w.present}</td>
                  <td className="text-right mono font-semibold text-ink">{w.hours.toFixed(1)}</td>
                  <td className={cn("text-right mono text-[11.5px]", w.overtime > 0 && "text-amber-600")}>{w.overtime.toFixed(1)}</td>
                  <td>
                    <div className="flex w-[130px] items-center gap-2">
                      <Progress value={Math.min(100, (w.hours / 40) * 100)} className="flex-1" tone={w.hours > 45 ? "amber" : w.hours >= 35 ? "green" : "brand"} />
                      <span className="w-8 text-right text-[9.5px] text-muted">{Math.min(999, Math.round((w.hours / 40) * 100))}%</span>
                    </div>
                  </td>
                  <td>{w.late ? <span className="text-[11px] font-semibold text-amber-600">{w.late}</span> : <span className="text-[11px] text-muted">0</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[10.5px] text-muted">
        <span className="flex items-center gap-1.5"><Coffee size={11} /> Standard day: 8 hours with a 30-minute break.</span>
        <span>Estimated day cost: {money(totalHours * 32)}</span>
        <span>Records are audit logged and roll into performance reporting.</span>
      </div>
    </>
  );
}
