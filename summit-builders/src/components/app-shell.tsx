"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Bell, CalendarDays, ChevronDown, Columns3, ExternalLink, FileText, Globe,
  HardHat, Inbox, LayoutDashboard, LogOut, Menu, Phone, Search, Settings, ShieldCheck,
  ScrollText, Target, Truck, UserRound, Users, X, Clock, TrendingUp,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { canAccess, type ModuleKey } from "@/lib/permissions";
import { NAV_GROUPS } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/ui";
import { logoutAction } from "@/app/actions/auth";

const ICONS: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  LayoutDashboard, Target, Inbox, Users, Columns3, FileText, HardHat, Truck, CalendarDays,
  Phone, UserRound, Clock, TrendingUp, BarChart3, Bell, Globe, ShieldCheck, Settings, ScrollText,
};

type ShellUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  employee: { id: string; position: string; avatarColor: string | null } | null;
};

export function AppShell({
  user, counts, children,
}: {
  user: ShellUser;
  counts: { notifications: number; leads: number };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => canAccess(user.role, i.module as ModuleKey)),
  })).filter((g) => g.items.length > 0);

  const roleLabel = user.role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const badge = (key?: "notifications" | "leads") => {
    if (key === "notifications") return counts.notifications;
    if (key === "leads") return counts.leads;
    return 0;
  };

  return (
    <div className="crm-shell">
      {open && <div className="scrim lg:hidden" onClick={() => setOpen(false)} />}
      <aside className="crm-sidebar" data-open={open} aria-label="Main navigation">
        <div className="brand-lockup">
          <Link href="/crm/dashboard" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="leading-none">
              <span className="block text-[14.5px] font-[750] tracking-[-0.03em] text-white">Summit Builders</span>
              <span className="mt-[3px] block text-[9px] font-semibold uppercase tracking-[0.16em] text-white/40">Construction CRM</span>
            </span>
          </Link>
          <button className="ml-auto text-white/50 hover:text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto pb-4">
          {groups.map((group) => (
            <div className="nav-section" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const count = badge(item.badgeKey);
                return (
                  <Link key={item.href} href={item.href} className="nav-link" data-active={active}>
                    <Icon size={16} />
                    <span>{item.label}</span>
                    {count > 0 && <span className="nav-count" data-hot={item.badgeKey === "leads"}>{count > 99 ? "99+" : count}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.06] p-3">
          <Link href="/" target="_blank" className="nav-link">
            <ExternalLink size={16} />
            <span>View public website</span>
          </Link>
          <div className="mt-2 flex items-center gap-2.5 rounded-lg px-2 py-2.5">
            <span className="avatar avatar-sm" style={{ background: user.employee?.avatarColor ?? "#ee6424" }}>{initials(user.name)}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-white">{user.name}</div>
              <div className="truncate text-[10px] text-white/40">{roleLabel}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="crm-main">
        <header className="crm-topbar">
          <button className="icon-btn mobile-menu-btn" onClick={() => setOpen(true)} aria-label="Open navigation">
            <Menu size={19} />
          </button>

          <form action="/crm/search" method="get" className="topbar-search relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              name="q" value={search} onChange={(e) => setSearch(e.target.value)}
              className="input search-input" placeholder="Search customers, leads, jobs…"
              aria-label="Global search"
            />
            <span className="kbd absolute right-3 top-1/2 hidden -translate-y-1/2 md:inline">↵</span>
          </form>
          <Link href="/crm/search" className="icon-btn topbar-search-sm" aria-label="Search">
            <Search size={18} />
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Link href="/crm/notifications" className="icon-btn" aria-label={`Notifications${counts.notifications ? ` (${counts.notifications} unread)` : ""}`}>
              <Bell size={18} />
              {counts.notifications > 0 && <span className="dot" />}
            </Link>
            <div className="relative" ref={menuRef}>
              <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-panel2" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
                <span className="avatar avatar-sm" style={{ background: user.employee?.avatarColor ?? "#ee6424" }}>{initials(user.name)}</span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[130px] truncate text-[12px] font-semibold leading-tight text-ink">{user.name}</span>
                  <span className="block max-w-[130px] truncate text-[10px] leading-tight text-muted">{roleLabel}</span>
                </span>
                <ChevronDown size={13} className="text-muted" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-[46px] z-50 w-60 overflow-hidden rounded-xl border border-line bg-panel shadow-lg">
                  <div className="border-b border-line px-4 py-3">
                    <div className="text-[12.5px] font-semibold text-ink">{user.name}</div>
                    <div className="truncate text-[11px] text-muted">{user.email}</div>
                    <div className="mt-1.5 inline-flex rounded bg-panel2 px-1.5 py-0.5 text-[10px] font-semibold text-ink2">{roleLabel}</div>
                  </div>
                  <form action={logoutAction}>
                    <button type="submit" className="flex w-full items-center gap-2 px-4 py-3 text-left text-[12px] font-medium text-ink2 hover:bg-panel2">
                      <LogOut size={14} /> Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="crm-content">{children}</main>
      </div>
    </div>
  );
}
