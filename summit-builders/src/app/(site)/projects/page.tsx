import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { getSiteData } from "@/lib/site";
import { fmtDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { c } = await getSiteData();
  return { title: `Projects — ${c("company.name", "Summit Builders")}`, description: "Recent residential and commercial construction projects across the Front Range." };
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { c, portfolio, testimonials } = await getSiteData();
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : "";
  const categories = [...new Set(portfolio.map((p) => p.category))];
  const items = category ? portfolio.filter((p) => p.category === category) : portfolio;

  return (
    <>
      <section className="border-b border-line bg-[#15181d] py-16 text-white md:py-20">
        <div className="container-site flex flex-wrap items-end justify-between gap-6">
          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand">Portfolio</span>
            <h1 className="mt-2 max-w-[700px] text-[34px] font-[800] leading-[1.08] tracking-[-0.04em] sm:text-[46px]">
              Work we&apos;re proud to put our name on.
            </h1>
            <p className="mt-4 max-w-[560px] text-[13px] leading-relaxed text-white/55">
              Kitchens, baths, whole-home renovations, roofing and commercial buildouts — completed on schedule, photographed on handover day.
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/[0.05] p-4">
            <div className="flex items-center gap-1 text-amber-400">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={13} fill="currentColor" />)}</div>
            <div className="mt-1 text-[20px] font-[800] tracking-[-0.03em] text-white">{c("home.stats.satisfaction", "98%")}</div>
            <div className="text-[10px] text-white/45">clients would hire us again</div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-panel">
        <div className="container-site flex flex-wrap items-center gap-2 py-4">
          <Link href="/projects" className="rounded-full border px-3 py-1.5 text-[11px] font-semibold" style={!category ? { background: "#15181d", color: "#fff", borderColor: "#15181d" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
            All projects <span className="ml-1 opacity-60">{portfolio.length}</span>
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/projects?category=${encodeURIComponent(cat)}`}
              className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
              style={category === cat ? { background: "#15181d", color: "#fff", borderColor: "#15181d" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}
            >
              {cat} <span className="ml-1 opacity-60">{portfolio.filter((p) => p.category === cat).length}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="container-site py-14 md:py-20">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center text-[13px] text-muted">No projects in this category yet.</div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {items.map((project, i) => (
              <article key={project.id} className={`group overflow-hidden rounded-2xl border border-line bg-panel ${i === 0 && !category ? "md:col-span-2" : ""}`}>
                <div className={`relative overflow-hidden ${i === 0 && !category ? "aspect-[21/9]" : "aspect-[4/3]"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={project.imageUrl} alt={project.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
                  <div className="absolute left-4 top-4 flex gap-1.5">
                    <span className="rounded-full bg-white/95 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.07em] text-ink">{project.category}</span>
                    {project.featured && <span className="rounded-full bg-brand px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.07em] text-white">Featured</span>}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <h2 className="text-[18px] font-[780] leading-snug tracking-[-0.02em] text-white sm:text-[21px]">{project.title}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[10.5px] text-white/65">
                      <span className="flex items-center gap-1"><MapPin size={10} /> {project.location}</span>
                      {project.completedAt && <span>Completed {fmtDate(project.completedAt, "MMM yyyy")}</span>}
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-[12px] leading-relaxed text-ink2">{project.description}</p>
                  <Link href="/contact" className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-semibold text-brand hover:underline">
                    Start a similar project <ArrowRight size={11} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {testimonials.length > 0 && (
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {testimonials.slice(0, 2).map((t) => (
              <figure key={t.id} className="testimonial-card">
                <div className="flex items-center justify-between">
                  <span className="quote-mark">“</span>
                  <span className="flex text-amber-500">{Array.from({ length: t.rating }, (_, i) => <Star key={i} size={11} fill="currentColor" />)}</span>
                </div>
                <blockquote className="text-[12px] leading-relaxed text-ink2">{t.quote}</blockquote>
                <figcaption className="mt-auto border-t border-line pt-3 text-[11px] font-semibold text-ink">{t.name}{t.company ? <span className="font-normal text-muted"> · {t.company}</span> : null}</figcaption>
              </figure>
            ))}
          </div>
        )}

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-6">
          <div>
            <div className="text-[15px] font-bold tracking-[-0.02em] text-ink">Have a project in mind?</div>
            <div className="mt-1 text-[11.5px] text-muted">Send us the details and we&apos;ll schedule a free on-site consultation.</div>
          </div>
          <Link href="/contact" className="btn btn-primary">Request a quote <ArrowRight size={14} /></Link>
        </div>
      </div>
    </>
  );
}
