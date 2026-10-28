"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, MapPin, Plus, Truck } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { useToast } from "@/components/toast";
import { scheduleJob } from "@/app/actions/jobs";
import { cn } from "@/lib/utils";

export type BoardJob = {
  id: string;
  jobNo: string;
  jobType: string;
  status: string;
  priority: string;
  startTime: string | null;
  durationMins: number;
  dateKey: string | null;
  customer: string;
  address: string;
  crew: Array<{ name: string; color: string | null }>;
};

export function DispatchBoard({
  jobs, days, canSchedule = true,
}: {
  jobs: BoardJob[];
  days: Array<{ key: string; label: string; sub: string; today: boolean }>;
  canSchedule?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(jobs);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function move(jobId: string, dayKey: string | null) {
    const job = items.find((j) => j.id === jobId);
    if (!job) return;
    if (!dayKey) return;
    const previous = items;
    setItems((prev) => prev.map((j) => (j.id === jobId ? { ...j, dateKey: dayKey, status: j.status === "UNSCHEDULED" ? "SCHEDULED" : j.status } : j)));
    setDragging(null);
    setOver(null);
    startTransition(async () => {
      const res = await scheduleJob(jobId, dayKey, job.startTime || "08:00", job.durationMins);
      if (!res.ok) {
        setItems(previous);
        toast.push({ title: "Could not schedule", description: res.error, tone: "error" });
        return;
      }
      toast.push({ title: res.message ?? "Job scheduled", tone: "success" });
      router.refresh();
    });
  }

  const unscheduled = items.filter((j) => !j.dateKey);

  return (
    <div className="flex flex-col gap-3">
      {unscheduled.length > 0 && (
        <div
          className="rounded-xl border border-dashed border-line2 bg-panel2 p-3"
          onDragOver={(e) => { if (canSchedule) { e.preventDefault(); setOver("none"); } }}
          onDragLeave={() => setOver((v) => (v === "none" ? null : v))}
          onDrop={(e) => {
            e.preventDefault();
            setOver(null);
            setDragging(null);
          }}
        >
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
            <Truck size={12} /> Unscheduled backlog
            <span className="kanban-count">{unscheduled.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((job) => (
              <JobCard key={job.id} job={job} dragging={dragging === job.id} compact
                onDragStart={(e) => { if (!canSchedule) return; e.dataTransfer.setData("text/plain", job.id); setDragging(job.id); }}
                onDragEnd={() => setDragging(null)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2 lg:grid-cols-7">
        {days.map((day) => {
          const dayJobs = items.filter((j) => j.dateKey === day.key).sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
          return (
            <div
              key={day.key}
              className={cn("flex min-h-[240px] flex-col rounded-xl border border-line bg-panel2", day.today && "ring-1 ring-brand/40")}
              onDragOver={(e) => { if (canSchedule) { e.preventDefault(); setOver(day.key); } }}
              onDragLeave={() => setOver((v) => (v === day.key ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragging;
                if (id) move(id, day.key);
              }}
              data-over={over === day.key}
              style={over === day.key ? { background: "color-mix(in srgb, var(--brand) 7%, var(--panel-2))" } : undefined}
            >
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <div>
                  <div className={cn("text-[10px] font-bold uppercase tracking-[0.08em]", day.today ? "text-brand" : "text-muted")}>{day.label}</div>
                  <div className="text-[12px] font-bold text-ink">{day.sub}</div>
                </div>
                <span className="kanban-count">{dayJobs.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {dayJobs.map((job) => (
                  <JobCard key={job.id} job={job} dragging={dragging === job.id}
                    onDragStart={(e) => { if (!canSchedule) return; e.dataTransfer.setData("text/plain", job.id); setDragging(job.id); }}
                    onDragEnd={() => setDragging(null)}
                  />
                ))}
                {!dayJobs.length && (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-line py-5 text-center text-[10px] text-muted">
                    No jobs
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {canSchedule && (
        <p className="flex items-center gap-1.5 text-[10.5px] text-muted">
          <Plus size={11} /> Drag a job card onto a day to schedule it. Double-booking is checked automatically against crew assignments.
        </p>
      )}
    </div>
  );
}

function JobCard({
  job, dragging, compact, onDragStart, onDragEnd,
}: {
  job: BoardJob; dragging: boolean; compact?: boolean;
  onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-dragging={dragging}
      className={cn(
        "kanban-card cursor-grab",
        compact && "w-full sm:w-[248px]",
      )}
    >
      <Link href={`/crm/jobs/${job.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.05em] text-muted">{job.jobNo}</span>
          <Badge value={job.status} />
        </div>
        <div className="k-title mt-1 text-[11.5px]">{job.jobType}</div>
        <div className="mt-0.5 truncate text-[10px] text-muted">{job.customer}</div>
        {!compact && (
          <div className="mt-1.5 flex items-center gap-2 text-[9.5px] text-muted">
            <span className="flex items-center gap-0.5"><Clock size={9} /> {job.startTime ?? "TBD"}</span>
            <span className="flex items-center gap-0.5 truncate"><MapPin size={9} /> {job.address.split(",")[0]}</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex -space-x-1.5">
            {job.crew.slice(0, 3).map((c, i) => <Avatar key={i} name={c.name} color={c.color} size="sm" />)}
            {!job.crew.length && <span className="text-[9px] text-muted">Unassigned</span>}
          </div>
          <Badge value={job.priority} plain />
        </div>
      </Link>
    </article>
  );
}
