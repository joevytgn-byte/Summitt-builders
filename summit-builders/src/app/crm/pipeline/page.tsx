import Link from "next/link";
import { ArrowRight, Columns3, Target, TrendingUp, Trophy } from "lucide-react";
import { requireModule, leadScope } from "@/lib/access";
import { db } from "@/lib/db";
import { LEAD_STAGES, fmtDate, money, number, pct, statusMeta } from "@/lib/utils";
import { resolveRange } from "@/lib/dates";
import { Avatar, Badge, PageHeader, Progress } from "@/components/ui";
import { RangeFilter } from "@/components/range-filter";
import { LeadBoard } from "@/components/lead-board";
import { Segmented } from "@/components/filters";

export const dynamic = "force-dynamic";

const OPEN_STAGES = LEAD_STAGES.filter((s) => s !== "WON" && s !== "LOST");

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("pipeline");
  const params = await searchParams;
  const range = typeof params.range === "string" ? params.range : "";
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";
  const resolved = range ? resolveRange({ range, from, to }) : null;

  const where = {
    AND: [
      leadScope(user),
      resolved ? { createdAt: { gte: resolved.from, lte: resolved.to } } : {},
    ],
  };

  const [leads, reps, totals] = await Promise.all([
    db.lead.findMany({
      where,
      include: {
        customer: { select: { name: true, company: true, city: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatarColor: true } },
      },
      orderBy: { estimatedValue: "desc" },
      take: 600,
    }),
    db.employee.findMany({ where: { status: "ACTIVE" }, select: { id: true, firstName: true, lastName: true, avatarColor: true, position: true } }),
    db.lead.aggregate({ where, _sum: { estimatedValue: true }, _count: true }),
  ]);

  const openLeads = leads.filter((l) => !["WON", "LOST"].includes(l.status));
  const wonLeads = leads.filter((l) => l.status === "WON");
  const lostLeads = leads.filter((l) => l.status === "LOST");
  const pipelineValue = openLeads.reduce((s, l) => s + l.estimatedValue, 0);
  const wonValue = wonLeads.reduce((s, l) => s + l.estimatedValue, 0);
  const avgDeal = wonLeads.length ? wonValue / wonLeads.length : 0;
  const weighted = openLeads.reduce((s, l) => {
    const idx = OPEN_STAGES.indexOf(l.status as (typeof OPEN_STAGES)[number]);
    const probability = [10, 25, 45, 60, 70, 85][idx] ?? 25;
    return s + (l.estimatedValue * probability) / 100;
  }, 0);

  const stages = LEAD_STAGES.map((stage) => {
    const items = leads.filter((l) => l.status === stage);
    return { stage, count: items.length, value: items.reduce((s, l) => s + l.estimatedValue, 0) };
  });
  const maxStageValue = Math.max(1, ...stages.map((s) => s.value));

  const leaderboard = reps
    .map((rep) => {
      const repLeads = leads.filter((l) => l.assignedTo?.id === rep.id);
      const won = repLeads.filter((l) => l.status === "WON");
      return {
        rep,
        total: repLeads.length,
        won: won.length,
        value: repLeads.reduce((s, l) => s + l.estimatedValue, 0),
        wonValue: won.reduce((s, l) => s + l.estimatedValue, 0),
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.wonValue - a.wonValue)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="Sales pipeline"
        title="Pipeline"
        subtitle={`${number(openLeads.length)} open opportunities worth ${money(pipelineValue)} · weighted forecast ${money(weighted, { compact: true })}`}
        actions={<RangeFilter defaultRange="quarter" />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Open pipeline", value: money(pipelineValue, { compact: true }), hint: `${openLeads.length} opportunities`, icon: <Columns3 size={15} /> },
          { label: "Weighted forecast", value: money(weighted, { compact: true }), hint: "probability adjusted", icon: <TrendingUp size={15} /> },
          { label: "Won (period)", value: money(wonValue, { compact: true }), hint: `${wonLeads.length} deals · avg ${money(avgDeal, { compact: true })}`, icon: <Trophy size={15} /> },
          { label: "Win rate", value: `${pct(wonLeads.length, wonLeads.length + lostLeads.length)}%`, hint: `${lostLeads.length} lost`, icon: <Target size={15} /> },
        ].map((s) => (
          <div key={s.label} className="card px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">{s.label}</div>
              <span className="text-muted">{s.icon}</span>
            </div>
            <div className="mt-1 text-[20px] font-[750] tracking-[-0.04em] text-ink">{s.value}</div>
            <div className="text-[10px] text-muted">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <div className="card-header">
            <div><div className="card-title">Stage funnel</div><div className="card-sub">Value and count by stage{resolved ? ` · ${resolved.label}` : ""}</div></div>
            <Link href="/crm/leads?view=board" className="text-[11px] font-semibold text-brand hover:underline">Open kanban <ArrowRight size={11} className="inline" /></Link>
          </div>
          <div className="space-y-2.5 p-5">
            {stages.filter((s) => s.stage !== "LOST").map((s) => (
              <div key={s.stage}>
                <div className="mb-1 flex items-center justify-between text-[11.5px]">
                  <span className="flex items-center gap-2 font-medium text-ink2">
                    <Badge value={s.stage} />
                    <span className="text-[10.5px] text-muted">{s.count} deals</span>
                  </span>
                  <span className="mono font-semibold text-ink">{money(s.value, { compact: true })}</span>
                </div>
                <Progress
                  value={(s.value / maxStageValue) * 100}
                  tone={s.stage === "WON" ? "green" : s.stage === "LOST" ? "red" : "brand"}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-header"><div><div className="card-title">Rep leaderboard</div><div className="card-sub">Won contract value</div></div></div>
          {leaderboard.length ? (
            <div className="divide-y divide-line">
              {leaderboard.map((row, i) => (
                <Link key={row.rep.id} href={`/crm/leads?rep=${row.rep.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-panel2">
                  <span className="w-4 text-[11px] font-bold text-muted">{i + 1}</span>
                  <Avatar name={`${row.rep.firstName} ${row.rep.lastName}`} color={row.rep.avatarColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold text-ink">{row.rep.firstName} {row.rep.lastName}</div>
                    <div className="text-[10px] text-muted">{row.won} won of {row.total} · {money(row.value, { compact: true })} pipeline</div>
                  </div>
                  <span className="mono text-[11.5px] font-bold text-ink">{money(row.wonValue, { compact: true })}</span>
                </Link>
              ))}
            </div>
          ) : <div className="px-5 py-8 text-center text-[11.5px] text-muted">No assigned leads in this period.</div>}
        </section>
      </div>

      <section className="card">
        <div className="card-header">
          <div><div className="card-title">Deal board</div><div className="card-sub">Drag a card to move the deal stage · {number(leads.length)} deals shown</div></div>
          <Segmented items={[{ label: "Pipeline", value: "board" }, { label: "Table", value: "table" }]} />
        </div>
        <div className="p-3">
          {leads.length ? (
            <LeadBoard
              leads={leads.map((l) => ({
                id: l.id,
                leadNo: l.leadNo,
                title: l.title,
                status: l.status,
                priority: l.priority,
                estimatedValue: l.estimatedValue,
                customerName: l.customer.name,
                company: l.customer.company,
                city: l.customer.city,
                assignedTo: l.assignedTo ? { name: `${l.assignedTo.firstName} ${l.assignedTo.lastName}`, color: l.assignedTo.avatarColor } : null,
                nextFollowUp: l.nextFollowUp ? fmtDate(l.nextFollowUp, "MMM d") : null,
              }))}
            />
          ) : (
            <div className="py-12 text-center text-[12px] text-muted">No deals in this period. Try a wider date range.</div>
          )}
        </div>
      </section>
    </>
  );
}
