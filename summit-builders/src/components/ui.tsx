import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Inbox, Star } from "lucide-react";
import { cn, money, statusMeta, toDate } from "@/lib/utils";
import { fmtDate } from "@/lib/utils";

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-[8px] bg-brand text-white shrink-0"
      style={{ width: size, height: size, boxShadow: "inset 0 -8px 18px rgb(0 0 0 / .16)" }}
      aria-hidden
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        <path d="M3 20h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M5.5 20V11l6.5-6 6.5 6v9" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" />
        <path d="M9.5 20v-5.2h5V20" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Wordmark({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      {!compact && (
        <span className="leading-none">
          <span className={cn("block text-[15px] font-[750] tracking-[-0.03em]", light ? "text-white" : "text-ink")}>Summit Builders</span>
          <span className={cn("mt-[3px] block text-[9px] font-semibold uppercase tracking-[0.17em]", light ? "text-white/45" : "text-muted")}>Construction CRM</span>
        </span>
      )}
    </span>
  );
}

export function Badge({ value, label, tone, className, plain }: { value?: string | null; label?: string; tone?: string; className?: string; plain?: boolean }) {
  const meta = statusMeta(value);
  return (
    <span className={cn("badge", className)} data-tone={(tone ?? meta.tone) as string} data-plain={plain ? "true" : undefined}>
      {label ?? meta.label}
    </span>
  );
}

export function Avatar({ name, color, size = "md", className }: { name: string; color?: string | null; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizeClass = size === "sm" ? "avatar-sm" : size === "lg" ? "avatar-lg" : size === "xl" ? "avatar-xl" : "";
  const init = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return (
    <span className={cn("avatar", sizeClass, className)} style={color ? { background: color } : undefined} title={name}>
      {init || "?"}
    </span>
  );
}

export function Progress({ value, tone = "brand", className }: { value: number; tone?: "brand" | "green" | "amber" | "red"; className?: string }) {
  const colors = { brand: "var(--brand)", green: "var(--success)", amber: "#d97706", red: "var(--danger)" };
  return (
    <div className={cn("progress", className)}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: colors[tone] }} />
    </div>
  );
}

export function StatCard({
  label, value, foot, icon, accent, href,
}: { label: string; value: ReactNode; foot?: ReactNode; icon?: ReactNode; accent?: boolean; href?: string }) {
  const body = (
    <div className="stat-card h-full">
      {accent && <span className="stat-accent" />}
      <div className="flex items-start justify-between gap-3">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-[23px] font-[750] leading-tight tracking-[-0.035em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[12.5px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", description, action, icon }: { title?: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <Inbox />}
      <div className="empty-title">{title}</div>
      {description && <div className="empty-desc">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Stars({ value = 5 }: { value?: number }) {
  return (
    <div className="flex items-center gap-0.5 text-brand" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={13} fill={i < value ? "currentColor" : "none"} strokeWidth={1.6} />
      ))}
    </div>
  );
}

export function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="text-[11.5px] font-medium text-muted">{label}</span>
      <span className="text-right text-[12.5px] font-medium text-ink">{value ?? "—"}</span>
    </div>
  );
}

export function LinkedValue({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="font-semibold text-ink hover:text-brand">{children}</Link>;
}

export function StatusDot({ value, className }: { value?: string | null; className?: string }) {
  const tone = statusMeta(value).tone;
  const colors: Record<string, string> = {
    green: "#16834b", amber: "#d97706", red: "#c2413a", blue: "#1d6fb8", violet: "#7c3aed",
    orange: "#ee6424", cyan: "#0e7490", teal: "#0f766e", slate: "#94a3b8",
  };
  return <span className={cn("inline-block size-[7px] rounded-full", className)} style={{ background: colors[tone] ?? "#94a3b8" }} />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-[700] tracking-[-0.01em] text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function DataLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted">{label}</div>
      <div className="mt-1 text-[13px] font-medium text-ink">{value}</div>
    </div>
  );
}

export function RelativeDate({ date }: { date: Date | string | null | undefined }) {
  const d = toDate(date);
  if (!d) return <span className="text-muted">—</span>;
  return <span>{fmtDate(d, "MMM d")}</span>;
}

export function Money({ value, compact }: { value: number; compact?: boolean }) {
  return <span className="mono">{money(value, { compact })}</span>;
}

export function ExternalArrow() {
  return <ArrowUpRight size={13} className="inline-block" />;
}
