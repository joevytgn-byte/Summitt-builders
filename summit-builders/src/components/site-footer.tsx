import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/ui";
import type { SiteData } from "@/lib/site";

export function SiteFooter({ data }: { data: SiteData }) {
  const { c, services, areas } = data;
  const name = c("company.name", "Summit Builders");

  return (
    <footer className="site-footer">
      <div className="container-site grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark size={34} />
            <span className="leading-none">
              <span className="block text-[15px] font-[750] tracking-[-0.03em] text-white">{name}</span>
              <span className="mt-[4px] block text-[9px] font-semibold uppercase tracking-[0.17em] text-white/40">Built to last since {c("company.founded", "2008")}</span>
            </span>
          </div>
          <p className="mt-4 max-w-[280px] text-[12px] leading-relaxed text-white/55">{c("footer.note")}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-[10.5px] text-white/45">
            {c("company.social.facebook") && <a href={c("company.social.facebook")} className="hover:text-white">Facebook</a>}
            {c("company.social.instagram") && <a href={c("company.social.instagram")} className="hover:text-white">Instagram</a>}
            {c("company.social.linkedin") && <a href={c("company.social.linkedin")} className="hover:text-white">LinkedIn</a>}
          </div>
        </div>

        <div>
          <div className="footer-heading">Services</div>
          <ul className="space-y-2 text-[12px]">
            {services.slice(0, 6).map((s) => (
              <li key={s.id}><Link href={`/services#${s.slug}`} className="transition-colors">{s.name}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <div className="footer-heading">Service areas</div>
          <div className="flex flex-wrap gap-x-3 gap-y-2 text-[12px]">
            {areas.slice(0, 10).map((a) => (
              <span key={a.id} className="text-white/55">{a.name}</span>
            ))}
          </div>
          <div className="footer-heading mt-6">Company</div>
          <ul className="space-y-2 text-[12px]">
            <li><Link href="/about">About us</Link></li>
            <li><Link href="/projects">Project gallery</Link></li>
            <li><Link href="/contact">Request a quote</Link></li>
            <li><Link href="/login" className="text-white/45">CRM login</Link></li>
          </ul>
        </div>

        <div>
          <div className="footer-heading">Get in touch</div>
          <ul className="space-y-3 text-[12px]">
            <li className="flex items-start gap-2.5"><Phone size={13} className="mt-0.5 text-brand" /><a href={`tel:${c("company.phone").replace(/[^0-9+]/g, "")}`}>{c("company.phone")}</a></li>
            <li className="flex items-start gap-2.5"><Mail size={13} className="mt-0.5 text-brand" /><a href={`mailto:${c("company.email")}`} className="break-all">{c("company.email")}</a></li>
            <li className="flex items-start gap-2.5"><MapPin size={13} className="mt-0.5 shrink-0 text-brand" /><span className="text-white/55">{c("company.address")}</span></li>
            <li className="flex items-start gap-2.5"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-brand" /><span className="text-white/55">{c("company.license")}</span></li>
          </ul>
          <Link href="/contact" className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:text-white">
            Start your project <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-site flex flex-wrap items-center justify-between gap-3 py-5 text-[10.5px] text-white/35">
          <span>© {new Date().getFullYear()} {name}. All rights reserved.</span>
          <span>{c("company.license")}</span>
          <span className="flex items-center gap-3">
            <span>{c("company.hours")}</span>
            <Link href="/login" className="hover:text-white">Staff login</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
