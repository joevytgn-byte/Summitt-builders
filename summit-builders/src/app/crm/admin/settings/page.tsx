import {
  Building2, Clock, Database, Mail, Plus, Save, Settings, ShieldCheck, Users, Wallet,
} from "lucide-react";
import { requireModule } from "@/lib/access";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/permissions";
import { PageHeader, StatCard, Badge, MetaRow } from "@/components/ui";
import { ActionForm, ActionModal } from "@/components/action-form";
import { createDepartment, saveSettings } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS: Record<string, string> = {
  "company.name": "Summit Builders",
  "company.phone": "(555) 123-4567",
  "company.email": "info@summitbuilders.com",
  "company.address": "1234 Builder Lane, Denver, CO 80204",
  "company.hours": "Mon–Fri 7:00am–6:00pm",
  "company.license": "CO GC License #GC-204918",
  "company.websiteUrl": "http://localhost:3000",
  "ops.taxRate": "0",
  "ops.estimateValidityDays": "30",
  "ops.dispatchStart": "07:30",
  "ops.responseSlaMins": "60",
  "ops.workingDays": "Mon–Fri",
  "notify.salesEmail": "sales@summitbuilders.com",
  "notify.digestTime": "07:00",
};

export default async function SettingsAdminPage() {
  const user = await requireModule("settings");
  const admin = isAdmin(user.role);

  const [content, departments, counts] = await Promise.all([
    db.websiteContent.findMany({ select: { key: true, value: true } }),
    db.department.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { name: "asc" },
    }),
    Promise.all([
      db.user.count(),
      db.customer.count(),
      db.lead.count(),
      db.job.count(),
      db.emailLog.count(),
      db.auditLog.count(),
    ]),
  ]);

  const map = new Map(content.map((c) => [c.key, c.value]));
  const val = (key: string) => map.get(key) ?? DEFAULT_SETTINGS[key] ?? "";
  const [users, customers, leads, jobs, emails, audits] = counts;

  const newDepartment = (
    <ActionModal
      trigger={<button className="btn btn-outline btn-sm"><Plus size={13} /> New department</button>}
      title="Create a department"
      action={createDepartment}
      submitLabel="Create department"
    >
      <div className="grid gap-4">
        <div className="field"><label className="label" htmlFor="d-name">Name<span className="req">*</span></label><input id="d-name" name="name" className="input" required placeholder="e.g. Concrete & Flatwork" /></div>
        <div className="field"><label className="label" htmlFor="d-description">Description</label><textarea id="d-description" name="description" className="textarea" rows={2} /></div>
      </div>
    </ActionModal>
  );

  const field = (key: string, label: string, options?: { type?: string; hint?: string; rows?: number; placeholder?: string }) => {
    const id = `setting-${key.replace(/\./g, "-")}`;
    return (
      <div className="field">
        <label className="label" htmlFor={id}>{label}</label>
        {options?.rows ? (
          <textarea id={id} name={`setting.${key}`} className="textarea" rows={options.rows} defaultValue={val(key)} />
        ) : (
          <input id={id} name={`setting.${key}`} type={options?.type ?? "text"} className="input" defaultValue={val(key)} placeholder={options?.placeholder} />
        )}
        <div className="field-hint mono">{key}</div>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        subtitle="Company profile, operational defaults, notifications and departments."
        actions={<Badge value={`${audits} audited actions`} tone="slate" />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="CRM users" value={users} foot={<span>{emails} emails logged</span>} icon={<Users size={16} />} href="/crm/admin/users" />
        <StatCard label="Customers" value={customers} foot={<span>{leads} leads total</span>} icon={<Building2 size={16} />} />
        <StatCard label="Jobs" value={jobs} foot={<span>{departments.length} departments</span>} icon={<Clock size={16} />} />
        <StatCard label="Audit records" value={audits} foot={<span>full change history</span>} icon={<ShieldCheck size={16} />} href="/crm/admin/audit" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <section className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Building2 size={15} className="text-brand" />
                <div><div className="card-title">Company profile</div><div className="card-sub">Used across the website, quote emails and the CRM</div></div>
              </div>
            </div>
            <ActionForm action={saveSettings} className="p-5" submitLabel="Save company profile">
              {(
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("company.name", "Company name")}
                  {field("company.phone", "Phone")}
                  {field("company.email", "Email", { type: "email" })}
                  {field("company.websiteUrl", "Website URL", { placeholder: "https://summitbuilders.com" })}
                  <div className="sm:col-span-2">{field("company.address", "Office address")}</div>
                  <div className="sm:col-span-2">{field("company.hours", "Business hours")}</div>
                  <div className="sm:col-span-2">{field("company.license", "License / insurance")}</div>
                </div>
              )}
            </ActionForm>
          </section>

          <section className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Wallet size={15} className="text-brand" />
                <div><div className="card-title">Operational defaults</div><div className="card-sub">Estimates, dispatch and response targets</div></div>
              </div>
            </div>
            <ActionForm action={saveSettings} className="p-5" submitLabel="Save operations">
              {(
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("ops.taxRate", "Default tax rate (%)", { hint: "Applied to new estimates." })}
                  {field("ops.estimateValidityDays", "Estimate validity (days)", { hint: "Default expiry for proposals." })}
                  {field("ops.dispatchStart", "Dispatch day starts", { type: "time", hint: "Crew arrival target." })}
                  {field("ops.responseSlaMins", "Lead response SLA (minutes)", { hint: "Target first response time." })}
                  <div className="sm:col-span-2">{field("ops.workingDays", "Standard working days")}</div>
                </div>
              )}
            </ActionForm>
          </section>

          <section className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Mail size={15} className="text-brand" />
                <div><div className="card-title">Notifications & email</div><div className="card-sub">Simulated outbox — every message is logged in the CRM</div></div>
              </div>
            </div>
            <ActionForm action={saveSettings} className="p-5" submitLabel="Save notifications">
              {(
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("notify.salesEmail", "Sales notification email", { type: "email" })}
                  {field("notify.digestTime", "Daily digest time", { type: "time" })}
                  <div className="sm:col-span-2 rounded-lg border border-line bg-panel2 p-3 text-[11px] leading-relaxed text-muted">
                    Outbound email is captured in the <strong className="text-ink2">Email log</strong> for the demo. Website inquiries notify assigned sales reps and managers in-app, and acknowledgements are logged against the request.
                  </div>
                </div>
              )}
            </ActionForm>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-brand" />
                <div><div className="card-title">Departments</div><div className="card-sub">{departments.length} teams</div></div>
              </div>
              {admin && newDepartment}
            </div>
            <div className="divide-y divide-line">
              {departments.map((d) => (
                <div key={d.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-ink">{d.name}</div>
                    <div className="truncate text-[10.5px] text-muted">{d.description ?? "No description"}</div>
                  </div>
                  <span className="kanban-count shrink-0">{d._count.employees}</span>
                </div>
              ))}
              {!departments.length && <div className="px-4 py-8 text-center text-[11px] text-muted">No departments yet.</div>}
            </div>
          </section>

          <section className="card p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted"><Database size={11} /> System</div>
            <MetaRow label="Application" value="Summit CRM" />
            <MetaRow label="Database" value={<span className="mono">SQLite · prisma/dev.db</span>} />
            <MetaRow label="Framework" value="Next.js 15" />
            <MetaRow label="Users" value={users} />
            <MetaRow label="Audit entries" value={audits} />
            <MetaRow label="Email log" value={emails} />
            <MetaRow label="Signed in as" value={user.email} />
          </section>

          <section className="card p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted"><Settings size={11} /> Demo notes</div>
            <ul className="space-y-1.5 text-[10.5px] leading-relaxed text-muted">
              <li>· Seed data is generated relative to today, so KPIs and schedules look current.</li>
              <li>· All demo accounts use the password <span className="mono text-ink2">demo1234</span>.</li>
              <li>· Emails are logged rather than sent — no SMTP credentials required.</li>
              <li>· Record-level permissions are enforced server side, not just hidden in the UI.</li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
