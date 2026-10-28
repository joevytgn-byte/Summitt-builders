import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, CalendarCheck, CheckCircle2, ClipboardCheck, Clock, HardHat, MapPin,
  MessageSquareQuote, Phone, ShieldCheck, Sparkles, Star, Users,
} from "lucide-react";
import { getSiteData } from "@/lib/site";
import { ServiceIcon } from "@/components/service-icon";

export const dynamic = "force-dynamic";

const PROCESS = [
  { title: "Consultation", body: "We listen, walk the space, and talk through scope, budget and timing — no pressure." },
  { title: "Detailed estimate", body: "Line-item pricing, clear allowances and a schedule you can hold us to." },
  { title: "Build", body: "One project manager, daily site protection, weekly progress updates." },
  { title: "Closeout", body: "Punch list, final walkthrough, warranty and a spotless handover." },
];

export default async function HomePage() {
  const { c, services, portfolio, testimonials, areas } = await getSiteData();
  const features = [1, 2, 3, 4].map((n) => ({
    title: c(`home.feature${n}.title`),
    body: c(`home.feature${n}.body`),
  }));
  const featureIcons = [ShieldCheck, Clock, Users, Sparkles];
  const featured = portfolio.filter((p) => p.featured).slice(0, 3);
  const gallery = featured.length ? featured : portfolio.slice(0, 3);

  return (
    <>
      <section className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={c("home.hero.image", "/images/hero.jpg")} alt="" className="hero-bg" />
        <div className="hero-grid" />
        <div className="container-site hero-content py-20 md:py-28 lg:py-32">
          <div className="max-w-[690px]">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/75 backdrop-blur">
              <BadgeCheck size={12} className="text-brand" /> {c("home.hero.eyebrow", "Licensed & insured since 2008")}
            </span>
            <h1 className="mt-5 text-[38px] font-[800] leading-[1.03] tracking-[-0.045em] text-white sm:text-[52px] lg:text-[62px]">
              {c("home.hero.title", "Building Your Vision")}
              <span className="mt-1 block text-brand">{c("home.hero.highlight", "From the Ground Up")}</span>
            </h1>
            <p className="mt-5 max-w-[560px] text-[14px] leading-relaxed text-white/65 sm:text-[15px]">
              {c("home.hero.subtitle")}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Link href="/contact" className="btn btn-primary btn-lg">Request a free quote <ArrowRight size={16} /></Link>
              <Link href="/projects" className="btn btn-lg border border-white/20 bg-white/[0.06] text-white hover:bg-white/[0.12]">
                See our work
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[11.5px] text-white/55">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-400" /> Free on-site estimate</span>
              <span className="flex items-center gap-1.5"><Star size={13} className="fill-amber-400 text-amber-400" /> {c("home.stats.satisfaction", "98%")} customer satisfaction</span>
              <span className="flex items-center gap-1.5"><MapPin size={13} className="text-brand" /> Serving the Front Range</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 bg-black/25 backdrop-blur">
          <div className="container-site grid grid-cols-2 divide-x divide-white/10 sm:grid-cols-4">
            {[
              [c("home.stats.projects", "850+"), "Projects completed"],
              [c("home.stats.years", "15+"), "Years in business"],
              [c("home.stats.crew", "32"), "Skilled crew members"],
              [c("home.stats.satisfaction", "98%"), "Would hire again"],
            ].map(([value, label]) => (
              <div key={label} className="px-4 py-5 first:pl-0">
                <div className="text-[24px] font-[800] tracking-[-0.04em] text-white sm:text-[28px]">{value}</div>
                <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-white/40">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-site py-16 md:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="relative">
            <div className="photo-tile aspect-[4/3] shadow-[var(--shadow-lg)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/about.jpg" alt="Summit Builders crew on site" className="img-cover" />
            </div>
            <div className="absolute -bottom-6 -right-2 hidden w-[210px] rounded-xl border border-line bg-panel p-4 shadow-[var(--shadow-md)] sm:block">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand"><CalendarCheck size={15} /></span>
                <div>
                  <div className="text-[11px] font-bold text-ink">On schedule</div>
                  <div className="text-[9.5px] text-muted">Weekly progress updates</div>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel-3"><div className="h-full w-[92%] rounded-full bg-brand" /></div>
              <div className="mt-1.5 flex justify-between text-[9px] text-muted"><span>92% on-time</span><span>since 2008</span></div>
            </div>
          </div>

          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand">Who we are</span>
            <h2 className="mt-2 text-[28px] font-[780] leading-[1.12] tracking-[-0.035em] text-ink sm:text-[36px]">
              {c("home.intro.title", "Craftsmanship you can stand on.")}
            </h2>
            <p className="mt-4 text-[13.5px] leading-relaxed text-ink2">{c("home.intro.body")}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {features.map((f, i) => {
                const Icon = featureIcons[i];
                return (
                  <div key={f.title} className="flex gap-3 rounded-xl border border-line bg-panel p-3.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon size={15} /></span>
                    <div>
                      <div className="text-[12px] font-semibold text-ink">{f.title}</div>
                      <div className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{f.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/about" className="btn btn-dark">More about us <ArrowRight size={14} /></Link>
              <a href={`tel:${c("company.phone").replace(/[^0-9+]/g, "")}`} className="flex items-center gap-2 text-[12px] font-semibold text-ink2 hover:text-brand"><Phone size={14} className="text-brand" /> {c("company.phone")}</a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-panel">
        <div className="container-site py-16 md:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand">What we do</span>
              <h2 className="mt-2 max-w-[520px] text-[26px] font-[780] leading-[1.14] tracking-[-0.035em] text-ink sm:text-[34px]">One team for every phase of your project.</h2>
            </div>
            <Link href="/services" className="btn btn-outline">All services <ArrowRight size={14} /></Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, 6).map((service) => (
              <Link key={service.id} href={`/services#${service.slug}`} className="service-card group">
                <div className="flex items-start justify-between">
                  <span className="service-icon"><ServiceIcon name={service.icon} /></span>
                  {service.featured && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-brand-ink">Popular</span>}
                </div>
                <div className="mt-4 text-[14px] font-[700] tracking-[-0.015em] text-ink group-hover:text-brand">{service.name}</div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">{service.shortDescription}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-semibold text-brand">Explore service <ArrowUpRight size={11} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container-site py-16 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand">Recent work</span>
            <h2 className="mt-2 text-[26px] font-[780] leading-[1.14] tracking-[-0.035em] text-ink sm:text-[34px]">Built by Summit. Built to last.</h2>
          </div>
          <Link href="/projects" className="btn btn-outline">Full portfolio <ArrowRight size={14} /></Link>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {gallery.map((project) => (
            <Link key={project.id} href="/projects" className="photo-tile group aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={project.imageUrl} alt={project.title} className="img-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <span className="rounded-full bg-brand/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white">{project.category}</span>
                <div className="mt-2 text-[14px] font-bold leading-snug text-white">{project.title}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[10px] text-white/60"><MapPin size={9} /> {project.location}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-[#15181d] py-16 text-white md:py-20">
        <div className="container-site">
          <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand">How it works</span>
              <h2 className="mt-2 text-[26px] font-[780] leading-[1.14] tracking-[-0.035em] sm:text-[34px]">Straightforward from the first call.</h2>
              <p className="mt-3 max-w-[400px] text-[12.5px] leading-relaxed text-white/50">
                No mystery pricing, no vanishing crews. You always know what happens next, who is responsible, and what it costs.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/contact" className="btn btn-primary">Book a consultation <ArrowRight size={14} /></Link>
                <Link href="/about" className="btn border border-white/20 bg-white/[0.04] text-white hover:bg-white/[0.1]">Our process</Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {PROCESS.map((step, i) => (
                <div key={step.title} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-md bg-brand text-[10.5px] font-bold text-white">0{i + 1}</span>
                    <span className="text-[12.5px] font-semibold text-white">{step.title}</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-white/45">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section className="border-b border-line bg-panel-2">
          <div className="container-site py-16 md:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand">Client reviews</span>
                <h2 className="mt-2 text-[26px] font-[780] leading-[1.14] tracking-[-0.035em] text-ink sm:text-[34px]">The work speaks. So do our clients.</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-line bg-panel px-3.5 py-2">
                <span className="flex text-amber-500">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={12} fill="currentColor" />)}</span>
                <span className="text-[11px] font-semibold text-ink">5.0 average</span>
              </div>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {testimonials.slice(0, 3).map((t) => (
                <figure key={t.id} className="testimonial-card">
                  <div className="flex items-center justify-between">
                    <span className="quote-mark">“</span>
                    <span className="flex text-amber-500" aria-label={`${t.rating} out of 5`}>
                      {Array.from({ length: t.rating }, (_, i) => <Star key={i} size={11} fill="currentColor" />)}
                    </span>
                  </div>
                  <blockquote className="text-[12px] leading-relaxed text-ink2">{t.quote}</blockquote>
                  <figcaption className="mt-auto border-t border-line pt-3">
                    <div className="text-[12px] font-semibold text-ink">{t.name}</div>
                    {t.company && <div className="text-[10px] text-muted">{t.company}</div>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-site py-14">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand"><MapPin size={18} /></span>
            <div>
              <div className="text-[13px] font-bold text-ink">Proudly serving the Front Range</div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-[10.5px] text-muted">
                {areas.map((a, i) => (
                  <span key={a.id}>{a.name}{i < areas.length - 1 ? " ·" : ""}</span>
                ))}
              </div>
            </div>
          </div>
          <Link href="/contact" className="btn btn-outline">Check your area <ArrowRight size={14} /></Link>
        </div>
      </section>

      <section className="cta-band">
        <div className="container-site relative z-10 flex flex-wrap items-center justify-between gap-6 py-12">
          <div>
            <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/70"><HardHat size={13} /> Let&apos;s build something</div>
            <h2 className="mt-2 max-w-[560px] text-[26px] font-[800] leading-[1.1] tracking-[-0.035em] text-white sm:text-[34px]">
              Tell us about your project. We&apos;ll tell you how we&apos;d build it.
            </h2>
            <p className="mt-2 max-w-[520px] text-[12.5px] text-white/75">{c("contact.note")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/contact" className="btn btn-lg bg-white text-[#c94f14] hover:bg-white/90">Request a quote <ArrowRight size={15} /></Link>
            <a href={`tel:${c("company.phone").replace(/[^0-9+]/g, "")}`} className="btn btn-lg border border-white/30 text-white hover:bg-white/10"><Phone size={15} /> {c("company.phone")}</a>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-panel">
        <div className="container-site grid gap-4 py-6 sm:grid-cols-3">
          {[
            { icon: <ShieldCheck size={16} />, title: "Licensed & insured", body: c("company.license") },
            { icon: <ClipboardCheck size={16} />, title: "Transparent pricing", body: "Line-item estimates and written change orders." },
            { icon: <MessageSquareQuote size={16} />, title: "Real communication", body: "A named project manager and weekly updates." },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">{item.icon}</span>
              <div>
                <div className="text-[11.5px] font-semibold text-ink">{item.title}</div>
                <div className="text-[10px] leading-relaxed text-muted">{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
