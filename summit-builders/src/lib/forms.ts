export type ActionResult =
  | { ok: true; id?: string; message?: string; redirectTo?: string }
  | { ok: false; error: string };

export function s(fd: FormData, key: string, fallback = "") {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : fallback;
}

export function optional(fd: FormData, key: string) {
  const v = s(fd, key);
  return v.length ? v : null;
}

export function n(fd: FormData, key: string, fallback = 0) {
  const v = s(fd, key);
  const parsed = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function int(fd: FormData, key: string, fallback = 0) {
  return Math.round(n(fd, key, fallback));
}

export function bool(fd: FormData, key: string) {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function dateVal(fd: FormData, key: string) {
  const v = s(fd, key);
  if (!v) return null;
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dayVal(fd: FormData, key: string) {
  const d = dateVal(fd, key);
  if (!d) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function required(...fields: [string, string][]) {
  for (const [value, label] of fields) {
    if (!value) return `${label} is required.`;
  }
  return null;
}

export function moneyValue(fd: FormData, key: string) {
  return Math.round(n(fd, key) * 100) / 100;
}

export function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
