"use client";

import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart,
} from "recharts";
import { money, number as fmtNum } from "@/lib/utils";

export type Series = { key: string; label: string; color: string; kind?: "area" | "bar" | "line"; format?: "currency" | "number" };
type Row = Record<string, string | number>;

function formatValue(v: number, format?: "currency" | "number") {
  return format === "currency" ? money(v, { compact: true }) : fmtNum(v);
}

function Tip({ active, payload, label, currency }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string | number }>; label?: string; currency?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="lbl">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-5 py-[1px]">
          <span className="flex items-center gap-1.5 text-white/70">
            <span className="size-1.5 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold">{currency ? money(Number(p.value)) : fmtNum(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({
  data, xKey = "label", series, height = 250, currency = false, stacked = false, yWidth = 44,
}: {
  data: Row[]; xKey?: string; series: Series[]; height?: number; currency?: boolean; stacked?: boolean; yWidth?: number;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.26} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="2 5" stroke="var(--line)" />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: "var(--muted)" }} dy={7} minTickGap={18} />
          <YAxis
            tickLine={false} axisLine={false} width={yWidth}
            tick={{ fontSize: 10.5, fill: "var(--muted)" }}
            tickFormatter={(v) => (currency ? money(Number(v), { compact: true }) : fmtNum(Number(v)))}
          />
          <Tooltip content={<Tip currency={currency} />} cursor={{ stroke: "var(--line-strong)", strokeDasharray: "3 3" }} />
          {series.map((s) => {
            if (s.kind === "bar") {
              return <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={34} stackId={stacked ? "1" : undefined} />;
            }
            if (s.kind === "line") {
              return <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />;
            }
            return (
              <Area
                key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2}
                fill={`url(#grad-${s.key})`} activeDot={{ r: 4, strokeWidth: 2 }}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({
  data, height = 210, centerLabel, centerValue, currency = false,
}: {
  data: Array<{ name: string; value: number; color: string }>; height?: number; centerLabel?: string; centerValue?: string; currency?: boolean;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative shrink-0" style={{ width: Math.min(height, 220), height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke="none">
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Pie>
            <Tooltip content={<Tip currency={currency} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[19px] font-[750] tracking-[-0.04em] text-ink">{centerValue ?? fmtNum(total)}</div>
          {centerLabel && <div className="mt-0.5 text-[10px] uppercase tracking-[0.08em] text-muted">{centerLabel}</div>}
        </div>
      </div>
      <div className="flex w-full flex-col gap-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-3 text-[11.5px]">
            <span className="flex items-center gap-2 text-ink2">
              <span className="size-2 rounded-[2px]" style={{ background: d.color }} />
              {d.name}
            </span>
            <span className="mono font-semibold text-ink">{currency ? money(d.value) : fmtNum(d.value)}</span>
          </div>
        ))}
        {!data.length && <div className="py-6 text-center text-[11.5px] text-muted">No data in this period</div>}
      </div>
    </div>
  );
}

export function RankBars({
  data, height = 240, currency = false, color = "#f26a1b",
}: { data: Array<{ name: string; value: number }>; height?: number; currency?: boolean; color?: string }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={9}>
          <CartesianGrid horizontal={false} strokeDasharray="2 5" stroke="var(--line)" />
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={104} tick={{ fontSize: 10.5, fill: "var(--muted)" }} />
          <Tooltip content={<Tip currency={currency} />} cursor={{ fill: "var(--panel-2)" }} />
          <Bar dataKey="value" name="Total" fill={color} radius={[0, 4, 4, 0]} maxBarSize={17} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MiniBars({ data, color = "#f26a1b", height = 42 }: { data: Array<{ value: number; label?: string }>; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {data.map((d, i) => (
        <span
          key={i}
          className="w-full rounded-t-[2px]"
          style={{ height: `${Math.max(6, (d.value / max) * 100)}%`, background: color, opacity: 0.35 + 0.65 * (d.value / max) }}
          title={d.label}
        />
      ))}
    </div>
  );
}
