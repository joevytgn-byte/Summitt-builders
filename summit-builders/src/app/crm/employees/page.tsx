import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BadgeCheck, Building2, Mail, Phone, Plus, UserRound, Users, Wallet } from "lucide-react";
import { requireModule } from "@/lib/access";
import { db } from "@/lib/db";
import { fmtDate, money, number, statusMeta } from "@/lib/utils";
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { FilterBar, ViewToggle } from "@/components/filters";
import { Pagination, SortTh } from "@/components/table";
import { ActionModal } from "@/components/action-form";
import { createEmployee } from "@/app/actions/employees";
import { isAdmin } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("employees");
  const params = await searchParams;
  const str = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const q = str("q");
  const status = str("status");
  const department = str("department");
  const sort = str("sort") || "name";
  const dir = (str("dir") || "asc") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(str("page")) || 1);

  const where: Prisma.EmployeeWhereInput = {
    AND: [
      status ? { status } : {},
      department ? { departmentId: department } : {},
      q
        ? {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
              { position: { contains: q } },
              { employeeNo: { contains: q } },
              { skills: { contains: q } },
            ],
          }
        : {},
    ],
  };

  const orderBy: Prisma.EmployeeOrderByWithRelationInput =
    sort === "hired" ? { hireDate: dir }
    : sort === "employeeNo" ? { employeeNo: dir }
    : sort === "rate" ? { hourlyRate: dir }
    : sort === "department" ? { department: { name: dir } }
    : { firstName: dir };

  const [employees, total, departments, all] = await Promise.all([
    db.employee.findMany({
      where,
      include: {
        department: { select: { name: true } },
        user: { select: { id: true, role: true, active: true } },
        _count: { select: { jobAssignments: true, leads: true, calls: true, attendance: true } },
      },
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.employee.count({ where }),
    db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.employee.findMany({ select: { status: true, hourlyRate: true, departmentId: true, hireDate: true } }),
  ]);

  const active = all.filter((e) => e.status === "ACTIVE").length;
  const payroll = all.filter((e) => e.status === "ACTIVE").reduce((s, e) => s + e.hourlyRate * 40, 0);
  const avgTenure = all.length
    ? all.reduce((s, e) => s + (Date.now() - e.hireDate.getTime()) / (365.25 * 86_400_000), 0) / all.length
    : 0;
  const admin = isAdmin(user.role);

  const filterDefs = [
    { key: "status", label: "All statuses", options: ["ACTIVE", "INACTIVE", "ARCHIVED"].map((s) => ({ value: s, label: statusMeta(s).label })), width: "140px" },
    { key: "department", label: "All departments", options: departments.map((d) => ({ value: d.id, label: d.name })), width: "160px" },
  ];

  const newEmployee = admin ? (
    <ActionModal
      trigger={<button className="btn btn-primary"><Plus size={15} /> Add employee</button>}
      title="Add an employee"
      subtitle="Creates the crew record. A login can be linked from Users & Permissions."
      size="lg"
      action={createEmployee}
      submitLabel="Add employee"
      successRedirect="/crm/employees"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field"><label className="label" htmlFor="firstName">First name<span className="req">*</span></label><input id="firstName" name="firstName" className="input" required /></div>
        <div className="field"><label className="label" htmlFor="lastName">Last name<span className="req">*</span></label><input id="lastName" name="lastName" className="input" required /></div>
        <div className="field"><label className="label" htmlFor="email">Email<span className="req">*</span></label><input id="email" name="email" type="email" className="input" required /></div>
        <div className="field"><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" className="input" /></div>
        <div className="field"><label className="label" htmlFor="position">Position<span className="req">*</span></label><input id="position" name="position" className="input" required placeholder="e.g. Lead Carpenter" /></div>
        <div className="field">
          <label className="label" htmlFor="departmentId">Department</label>
          <select id="departmentId" name="departmentId" className="select" defaultValue="">
            <option value="">Unassigned</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field"><label className="label" htmlFor="hireDate">Hire date</label><input id="hireDate" name="hireDate" type="date" className="input" defaultValue={fmtDate(new Date(), "yyyy-MM-dd")} /></div>
        <div className="field"><label className="label" htmlFor="hourlyRate">Hourly rate ($)</label><input id="hourlyRate" name="hourlyRate" className="input" inputMode="decimal" /></div>
        <div className="field"><label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="select" defaultValue="ACTIVE"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
        </div>
        <div className="field"><label className="label" htmlFor="managerId">Reports to</label>
          <select id="managerId" name="managerId" className="select" defaultValue=""><option value="">—</option></select>
        </div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="skills">Skills</label><input id="skills" name="skills" className="input" placeholder="Framing, finish carpentry, OSHA 30" /></div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="address">Address</label><input id="address" name="address" className="input" /></div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="emergencyContact">Emergency contact</label><input id="emergencyContact" name="emergencyContact" className="input" /></div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="notes">Notes</label><textarea id="notes" name="notes" className="textarea" rows={2} /></div>
      </div>
    </ActionModal>
  ) : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="Employees"
        subtitle="Crew records, trades, rates and job history for everyone on the Summit team."
        actions={newEmployee}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Headcount" value={number(all.length)} foot={<span>{active} active</span>} icon={<Users size={16} />} />
        <StatCard label="Departments" value={number(departments.length)} foot={<span>{new Set(all.map((e) => e.departmentId)).size} staffed</span>} icon={<Building2 size={16} />} />
        <StatCard label="Weekly payroll" value={money(payroll, { compact: true })} foot={<span>active crew · 40h</span>} icon={<Wallet size={16} />} />
        <StatCard label="Avg. tenure" value={`${avgTenure.toFixed(1)} yrs`} foot={<span>across the team</span>} icon={<BadgeCheck size={16} />} />
      </div>

      <div className="card overflow-hidden">
        <FilterBar placeholder="Search name, position, skill, email…" filters={filterDefs}>
          <ViewToggle boardLabel="Cards" tableLabel="Table" />
        </FilterBar>

        {total === 0 ? (
          <EmptyState icon={<UserRound />} title="No employees found" description="Adjust the filters or add a team member." />
        ) : str("view") === "board" ? (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {employees.map((e) => (
              <Link key={e.id} href={`/crm/employees/${e.id}`} className="card card-pad hover:border-line2">
                <div className="flex items-start gap-2.5">
                  <Avatar name={`${e.firstName} ${e.lastName}`} color={e.avatarColor} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-ink">{e.firstName} {e.lastName}</div>
                    <div className="truncate text-[10.5px] text-muted">{e.position}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge value={e.status} />
                      {e.user && <Badge value={e.user.role} />}
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-[10.5px] text-muted">
                  <div className="flex items-center gap-1.5 truncate"><Mail size={10} /> {e.email}</div>
                  {e.phone && <div className="flex items-center gap-1.5"><Phone size={10} /> {e.phone}</div>}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-2.5 text-center">
                  <div><div className="text-[13px] font-bold text-ink">{e._count.jobAssignments}</div><div className="text-[9px] uppercase tracking-[0.06em] text-muted">Jobs</div></div>
                  <div><div className="text-[13px] font-bold text-ink">{e._count.leads}</div><div className="text-[9px] uppercase tracking-[0.06em] text-muted">Leads</div></div>
                  <div><div className="text-[12px] font-bold text-ink">{money(e.hourlyRate)}</div><div className="text-[9px] uppercase tracking-[0.06em] text-muted">Rate</div></div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <SortTh label="Employee" column="name" pathname="/crm/employees" params={params} />
                    <SortTh label="Department" column="department" pathname="/crm/employees" params={params} />
                    <th>Contact</th>
                    <th>Login role</th>
                    <SortTh label="Rate" column="rate" pathname="/crm/employees" params={params} align="right" />
                    <th className="text-right">Jobs</th>
                    <SortTh label="Hired" column="hired" pathname="/crm/employees" params={params} />
                    <SortTh label="Status" column="status" pathname="/crm/employees" params={params} />
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} data-clickable="true">
                      <td>
                        <div className="flex items-center gap-2">
                          <Avatar name={`${e.firstName} ${e.lastName}`} color={e.avatarColor} size="sm" />
                          <div>
                            <Link href={`/crm/employees/${e.id}`} className="cell-strong hover:text-brand">{e.firstName} {e.lastName}</Link>
                            <div className="cell-sub">{e.position} · {e.employeeNo}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-[11.5px]">{e.department?.name ?? "—"}</td>
                      <td>
                        <div className="text-[11px]">{e.email}</div>
                        {e.phone && <div className="cell-sub">{e.phone}</div>}
                      </td>
                      <td>{e.user ? <Badge value={e.user.role} /> : <span className="text-[10.5px] text-muted">No login</span>}</td>
                      <td className="text-right mono text-[11.5px]">{money(e.hourlyRate)}/hr</td>
                      <td className="text-right mono text-[11.5px]">{e._count.jobAssignments}</td>
                      <td className="nowrap text-[11.5px] text-muted">{fmtDate(e.hireDate, "MMM yyyy")}</td>
                      <td><Badge value={e.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} pathname="/crm/employees" params={params} />
          </>
        )}
      </div>
    </>
  );
}
