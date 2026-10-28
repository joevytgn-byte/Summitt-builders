"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

export type FilterOption = { value: string; label: string };
export type FilterDef = { key: string; label: string; options: FilterOption[]; width?: string };

export function FilterBar({
  placeholder = "Search…",
  filters = [],
  showRange = false,
  showClear = true,
  children,
}: {
  placeholder?: string;
  filters?: FilterDef[];
  showRange?: boolean;
  showClear?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [range, setRange] = useState(sp.get("range") ?? "");
  const mounted = useRef(false);

  useEffect(() => {
    setQ(sp.get("q") ?? "");
  }, [sp]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const t = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q) update("q", q);
    }, 380);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function update(key: string, value: string) {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  function updateMany(entries: Record<string, string>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(entries)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  const activeCount = filters.filter((f) => sp.get(f.key)).length + (sp.get("q") ? 1 : 0) + (sp.get("range") ? 1 : 0);
  const hasCustom = (sp.get("range") ?? "") === "custom";

  return (
    <div className="filter-bar">
      <div className="filter-search relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="input input-sm search-input"
          aria-label="Search records"
        />
        {q && (
          <button onClick={() => { setQ(""); update("q", ""); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink" aria-label="Clear search">
            <X size={13} />
          </button>
        )}
      </div>

      {filters.map((f) => (
        <select
          key={f.key}
          className="select input-sm"
          style={{ width: f.width ?? 145 }}
          value={sp.get(f.key) ?? ""}
          onChange={(e) => update(f.key, e.target.value)}
          aria-label={f.label}
        >
          <option value="">{f.label}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}

      {showRange && (
        <>
          <select
            className="select input-sm"
            style={{ width: 132 }}
            value={range || sp.get("range") || "all"}
            onChange={(e) => {
              const v = e.target.value;
              setRange(v);
              if (v === "all") updateMany({ range: "", from: "", to: "" });
              else updateMany({ range: v });
            }}
            aria-label="Date range"
          >
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
            <option value="year">This year</option>
            <option value="custom">Custom…</option>
          </select>
          {hasCustom && (
            <>
              <input type="date" className="input input-sm" style={{ width: 132 }} value={sp.get("from") ?? ""} onChange={(e) => update("from", e.target.value)} aria-label="From date" />
              <span className="text-[11px] text-muted">to</span>
              <input type="date" className="input input-sm" style={{ width: 132 }} value={sp.get("to") ?? ""} onChange={(e) => update("to", e.target.value)} aria-label="To date" />
            </>
          )}
        </>
      )}

      {showClear && activeCount > 0 && (
        <button className="btn btn-ghost btn-sm" onClick={() => startTransition(() => router.push(pathname, { scroll: false }))}>
          <X size={13} /> Clear
        </button>
      )}

      <div className="ml-auto flex items-center gap-2">
        {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-line2 border-t-brand" aria-label="Updating" />}
        {children}
      </div>
    </div>
  );
}

export function Segmented({ items }: { items: Array<{ label: string; value: string; icon?: React.ReactNode }> }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get("view") ?? items[0]?.value;
  return (
    <div className="tabs">
      {items.map((item) => (
        <button
          key={item.value}
          data-active={current === item.value}
          onClick={() => {
            const params = new URLSearchParams(sp.toString());
            if (item.value === items[0].value) params.delete("view");
            else params.set("view", item.value);
            router.push(`${pathname}?${params.toString()}`, { scroll: false });
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function ViewToggle({ boardLabel = "Board", tableLabel = "Table" }: { boardLabel?: string; tableLabel?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const board = sp.get("view") === "board";
  function go(v: "board" | "table") {
    const params = new URLSearchParams(sp.toString());
    if (v === "table") params.delete("view");
    else params.set("view", v);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }
  return (
    <div className="tabs">
      <button data-active={!board} onClick={() => go("table")}>{tableLabel}</button>
      <button data-active={board} onClick={() => go("board")}>
        <SlidersHorizontal size={12} /> {boardLabel}
      </button>
    </div>
  );
}
