"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, Paperclip, Send } from "lucide-react";
import { submitQuote } from "@/app/actions/public";

type Option = { id: string; name: string };

const FIELD = "w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-[12.5px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-brand/60 focus:ring-2 focus:ring-brand/15";
const LABEL = "mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.07em] text-ink2";
const REQ = <span className="text-brand">*</span>;

export function QuoteForm({ services, defaultServiceId }: { services: Option[]; defaultServiceId?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ requestNo: string; leadNo: string } | null>(null);
  const [fileName, setFileName] = useState("");

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-panel p-8 text-center dark:border-emerald-900">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <CheckCircle2 size={28} />
        </span>
        <h2 className="mt-4 text-[22px] font-[780] tracking-[-0.03em] text-ink">Request received — thank you.</h2>
        <p className="mx-auto mt-2 max-w-[420px] text-[12.5px] leading-relaxed text-muted">
          A Summit Builders consultant will review your project and contact you within one business day. We&apos;ve emailed a confirmation to the address you provided.
        </p>
        <div className="mx-auto mt-5 inline-flex flex-wrap items-center justify-center gap-3 rounded-xl border border-line bg-panel-2 px-5 py-3">
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted">Reference</div>
            <div className="mono text-[15px] font-bold text-ink">{result.requestNo}</div>
          </div>
          <span className="h-8 w-px bg-line" />
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted">Lead</div>
            <div className="mono text-[15px] font-bold text-ink">{result.leadNo}</div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/projects" className="btn btn-outline">Browse our projects <ArrowRight size={14} /></Link>
          <button className="btn btn-primary" onClick={() => { setResult(null); setFileName(""); }}>Submit another request</button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="rounded-2xl border border-line bg-panel p-5 sm:p-7"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        const form = e.currentTarget;
        const fd = new FormData(form);
        startTransition(async () => {
          const res = await submitQuote(fd);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setResult({ requestNo: res.requestNo, leadNo: res.leadNo });
          form.reset();
          window.scrollTo({ top: 180, behavior: "smooth" });
        });
      }}
    >
      <div className="mb-5">
        <div className="text-[16px] font-[780] tracking-[-0.02em] text-ink">Tell us about your project</div>
        <div className="mt-1 text-[11.5px] text-muted">Fields marked {REQ} are required. We reply within one business day.</div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11.5px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <input type="hidden" name="leadSource" value="Website" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={LABEL} htmlFor="q-name">Your name {REQ}</label><input id="q-name" name="name" className={FIELD} placeholder="Jordan Rivera" required /></div>
        <div><label className={LABEL} htmlFor="q-company">Company <span className="font-normal normal-case tracking-normal text-muted">(optional)</span></label><input id="q-company" name="company" className={FIELD} placeholder="Rivera Properties" /></div>
        <div><label className={LABEL} htmlFor="q-phone">Phone {REQ}</label><input id="q-phone" name="phone" type="tel" className={FIELD} placeholder="(303) 555-0142" required /></div>
        <div><label className={LABEL} htmlFor="q-email">Email {REQ}</label><input id="q-email" name="email" type="email" className={FIELD} placeholder="you@example.com" required /></div>
        <div className="sm:col-span-2"><label className={LABEL} htmlFor="q-address">Project address {REQ}</label><input id="q-address" name="address" className={FIELD} placeholder="Street address" required /></div>
        <div><label className={LABEL} htmlFor="q-city">City {REQ}</label><input id="q-city" name="city" className={FIELD} placeholder="Denver" required /></div>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <div><label className={LABEL} htmlFor="q-zip">ZIP {REQ}</label><input id="q-zip" name="zip" className={FIELD} placeholder="80204" required /></div>
          <div><label className={LABEL} htmlFor="q-state">State</label><input id="q-state" name="state" className={FIELD} defaultValue="CO" /></div>
        </div>

        <div><label className={LABEL} htmlFor="q-service">Service needed {REQ}</label>
          <select id="q-service" name="serviceId" className={FIELD} defaultValue={defaultServiceId ?? ""} required>
            <option value="" disabled>Choose a service…</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div><label className={LABEL} htmlFor="q-projectType">Project type</label>
          <select id="q-projectType" name="projectType" className={FIELD} defaultValue="Residential">
            <option>Residential</option>
            <option>Commercial</option>
            <option>Multi-family</option>
            <option>Institutional</option>
          </select>
        </div>
        <div><label className={LABEL} htmlFor="q-urgency">Urgency</label>
          <select id="q-urgency" name="urgency" className={FIELD} defaultValue="NORMAL">
            <option value="NORMAL">Standard — planning ahead</option>
            <option value="URGENT">Urgent — next few weeks</option>
            <option value="EMERGENCY">Emergency — immediate</option>
          </select>
        </div>
        <div><label className={LABEL} htmlFor="q-preferred">Preferred appointment</label><input id="q-preferred" name="preferredDate" type="date" className={FIELD} /></div>
        <div><label className={LABEL} htmlFor="q-size">Approximate size / budget</label><input id="q-size" name="estimatedSize" className={FIELD} placeholder="e.g. 350 sq ft · $25k budget" /></div>
        <div className="sm:col-span-2"><label className={LABEL} htmlFor="q-description">Project description {REQ}</label>
          <textarea id="q-description" name="description" className={FIELD} rows={5} placeholder="What would you like to build or renovate? Include rooms, sizes, finishes, and anything we should know." required />
        </div>
        <div className="sm:col-span-2"><label className={LABEL} htmlFor="q-notes">Anything else?</label><textarea id="q-notes" name="notes" className={FIELD} rows={2} placeholder="Access notes, timelines, HOA requirements…" /></div>
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="q-files">Photos or plans <span className="font-normal normal-case tracking-normal text-muted">(optional, up to 4 files / 5 MB each)</span></label>
          <label htmlFor="q-files" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line bg-panel-2 px-3 py-3 text-[11.5px] text-muted hover:border-brand/40">
            <Paperclip size={14} className="text-brand" />
            <span>{fileName || "Attach images, drawings or a scope document"}</span>
            <input
              id="q-files" name="files" type="file" multiple accept="image/*,.pdf,.doc,.docx" className="sr-only"
              onChange={(e) => setFileName(Array.from(e.currentTarget.files ?? []).map((f) => f.name).join(", "))}
            />
          </label>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="max-w-[300px] text-[10px] leading-relaxed text-muted">By submitting you agree to be contacted about this project. We never sell your information.</p>
        <button type="submit" disabled={pending} className="btn btn-primary btn-lg">
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {pending ? "Sending…" : "Send my request"}
        </button>
      </div>
    </form>
  );
}
