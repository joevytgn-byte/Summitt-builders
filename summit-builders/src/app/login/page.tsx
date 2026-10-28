import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { BrandMark } from "@/components/ui";

export const metadata = { title: "Sign in — Summit Builders CRM" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/crm/dashboard");
  const sp = await searchParams;
  const next = sp.next?.startsWith("/crm") ? sp.next : "/crm/dashboard";

  return (
    <div className="login-wrap">
      <section className="login-visual">
        <Link href="/" className="flex items-center gap-3">
          <BrandMark size={38} />
          <span>
            <span className="block text-[16px] font-[750] tracking-[-0.03em] text-white">Summit Builders</span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">Construction CRM</span>
          </span>
        </Link>

        <div className="max-w-[480px] py-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/70">
            <span className="size-1.5 rounded-full bg-[#ff8a4c]" /> Built for the field & the office
          </div>
          <h1 className="text-[42px] font-[800] leading-[0.98] tracking-[-0.045em] text-white xl:text-[50px]">
            Build the business<br />behind the build.
          </h1>
          <p className="mt-5 max-w-[400px] text-[13.5px] leading-relaxed text-white/60">
            Every lead, estimate, crew, and job in one connected workspace — from the first website inquiry to the final walkthrough.
          </p>
          <div className="mt-9 grid max-w-[420px] grid-cols-3 gap-5 border-t border-white/10 pt-6">
            {[["850+", "Projects"], ["15 yrs", "Experience"], ["98%", "Satisfaction"]].map(([v, l]) => (
              <div key={l}>
                <div className="text-[21px] font-[750] tracking-[-0.03em] text-white">{v}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-white/40">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-5 text-[10.5px] text-white/40">
          <span>CO GC License #GC-204918 · Licensed, bonded & insured</span>
          <span>Denver, CO</span>
        </div>
      </section>

      <section className="flex min-h-dvh flex-col px-5 py-7 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[12px] font-medium text-muted hover:text-ink sm:hidden">
            <BrandMark size={28} /> Summit Builders
          </Link>
          <Link href="/" className="ml-auto text-[11.5px] font-medium text-muted hover:text-ink">← Back to website</Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <LoginForm next={next} />
        </div>

        <div className="text-center text-[10.5px] text-muted">
          Protected by role-based access control · Demo environment · v1.0
        </div>
      </section>
    </div>
  );
}
