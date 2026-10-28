"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical, MapPin } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { useToast } from "@/components/toast";
import { updateLeadStatus } from "@/app/actions/leads";
import { cn, money } from "@/lib/utils";

export type BoardLead = {
  id: string;
  leadNo: string;
  title: string;
  status: string;
  priority: string;
  estimatedValue: number;
  customerName: string;
  company: string | null;
  city: string;
  assignedTo: { name: string; color: string | null } | null;
  nextFollowUp: string | null;
};

const STAGES = [
  { key: "NEW", label: "New Lead" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "QUALIFIED", label: "Qualified" },
  { key: "SITE_VISIT", label: "Site Visit" },
  { key: "ESTIMATE", label: "Estimate / Proposal" },
  { key: "NEGOTIATION", label: "Negotiation" },
  { key: "WON", label: "Won" },
  { key: "LOST", label: "Lost" },
];

export function LeadBoard({ leads }: { leads: BoardLead[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(leads);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function move(leadId: string, status: string) {
    if (status === "LOST") {
      const reason = window.prompt("Why was this deal lost? (optional)", "Chose another contractor");
      if (reason === null) return;
      commit(leadId, status, reason);
      return;
    }
    commit(leadId, status);
  }

  function commit(leadId: string, status: string, lostReason?: string) {
    const previous = items;
    setItems((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
    startTransition(async () => {
      const res = await updateLeadStatus(leadId, status, lostReason);
      if (!res.ok) {
        setItems(previous);
        toast.push({ title: "Could not move lead", description: res.error, tone: "error" });
        return;
      }
      toast.push({ title: res.message ?? "Lead updated", tone: "success" });
      router.refresh();
    });
  }

  return (
    <div className="kanban">
      {STAGES.map((stage) => {
        const stageLeads = items.filter((l) => l.status === stage.key);
        const total = stageLeads.reduce((s, l) => s + l.estimatedValue, 0);
        return (
          <div
            key={stage.key}
            className="kanban-col"
            onDragOver={(e) => { e.preventDefault(); setOver(stage.key); }}
            onDragLeave={() => setOver((v) => (v === stage.key ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/plain") || dragging;
              if (id) move(id, stage.key);
              setDragging(null);
            }}
          >
            <div className="kanban-head">
              <div className="kanban-title">
                <span className="kanban-dot" data-stage={stage.key} style={{ background: dotColor(stage.key) }} />
                {stage.label}
              </div>
              <span className="kanban-count">{stageLeads.length}</span>
            </div>
            <div className="px-3 pb-1 pt-2 text-[10px] font-semibold text-muted">{money(total, { compact: true })}</div>
            <div className="kanban-body" data-over={over === stage.key}>
              {stageLeads.map((lead) => (
                <article
                  key={lead.id}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", lead.id); setDragging(lead.id); }}
                  onDragEnd={() => { setDragging(null); setOver(null); }}
                  data-dragging={dragging === lead.id}
                  className="kanban-card"
                >
                  <Link href={`/crm/leads/${lead.id}`} className="block">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-muted">{lead.leadNo}</span>
                      <Badge value={lead.priority} />
                    </div>
                    <div className="k-title mt-1.5">{lead.title}</div>
                    <div className="mt-1 text-[10.5px] text-muted">{lead.company ?? lead.customerName}</div>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted">
                      <MapPin size={9} /> {lead.city}
                    </div>
                    <div className="k-meta">
                      <span className="mono text-[11.5px] font-bold text-ink">{money(lead.estimatedValue, { compact: true })}</span>
                      {lead.assignedTo ? (
                        <Avatar name={lead.assignedTo.name} color={lead.assignedTo.color} size="sm" />
                      ) : (
                        <span className="text-[9.5px] text-muted">Unassigned</span>
                      )}
                    </div>
                    {lead.nextFollowUp && (
                      <div className="mt-2 rounded bg-panel2 px-1.5 py-1 text-[9.5px] text-muted">
                        Follow up {lead.nextFollowUp}
                      </div>
                    )}
                  </Link>
                </article>
              ))}
              {!stageLeads.length && (
                <div className="flex flex-col items-center justify-center gap-1 py-6 text-center text-[10.5px] text-muted">
                  <GripVertical size={14} className="opacity-40" />
                  Drop leads here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function dotColor(stage: string) {
  const map: Record<string, string> = {
    NEW: "#1d6fb8", CONTACTED: "#0e7490", QUALIFIED: "#7c3aed", SITE_VISIT: "#d97706",
    ESTIMATE: "#ee6424", NEGOTIATION: "#c2413a", WON: "#16834b", LOST: "#94a3b8",
  };
  return map[stage] ?? "#ee6424";
}

export function LeadBoardShell({ leads, className }: { leads: BoardLead[]; className?: string }) {
  return <div className={cn(className)}><LeadBoard leads={leads} /></div>;
}
