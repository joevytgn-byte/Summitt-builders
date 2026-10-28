import Link from "next/link";
import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { getSiteData } from "@/lib/site";
import { QuoteForm } from "./quote-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { c } = await getSiteData();
  return { title: `Request a quote — ${c("company.name", "Summit Builders")}`, description: "Tell us about your construction or remodeling project and request a free estimate." };
}

export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { c, services, areas } = await getSiteData();
  const params = await searchParams;
  const slug = typeof params.service === "string" ? params.service : "";
  const preselected = services.find((s) => s.slug === slug)?.id;

  return (
    <>
      <section className="border-b border-line bg-[#15181d] py-14 text-white md:py-16">
        <div className="container-site">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand">Contact</span>
          <h1 className="mt-2 max-w-[680px] text-[32px] font-[800] leading-[1.08] tracking-[-0.04em] sm:text-[42px]">Let&apos;s talk about your project.</h1>
          <p className="mt-3 max-w-[560px] text-[13px] leading-relaxed text-white/55">{c("contact.note")}</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-white/55">
            <a href={`tel:${c("company.phone").replace(/[^0-9+]/g, "")}`} className="flex items-center gap-1.5 hover:text-white"><Phone size={12} className="text-brand" /> {c("company.phone")}</a>
            <a href={`mailto:${c("company.email")}`} className="flex items-center gap-1.5 hover:text-white"><Mail size={12} className="text-brand" /> {c("company.email")}</a>
            <span className="flex items-center gap-1.5"><Clock size={12} className="text-brand" /> {c("company.hours")}</span>
          </div>
        </div>
      </section>

      <div className="container-site grid gap-6 py-10 md:py-14 lg:grid-cols-[1.35fr_.65fr] lg:items-start">
        <QuoteForm services={services.map((s) => ({ id: s.id, name: s.name }))} defaultServiceId={preselected} />

        <aside className="flex flex-col gap-4 lg:sticky lg:top-[94px]">
          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Visit or call</div>
            <div className="mt-3 space-y-3 text-[12px]">
              <a href={`tel:${c("company.phone").replace(/[^0-9+]/g, "")}`} className="flex items-start gap-2.5 font-semibold text-ink hover:text-brand">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Phone size={13} /></span>
                <span>{c("company.phone")}<span className="block text-[10px] font-normal text-muted">Mon–Fri · 7am–6pm</span></span>
              </a>
              <a href={`mailto:${c("company.email")}`} className="flex items-start gap-2.5 font-semibold text-ink hover:text-brand">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Mail size={13} /></span>
                <span className="break-all">{c("company.email")}<span className="block text-[10px] font-normal text-muted">Estimates and general inquiries</span></span>
              </a>
              <div className="flex items-start gap-2.5 text-ink2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><MapPin size={13} /></span>
                <span>{c("company.address")}</span>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-line bg-panel-2 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted"><Clock size={10} /> Office hours</div>
              <div className="mt-1 text-[10.5px] leading-relaxed text-ink2">{c("company.hours")}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted"><Sparkles size={11} className="text-brand" /> What happens next</div>
            <ol className="mt-3 space-y-3">
              {[
                ["We review your request", "A consultant reads your scope and checks availability in your area."],
                ["We call to schedule", "Usually within one business day, to confirm details and book a walkthrough."],
                ["You receive a written estimate", "Line-item pricing, allowances, schedule and next steps — no obligation."],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[9.5px] font-bold text-white">{i + 1}</span>
                  <div>
                    <div className="text-[11.5px] font-semibold text-ink">{title}</div>
                    <div className="mt-0.5 text-[10px] leading-relaxed text-muted">{body}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted"><ShieldCheck size={11} className="text-brand" /> Licensed & insured</div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted">{c("company.license")}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {areas.slice(0, 8).map((a) => (
                <span key={a.id} className="rounded-full border border-line bg-panel-2 px-2 py-0.5 text-[9.5px] text-ink2">{a.name}</span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-brand/25 bg-brand-soft p-5">
            <div className="text-[12px] font-bold text-ink">Emergency repair?</div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-ink2">Active water intrusion, storm damage or a structural concern? Call us directly and we&apos;ll triage same-day.</p>
            <a href={`tel:${c("company.phone").replace(/[^0-9+]/g, "")}`} className="btn btn-dark btn-sm mt-3 w-full"><Phone size={12} /> {c("company.phone")}</a>
          </div>
        </aside>
      </div>

      <section className="border-t border-line bg-panel">
        <div className="container-site flex flex-wrap items-center justify-between gap-4 py-8">
          <div>
            <div className="text-[13px] font-bold text-ink">Prefer to see the work first?</div>
            <div className="mt-0.5 text-[11px] text-muted">Browse recent projects and the services behind them.</div>
          </div>
          <div className="flex gap-2">
            <Link href="/projects" className="btn btn-outline">Project gallery</Link>
            <Link href="/services" className="btn btn-primary">Our services</Link>
          </div>
        </div>
      </section>
    </>
  );
}
