import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Bell, BellRing, CheckCheck, CheckCircle2, CircleAlert, Clock, Inbox, Mail, Trash2, Truck, UserPlus } from "lucide-react";
import { requireModule } from "@/lib/access";
import { db } from "@/lib/db";
import { fmtDateTime, timeAgo } from "@/lib/utils";
import { Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { ActionButton } from "@/components/action-form";
import { FilterBar } from "@/components/filters";
import { deleteNotification, markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPES = ["INFO", "SUCCESS", "WARNING", "URGENT", "ASSIGNMENT", "SYSTEM"];

function typeTone(type: string) {
  if (type === "URGENT") return "red";
  if (type === "WARNING") return "amber";
  if (type === "SUCCESS") return "green";
  if (type === "ASSIGNMENT") return "violet";
  return "blue";
}

function TypeIcon({ type }: { type: string }) {
  if (type === "URGENT" || type === "WARNING") return <CircleAlert size={15} />;
  if (type === "SUCCESS") return <CheckCircle2 size={15} />;
  if (type === "ASSIGNMENT") return <Truck size={15} />;
  if (type === "SYSTEM") return <BellRing size={15} />;
  return <Mail size={15} />;
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("notifications");
  const params = await searchParams;
  const str = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };
  const tab = str("tab") === "unread" ? "unread" : str("tab") === "read" ? "read" : "all";
  const type = str("type");
  const q = str("q");

  const scope: Prisma.NotificationWhereInput = {
    OR: [{ userId: user.id }, { userId: null, role: user.role }, { userId: null, role: null }],
  };
  const where: Prisma.NotificationWhereInput = {
    AND: [
      scope,
      tab === "unread" ? { read: false } : tab === "read" ? { read: true } : {},
      type ? { type } : {},
      q ? { OR: [{ title: { contains: q } }, { body: { contains: q } }] } : {},
    ],
  };

  const [items, total, unread, read, byType, todayCount] = await Promise.all([
    db.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
    db.notification.count({ where: scope }),
    db.notification.count({ where: { AND: [scope, { read: false }] } }),
    db.notification.count({ where: { AND: [scope, { read: true }] } }),
    db.notification.groupBy({ by: ["type"], where: { AND: [scope, { read: false }] }, _count: true }),
    db.notification.count({ where: { AND: [scope, { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }] } }),
  ]);

  const tabLink = (key: string) => {
    const p = new URLSearchParams();
    if (key !== "all") p.set("tab", key);
    if (type) p.set("type", type);
    if (q) p.set("q", q);
    const qs = p.toString();
    return `/crm/notifications${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        subtitle="Assignments, approvals, conflicts and system alerts — scoped to your role."
        actions={
          <ActionButton
            action={markAllNotificationsRead}
            label="Mark all read"
            icon={<CheckCheck size={14} />}
            variant="outline"
          />
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Unread" value={unread} foot={<span>{total} total notifications</span>} icon={<Bell size={16} />} />
        <StatCard label="Today" value={todayCount} foot={<span>received since midnight</span>} icon={<Clock size={16} />} />
        <StatCard label="Read" value={read} foot={<span>archive stays searchable</span>} icon={<CheckCircle2 size={16} />} />
        <StatCard
          label="Needs attention"
          value={byType.filter((b) => ["URGENT", "WARNING"].includes(b.type)).reduce((s, b) => s + b._count, 0)}
          foot={<span>urgent and warning alerts</span>}
          icon={<CircleAlert size={16} />}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <div className="tabs">
            <Link href={tabLink("all")} data-active={tab === "all"}>All <span className="ml-1 text-[10px] text-muted">{total}</span></Link>
            <Link href={tabLink("unread")} data-active={tab === "unread"}>Unread <span className="ml-1 text-[10px] text-muted">{unread}</span></Link>
            <Link href={tabLink("read")} data-active={tab === "read"}>Read <span className="ml-1 text-[10px] text-muted">{read}</span></Link>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {byType.map((b) => (
              <Badge key={b.type} value={b.type} tone={typeTone(b.type)} label={`${b.type.toLowerCase()} · ${b._count}`} />
            ))}
          </div>
        </div>

        <FilterBar
          placeholder="Search notifications…"
          filters={[{ key: "type", label: "All types", options: TYPES.map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() })), width: "150px" }]}
          showClear={false}
        />

        {items.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={tab === "unread" ? "You're all caught up" : "No notifications found"}
            description={tab === "unread" ? "New assignments and alerts will show up here." : "Try a different filter or search term."}
          />
        ) : (
          <div className="divide-y divide-line">
            {items.map((n) => (
              <div key={n.id} className={cn("flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-panel2/70", !n.read && "bg-brand-soft/25")}>
                <span
                  className={cn(
                    "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                    n.type === "URGENT" || n.type === "WARNING"
                      ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                      : n.type === "SUCCESS"
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "bg-brand-soft text-brand",
                  )}
                >
                  <TypeIcon type={n.type} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-[12.5px]", n.read ? "font-medium text-ink2" : "font-semibold text-ink")}>{n.title}</span>
                    <Badge value={n.type} tone={typeTone(n.type)} plain />
                    {!n.read && <span className="size-1.5 rounded-full bg-brand" aria-label="Unread" />}
                  </div>
                  {n.body && <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{n.body}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-muted">
                    <span title={fmtDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</span>
                    {n.employeeId && <span className="flex items-center gap-1"><UserPlus size={10} /> crew record linked</span>}
                    {n.link && (
                      <Link href={n.link} className="font-semibold text-brand hover:underline">Open record →</Link>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!n.read && (
                    <ActionButton
                      action={markNotificationRead.bind(null, n.id)}
                      label="Mark read"
                      icon={<CheckCircle2 size={13} />}
                      variant="ghost"
                      size="sm"
                    />
                  )}
                  <ActionButton
                    action={deleteNotification.bind(null, n.id)}
                    label=""
                    icon={<Trash2 size={13} />}
                    variant="ghost"
                    size="sm"
                    confirm="Dismiss this notification?"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-[10.5px] text-muted">
        Showing the latest {items.length} of {total} notifications for your account. Notifications are generated automatically when records change hands.
      </p>
    </>
  );
}
