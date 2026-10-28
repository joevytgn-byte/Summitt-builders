import { KeyRound, Pencil, Plus, ShieldCheck, ShieldOff, UserCheck, UserRound, Users, UserX } from "lucide-react";
import { requireModule } from "@/lib/access";
import { db } from "@/lib/db";
import { ACCESS, ROLE_LABELS, isAdmin, type Role } from "@/lib/permissions";
import { fmtDateTime, statusMeta, timeAgo } from "@/lib/utils";
import { Avatar, Badge, PageHeader, StatCard } from "@/components/ui";
import { ActionButton, ActionModal } from "@/components/action-form";
import { createUser, resetUserPassword, setUserActive, updateUser } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

const ROLES = ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "SALES_REP", "PROJECT_MANAGER", "DISPATCHER", "FIELD"] as Role[];

const ROLE_NOTES: Record<string, string> = {
  SUPER_ADMIN: "Unrestricted access, including users and audit.",
  ADMIN: "Everything except managing other admins' roles.",
  SALES_MANAGER: "Full sales desk, reporting and team performance.",
  SALES_REP: "Own leads, customers and estimates only.",
  PROJECT_MANAGER: "Delivery, crews, attendance and reports.",
  DISPATCHER: "Scheduling, jobs and field coordination.",
  FIELD: "Own schedule, jobs and time clock only.",
};

