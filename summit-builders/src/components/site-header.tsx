"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, Phone, X } from "lucide-react";
import { BrandMark } from "@/components/ui";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/services", label: "Services" },
  { href: "/projects", label: "Projects" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ name, phone }: { name: string; phone: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="site-header">
      <div className="container-site flex h-full items-center gap-5">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark size={36} />
          <span className="leading-none">
            <span className="block text-[15px] font-[750] tracking-[-0.03em] text-ink">{name}</span>
            <span className="mt-[4px] block text-[9px] font-semibold uppercase tracking-[0.17em] text-muted">General Contractor · Denver, CO</span>
          </span>
        </Link>

        <nav className="ml-6 hidden items-center gap-6 lg:flex" aria-label="Main">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="site-nav-link"
              data-active={link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 sm:flex">
          <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink2 hover:text-brand">
            <Phone size={14} className="text-brand" /> {phone}
          </a>
          <Link href="/contact" className="btn btn-primary">Request a quote <ArrowRight size={14} /></Link>
        </div>

        <button className="ml-auto grid size-9 place-items-center rounded-lg border border-line text-ink sm:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full border-b border-line bg-panel px-5 pb-5 pt-2 shadow-lg sm:hidden">
          <nav className="flex flex-col" aria-label="Mobile">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="border-b border-line py-3 text-[13.5px] font-semibold text-ink2">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2">
            <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="btn btn-outline w-full"><Phone size={14} /> {phone}</a>
            <Link href="/contact" className="btn btn-primary w-full">Request a quote <ArrowRight size={14} /></Link>
          </div>
        </div>
      )}
    </header>
  );
}
