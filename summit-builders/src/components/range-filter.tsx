"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
];

export function RangeFilter({ defaultRange = "month" }: { defaultRange?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get("range") ?? defaultRange;
  const [customOpen, setCustomOpen] = useState(current === "custom");
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");

  function go(params: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="relative flex flex-wrap items-center gap-1.5">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-panel p-1">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => { setCustomOpen(false); go({ range: p.value, from: undefined, to: undefined }); }}
            className={cn(
              "h-7 rounded-md px-2.5 text-[11.5px] font-semibold transition",
              current === p.value ? "bg-dark text-white" : "text-muted hover:bg-panel2 hover:text-ink",
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setCustomOpen((v) => !v)}
          className={cn("flex h-7 items-center gap-1 rounded-md px-2.5 text-[11.5px] font-semibold transition", current === "custom" ? "bg-dark text-white" : "text-muted hover:bg-panel2 hover:text-ink")}
        >
          <CalendarRange size={12} /> Custom <ChevronDown size={11} />
        </button>
      </div>

      {customOpen && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[280px] rounded-xl border border-line bg-panel p-3.5 shadow-lg">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Custom date range</div>
          <div className="flex items-center gap-2">
            <input type="date" className="input input-sm" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <span className="text-[11px] text-muted">to</span>
            <input type="date" className="input input-sm" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setCustomOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              disabled={!from || !to}
              onClick={() => { go({ range: "custom", from, to }); setCustomOpen(false); }}
            >
              <Check size={13} /> Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
