import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Award, BadgeCheck, CheckCircle2, HardHat, HeartHandshake, MapPin, ShieldCheck, Users } from "lucide-react";
import { getSiteData } from "@/lib/site";
import { db } from "@/lib/db";
import { Avatar } from "@/components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { c } = await getSiteData();
  return { title: `About — ${c("company.name", "Summit Builders")}`, description: c("about.body").slice(0, 160) };
}

export default async function AboutPage() {
  const { c, services, areas } = await getSiteData();
  const [team, projectCount, customerCount] = await Promise.all([
    db.employee.findMany({
      where: { status: "ACTIVE", position: { in: ["Owner / President", "Sales Manager", "Project Manager", "Operations Manager", "Lead Carpenter", "Estimator"] } },
      select: { id: true, firstName: true, lastName: true, position: true, avatarColor: true, hireDate: true },
      orderBy: { hireDate: "asc" },
      take: 6,
    }),
    db.project.count(),
    db.customer.count(),
  ]);
  const values = c("about.values").split("·").map((v) => v.trim()).filter(Boolean);

  return (
    <>
      <section className="border-b border-line bg-[#15181d] py-16 text-white md:py-20">
        <div className="container-site grid gap-10 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand">About Summit Builders</span>
            <h1 className="mt-2 text-[34px] font-[800] leading-[1.08] tracking-[-0.04em] sm:text-[46px]">{c("about.title")}</h1>
            <p className="mt-4 max-w-[620px] text-[13px] leading-relaxed text-white/55">{c("about.body")}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-white/50">
              <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-brand" /> {c("company.license")}</span>
              <span className="flex items-center gap-1.5"><MapPin size={13} className="text-brand" /> Denver, Colorado</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              [c("home.stats.projects", "850+"), "projects delivered"],
              [c("home.stats.years", "15+"), "years building"],
              [c("home.stats.crew", "32"), "crew members"],
              [c("home.stats.satisfaction", "98%"), "satisfaction"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-[26px] font-[800] tracking-[-0.04em] text-white">{value}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-white/40">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-site py-14 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div className="photo-tile aspect-[4/3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/team.jpg" alt="Summit Builders team" className="img-cover" />
          </div>
          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand">Our mission</span>
            <h2 className="mt-2 text-[26px] font-[780] leading-[1.15] tracking-[-0.035em] text-ink sm:text-[32px]">Construction should feel straightforward.</h2>
            <p className="mt-4 text-[13px] leading-relaxed text-ink2">{c("about.mission")}</p>
            <div className="mt-4 rounded-xl border border-line bg-panel-2 p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Experience</div>
              <div className="mt-1 text-[13px] font-semibold text-ink">{c("about.experience")}</div>
            </div>
            <div className="mt-5 grid gap-2">
              {values.map((value) => (
                <div key={value} className="flex items-center gap-2 text-[11.5px] text-ink2">
                  <CheckCircle2 size={13} className="text-emerald-500" /> {value}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-panel">
        <div className="container-site py-14 md:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-brand">The team</span>
              <h2 className="mt-2 text-[26px] font-[780] leading-[1.14] tracking-[-0.035em] text-ink sm:text-[32px]">People who answer the phone.</h2>
              <p className="mt-2 max-w-[520px] text-[12px] text-muted">Estimators, project managers and tradespeople who have been with Summit for years — not a rotating cast of subcontractors.</p>
            </div>
            <Link href="/contact" className="btn btn-outline">Meet with us <ArrowRight size={14} /></Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member) => (
              <div key={member.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 p-4">
                <Avatar name={`${member.firstName} ${member.lastName}`} color={member.avatarColor} size="lg" />
                <div>
                  <div className="text-[12.5px] font-semibold text-ink">{member.firstName} {member.lastName}</div>
                  <div className="text-[10.5px] text-muted">{member.position}</div>
                  <div className="text-[9.5px] text-muted/70">Since {member.hireDate.getFullYear()}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: <Users size={15} />, value: `${uniquify(customerCount)}`, label: "customers served" },
              { icon: <HardHat size={15} />, value: `${uniquify(projectCount)}`, label: "projects in the system" },
              { icon: <Award size={15} />, value: `${services.length}`, label: "trades and services" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-xl border border-line bg-panel-2 p-4">
                <span className="grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">{s.icon}</span>
                <div>
                  <div className="text-[18px] font-[800] tracking-[-0.03em] text-ink">{s.value}</div>
                  <div className="text-[10px] text-muted">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-site py-14 md:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: <ShieldCheck size={20} />, title: "Safety first, always", body: "OSHA-aligned job sites, daily briefings, and a safety record we protect like our reputation." },
            { icon: <BadgeCheck size={20} />, title: "Licensed & insured", body: c("company.license") + ". Certificates provided before every project." },
            { icon: <HeartHandshake size={20} />, title: "Respect the space", body: "Floor protection, dust control, daily cleanup and a final walkthrough you sign off on." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-line bg-panel p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">{item.icon}</span>
              <div className="mt-3 text-[13px] font-bold text-ink">{item.title}</div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted">Where we work</div>
            <div className="mt-1.5 flex flex-wrap gap-x-2 text-[11.5px] text-ink2">
              {areas.map((a, i) => <span key={a.id}>{a.name}{i < areas.length - 1 ? " ·" : ""}</span>)}
            </div>
          </div>
          <Link href="/contact" className="btn btn-primary">Start a project <ArrowRight size={14} /></Link>
        </div>
      </section>
    </>
  );
}

function uniquify(value: number) {
  return value > 0 ? `${value}` : "—";
}
