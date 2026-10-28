import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays, subMonths,
  differenceInCalendarDays, format, eachDayOfInterval, eachWeekOfInterval,
  eachMonthOfInterval, startOfISOWeek, endOfISOWeek,
} from "date-fns";

export type RangePreset = "today" | "week" | "month" | "quarter" | "year" | "custom";

export type Range = {
  preset: RangePreset;
  from: Date;
  to: Date;
  label: string;
  key: string;
};

export function resolveRange(params: { range?: string; from?: string; to?: string }): Range {
  const preset = (["today", "week", "month", "quarter", "year", "custom"].includes(params.range ?? "")
    ? params.range
    : "month") as RangePreset;
  const now = new Date();
  let from: Date;
  let to: Date;

  switch (preset) {
    case "today":
      from = startOfDay(now); to = endOfDay(now); break;
    case "week":
      from = startOfWeek(now, { weekStartsOn: 1 }); to = endOfWeek(now, { weekStartsOn: 1 }); break;
    case "quarter":
      from = startOfQuarter(now); to = endOfQuarter(now); break;
    case "year":
      from = startOfYear(now); to = endOfYear(now); break;
    case "custom": {
      const f = params.from ? new Date(`${params.from}T00:00:00`) : startOfMonth(now);
      const t = params.to ? new Date(`${params.to}T00:00:00`) : now;
      from = Number.isNaN(f.getTime()) ? startOfMonth(now) : startOfDay(f);
      to = Number.isNaN(t.getTime()) ? endOfDay(now) : endOfDay(t);
      if (from > to) [from, to] = [startOfDay(to), endOfDay(from)];
      break;
    }
    default:
      from = startOfMonth(now); to = endOfMonth(now);
  }

  const label =
    preset === "today" ? format(now, "MMMM d, yyyy")
    : preset === "custom" ? `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`
    : `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`;

  return { preset, from, to, label, key: `${format(from, "yyyyMMdd")}-${format(to, "yyyyMMdd")}` };
}

export function previousRange(range: Range): { from: Date; to: Date } {
  const days = Math.max(1, differenceInCalendarDays(range.to, range.from) + 1);
  return { from: subDays(range.from, days), to: endOfDay(subDays(range.from, 1)) };
}

export function rangeQuery(range: Range) {
  return range.preset === "custom"
    ? { range: "custom", from: format(range.from, "yyyy-MM-dd"), to: format(range.to, "yyyy-MM-dd") }
    : { range: range.preset };
}

export type Bucket = { key: string; label: string; start: Date; end: Date };

export function makeBuckets(range: Range): { buckets: Bucket[]; granularity: "day" | "week" | "month" } {
  const days = differenceInCalendarDays(range.to, range.from) + 1;
  let granularity: "day" | "week" | "month" = days <= 35 ? "day" : days <= 140 ? "week" : "month";
  let buckets: Bucket[] = [];

  if (granularity === "day") {
    buckets = eachDayOfInterval({ start: range.from, end: range.to }).map((d) => ({
      key: format(d, "yyyy-MM-dd"), label: format(d, "MMM d"), start: startOfDay(d), end: endOfDay(d),
    }));
  } else if (granularity === "week") {
    buckets = eachWeekOfInterval({ start: range.from, end: range.to }, { weekStartsOn: 1 }).map((d) => ({
      key: format(d, "yyyy-'W'II"),
      label: format(startOfISOWeek(d), "MMM d"),
      start: startOfISOWeek(d),
      end: endOfISOWeek(d),
    }));
  } else {
    buckets = eachMonthOfInterval({ start: range.from, end: range.to }).map((d) => ({
      key: format(d, "yyyy-MM"), label: format(d, "MMM yy"), start: startOfMonth(d), end: endOfMonth(d),
    }));
  }
  return { buckets, granularity };
}

export function bucketKey(date: Date, granularity: "day" | "week" | "month") {
  if (granularity === "day") return format(date, "yyyy-MM-dd");
  if (granularity === "week") return format(date, "yyyy-'W'II");
  return format(date, "yyyy-MM");
}

export function lastNMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => startOfMonth(subMonths(now, n - 1 - i)));
}
