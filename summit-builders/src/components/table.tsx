import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Params = Record<string, string | string[] | undefined>;

export function paramString(params: Params, key: string) {
  const v = params[key];
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

export function withParams(pathname: string, params: Params, updates: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, v);
  }
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined || v === "" || v === 0) sp.delete(k);
    else sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function SortTh({
  label, column, pathname, params, className, align = "left",
}: { label: string; column: string; pathname: string; params: Params; className?: string; align?: "left" | "right" }) {
  const currentSort = paramString(params, "sort");
  const currentDir = paramString(params, "dir") || "desc";
  const active = currentSort === column;
  const nextDir = active && currentDir === "asc" ? "desc" : "asc";
  return (
    <th className={cn(className, align === "right" && "text-right")}>
      <Link href={withParams(pathname, params, { sort: column, dir: nextDir, page: undefined })} className="th-sort" style={align === "right" ? { justifyContent: "flex-end", width: "100%" } : undefined}>
        {label}
        {active ? (currentDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ChevronsUpDown size={11} className="opacity-30" />}
      </Link>
    </th>
  );
}

export function Pagination({
  page, pageSize, total, pathname, params,
}: { page: number; pageSize: number; total: number; pathname: string; params: Params }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const pageNumbers = Array.from({ length: Math.min(5, pages) }, (_, i) => {
    let p = page - 2 + i;
    if (p < 1) p = i + 1;
    if (p > pages) p = pages - (4 - i);
    return p;
  }).filter((p) => p >= 1 && p <= pages);

  if (total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <div className="text-[11.5px] text-muted">Showing <span className="font-semibold text-ink2">{start}–{end}</span> of <span className="font-semibold text-ink2">{total}</span></div>
      <div className="flex items-center gap-1">
        <Link
          href={withParams(pathname, params, { page: Math.max(1, page - 1) })}
          className={cn("btn btn-outline btn-sm btn-icon", page <= 1 && "pointer-events-none opacity-40")}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </Link>
        {pageNumbers.map((p) => (
          <Link
            key={p}
            href={withParams(pathname, params, { page: p })}
            className={cn("btn btn-sm btn-icon", p === page ? "btn-dark" : "btn-ghost")}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </Link>
        ))}
        <Link
          href={withParams(pathname, params, { page: Math.min(pages, page + 1) })}
          className={cn("btn btn-outline btn-sm btn-icon", page >= pages && "pointer-events-none opacity-40")}
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}

export function TableCount({ total, label = "records" }: { total: number; label?: string }) {
  return <span className="text-[11.5px] text-muted">{total} {label}</span>;
}
