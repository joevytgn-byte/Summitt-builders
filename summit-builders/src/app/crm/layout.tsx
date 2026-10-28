import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { leadScope } from "@/lib/access";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!user.employee) {
    // Support users are still allowed; render without an avatar.
  }
  const [unread, newLeads] = await Promise.all([
    db.notification.count({ where: { userId: user.id, read: false } }),
    db.lead.count({ where: { AND: [leadScope(user), { status: "NEW" }] } }),
  ]);

  return (
    <AppShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        employee: user.employee
          ? { id: user.employee.id, position: user.employee.position, avatarColor: user.employee.avatarColor }
          : null,
      }}
      counts={{ notifications: unread, leads: newLeads }}
    >
      {children}
    </AppShell>
  );
}