export default async function UsersAdminPage() {
  const user = await requireModule("users");
  if (!isAdmin(user.role)) {
    return (
      <>
        <PageHeader eyebrow="Administration" title="Users & permissions" subtitle="Only administrators can manage accounts." />
        <div className="card p-10 text-center text-[12px] text-muted">You do not have permission to view this page.</div>
      </>
    );
  }

  const [users, employees] = await Promise.all([
    db.user.findMany({
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, position: true, avatarColor: true } },
        _count: { select: { sessions: true, auditLogs: true } },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    db.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, position: true, user: { select: { id: true } } },
      orderBy: { firstName: "asc" },
    }),
  ]);

  const active = users.filter((u) => u.active).length;
  const admins = users.filter((u) => ["SUPER_ADMIN", "ADMIN"].includes(u.role)).length;
  const unlinked = employees.filter((e) => !e.user).length;
  const canManageSuper = user.role === "SUPER_ADMIN";

  const newUser = (
    <ActionModal
      trigger={<button className="btn btn-primary"><Plus size={15} /> New user</button>}
      title="Create a CRM user"
      subtitle="Accounts can be linked to an employee record for scheduling and time tracking."
      size="lg"
      action={createUser}
      submitLabel="Create account"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="field"><label className="label" htmlFor="nu-name">Full name<span className="req">*</span></label><input id="nu-name" name="name" className="input" required /></div>
        <div className="field"><label className="label" htmlFor="nu-email">Email<span className="req">*</span></label><input id="nu-email" name="email" type="email" className="input" required /></div>
        <div className="field"><label className="label" htmlFor="nu-role">Role<span className="req">*</span></label>
          <select id="nu-role" name="role" className="select" defaultValue="SALES_REP">
            {ROLES.filter((r) => canManageSuper || r !== "SUPER_ADMIN").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div className="field"><label className="label" htmlFor="nu-phone">Phone</label><input id="nu-phone" name="phone" className="input" /></div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="nu-employee">Linked employee</label>
          <select id="nu-employee" name="employeeId" className="select" defaultValue="">
            <option value="">No employee record</option>
            {employees.filter((e) => !e.user).map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.position}</option>)}
          </select>
        </div>
        <div className="field sm:col-span-2"><label className="label" htmlFor="nu-password">Temporary password<span className="req">*</span></label><input id="nu-password" name="password" type="password" className="input" minLength={8} required /><div className="field-hint">At least 8 characters. Share it securely; they can keep or change it later.</div></div>
      </div>
    </ActionModal>
  );

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Users & permissions"
        subtitle="Control who can sign in, what they can see, and which employee record they represent."
        actions={newUser}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Accounts" value={users.length} foot={<span>{active} active</span>} icon={<Users size={16} />} />
        <StatCard label="Administrators" value={admins} foot={<span>admin + super admin</span>} icon={<ShieldCheck size={16} />} />
        <StatCard label="Linked employees" value={`${employees.length - unlinked}/${employees.length}`} foot={<span>{unlinked} unlinked</span>} icon={<UserCheck size={16} />} />
        <StatCard label="Disabled" value={users.length - active} foot={<span>sessions revoked on disable</span>} icon={<UserX size={16} />} />
      </div>

      <section className="card mb-4 overflow-hidden">
        <div className="card-header">
          <div><div className="card-title">User accounts</div><div className="card-sub">Roles, employee links and account status</div></div>
          <span className="text-[10.5px] text-muted">Signed in as {user.name}</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Employee link</th>
                <th>Last login</th>
                <th>Status</th>
                <th className="text-right">Sessions</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const protectedSuper = u.role === "SUPER_ADMIN" && !canManageSuper;
                const isSelf = u.id === user.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar name={u.name} color={u.employee?.avatarColor} size="sm" />
                        <div>
                          <div className="cell-strong">{u.name}{isSelf && <span className="ml-1.5 text-[9px] font-semibold text-brand">YOU</span>}</div>
                          <div className="cell-sub">{u.email}{u.phone ? ` · ${u.phone}` : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge value={u.role} />
                      <div className="mt-0.5 text-[9.5px] text-muted">{ROLE_LABELS[u.role as Role] ?? u.role}</div>
                    </td>
                    <td className="text-[11px]">
                      {u.employee ? (
                        <>
                          <div className="font-medium text-ink2">{u.employee.firstName} {u.employee.lastName}</div>
                          <div className="cell-sub">{u.employee.position}</div>
                        </>
                      ) : <span className="text-muted">Not linked</span>}
                    </td>
                    <td className="text-[11px] text-muted">
                      {u.lastLoginAt ? (
                        <><div>{timeAgo(u.lastLoginAt)}</div><div className="text-[9.5px]">{fmtDateTime(u.lastLoginAt)}</div></>
                      ) : "Never"}
                    </td>
                    <td><Badge value={u.active ? "ACTIVE" : "INACTIVE"} /></td>
                    <td className="text-right mono text-[11px]">{u._count.sessions}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <ActionModal
                          trigger={<button className="btn btn-ghost btn-sm" aria-label={`Edit ${u.name}`} disabled={protectedSuper}><Pencil size={13} /></button>}
                          title="Edit user"
                          subtitle={u.email}
                          action={updateUser}
                          submitLabel="Save changes"
                        >
                          <input type="hidden" name="id" value={u.id} />
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="field"><label className="label" htmlFor={`un-${u.id}`}>Name</label><input id={`un-${u.id}`} name="name" className="input" defaultValue={u.name} /></div>
                            <div className="field"><label className="label" htmlFor={`up-${u.id}`}>Phone</label><input id={`up-${u.id}`} name="phone" className="input" defaultValue={u.phone ?? ""} /></div>
                            <div className="field sm:col-span-2"><label className="label" htmlFor={`ur-${u.id}`}>Role</label>
                              <select id={`ur-${u.id}`} name="role" className="select" defaultValue={u.role}>
                                {ROLES.filter((r) => canManageSuper || r !== "SUPER_ADMIN").map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                              </select>
                              <div className="field-hint">{ROLE_NOTES[u.role]}</div>
                            </div>
                            <div className="field sm:col-span-2"><label className="label" htmlFor={`ue-${u.id}`}>Linked employee</label>
                              <select id={`ue-${u.id}`} name="employeeId" className="select" defaultValue={u.employeeId ?? ""}>
                                <option value="">No employee record</option>
                                {employees.filter((e) => !e.user || e.id === u.employeeId).map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.position}</option>)}
                              </select>
                            </div>
                          </div>
                        </ActionModal>
                        <ActionModal
                          trigger={<button className="btn btn-ghost btn-sm" aria-label={`Reset password for ${u.name}`} disabled={protectedSuper}><KeyRound size={13} /></button>}
                          title="Reset password"
                          subtitle="Existing sessions will be signed out immediately."
                          action={resetUserPassword}
                          submitLabel="Reset password"
                        >
                          <input type="hidden" name="id" value={u.id} />
                          <div className="field"><label className="label" htmlFor={`pw-${u.id}`}>New password</label><input id={`pw-${u.id}`} name="password" type="password" className="input" minLength={8} required /><div className="field-hint">Minimum 8 characters.</div></div>
                        </ActionModal>
                        <ActionButton
                          action={setUserActive.bind(null, u.id, !u.active)}
                          label=""
                          icon={u.active ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                          variant={u.active ? "ghost" : "outline"}
                          size="sm"
                          confirm={u.active ? `Deactivate ${u.name}? They will be signed out and unable to log in.` : `Reactivate ${u.name}?`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div><div className="card-title">Role permission matrix</div><div className="card-sub">Module access is enforced in the sidebar, pages and server actions</div></div>
          <ShieldCheck size={15} className="text-muted" />
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Role</th>
                <th>Modules</th>
                <th className="text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((role) => {
                const allowed = ACCESS[role];
                return (
                  <tr key={role}>
                    <td>
                      <div className="cell-strong">{ROLE_LABELS[role]}</div>
                      <div className="cell-sub">{ROLE_NOTES[role]}</div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {allowed === "*" ? (
                          <Badge value="ALL MODULES" tone="green" />
                        ) : (
                          allowed.map((m) => <span key={m} className="rounded border border-line bg-panel2 px-1.5 py-0.5 text-[9.5px] font-medium text-ink2">{m}</span>)
                        )}
                      </div>
                    </td>
                    <td className="text-right mono text-[11px]">{allowed === "*" ? "—" : allowed.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-2.5 text-[10px] text-muted">
          Record-level scope: sales reps only see their own leads, customers and estimates. Field crew only see jobs they are assigned to and their own attendance.
        </div>
      </section>
    </>
  );
}
