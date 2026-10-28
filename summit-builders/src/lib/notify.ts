import { db } from "@/lib/db";

type NotifyInput = {
  roles?: string[];
  userIds?: string[];
  employeeIds?: string[];
  type?: string;
  title: string;
  body?: string;
  link?: string;
};

export async function notify({ roles, userIds, employeeIds, type = "INFO", title, body, link }: NotifyInput) {
  const targets = new Map<string, string | null>();

  if (roles?.length) {
    const users = await db.user.findMany({ where: { role: { in: roles }, active: true }, select: { id: true } });
    for (const u of users) targets.set(u.id, null);
  }
  if (employeeIds?.length) {
    const users = await db.user.findMany({ where: { employeeId: { in: employeeIds }, active: true }, select: { id: true, employeeId: true } });
    for (const u of users) targets.set(u.id, u.employeeId);
  }
  for (const id of userIds ?? []) targets.set(id, null);

  if (!targets.size) return;
  await db.notification.createMany({
    data: [...targets.entries()].map(([userId, employeeId]) => ({
      userId,
      employeeId,
      type,
      title,
      body,
      link,
      read: false,
    })),
  });
}

export async function sendEmail({ to, subject, body, relatedType, relatedId }: { to: string; subject: string; body: string; relatedType?: string; relatedId?: string }) {
  if (!to) return null;
  return db.emailLog.create({
    data: { to, subject, body, relatedType, relatedId, status: "SENT" },
  });
}

export async function companyNotifyEmail() {
  const row = await db.websiteContent.findUnique({ where: { key: "company.email" } });
  return row?.value || "info@summitbuilders.com";
}

export async function appUrl() {
  const row = await db.websiteContent.findUnique({ where: { key: "company.websiteUrl" } });
  return row?.value || process.env.APP_URL || "http://localhost:3000";
}
