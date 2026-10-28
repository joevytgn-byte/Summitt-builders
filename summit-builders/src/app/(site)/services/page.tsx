import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, Phone } from "lucide-react";
import { getSiteData } from "@/lib/site";
import { ServiceIcon } from "@/components/service-icon";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { c } = await getSiteData();
  return { title: `Services — ${c("company.name", "Summit Builders")}`, description: "Residential and commercial construction services across the Front Range." };
}

const INCLUDED = [
  "Free on-site consultation and written scope",
  "Line-item estimate with clear allowances",
  "Permits, scheduling and material sourcing",
  "Dedicated project manager and weekly updates",
  "Site protection, daily cleanup and final punch list",
];

export default async function ServicesPage() {
  const { c, services } = await getSiteData();

  return (
    <>
      <section className="border-b border-line bg-[#15181d] py-16 text-white md:py-20">
        <div className="container-site">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand">Services</span>
          <h1 className="mt-2 max-w-[720px] text-[34px] font-[800] leading-[1.08] tracking-[-0.04em] sm:text-[46px]">
            Every trade you need, under one accountable roof.
          </h1>
          <p className="mt-4 max-w-[600px] text-[13px] leading-relaxed text-white/55">
            From a single bathroom to a ground-up commercial buildout, our in-house teams and vetted trade partners handle the whole scope — so you are never coordinating contractors yourself.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/contact" className="btn btn-primary">Get a free estimate <ArrowRight size={14} /></Link>
            <a href={`tel:${c("company.phone").replace(/[^0-9+]/g, "")}`} className="btn border border-white/20 bg-white/[0.05] text-white hover:bg-white/[0.1]"><Phone size={14} /> {c("company.phone")}</a>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-panel">
        <div className="container-site flex flex-wrap gap-x-2 gap-y-2 py-4">
          {services.map((s) => (
            <a key={s.id} href={`#${s.slug}`} className="rounded-full border border-line bg-panel-2 px-3 py-1.5 text-[11px] font-medium text-ink2 hover:border-brand/40 hover:text-brand">
              {s.name}
            </a>
          ))}
        </div>
      </section>

      <div className="container-site py-14 md:py-20">
        <div className="flex flex-col gap-6">
          {services.map((service, index) => (
            <article key={service.id} id={service.slug} className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-panel">
              <div className={`grid gap-0 lg:grid-cols-2 ${index % 2 === 1 ? "lg:[&>div:first-child]:order-2" : ""}`}>
                <div className="relative min-h-[240px] bg-panel-2">
                  {service.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={service.imageUrl} alt={service.name} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-brand/30"><ServiceIcon name={service.icon} size={88} /></div>
                  )}
                </div>
                <div className="p-6 sm:p-8">
                  <div className="flex items-center gap-3">
                    <span className="service-icon"><ServiceIcon name={service.icon} /></span>
                    <div>
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-brand">{service.featured ? "Most requested" : "Summit service"}</div>
                      <h2 className="text-[21px] font-[780] tracking-[-0.03em] text-ink">{service.name}</h2>
                    </div>
                  </div>
                  <p className="mt-4 text-[12.5px] leading-relaxed text-ink2">{service.description ?? service.shortDescription}</p>
                  <ul className="mt-4 grid gap-1.5">
                    {INCLUDED.slice(0, index % 2 === 0 ? 4 : 3).map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[11px] text-muted">
                        <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-500" /> {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link href={`/contact?service=${service.slug}`} className="btn btn-primary btn-sm">Request {service.name.toLowerCase()} <ArrowRight size={13} /></Link>
                    <a href={`tel:${c("company.phone").replace(/[^0-9+]/g, "")}`} className="text-[11.5px] font-semibold text-ink2 hover:text-brand">or call {c("company.phone")}</a>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-line bg-panel p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand">What&apos;s included</span>
              <h2 className="mt-2 text-[24px] font-[780] leading-[1.15] tracking-[-0.03em] text-ink">One contract. One team. No surprises.</h2>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                Every Summit project follows the same standards, whether it is a $8k repair or a $600k buildout. You get clarity before we start and accountability until closeout.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <div key={item} className="flex items-start gap-2 rounded-lg border border-line bg-panel-2 p-3">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-brand" />
                  <span className="text-[10.5px] leading-relaxed text-ink2">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
