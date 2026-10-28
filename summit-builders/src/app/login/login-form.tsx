"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, TriangleAlert } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { useToast } from "@/components/toast";

const DEMO = [
  { role: "Super Admin", email: "admin@summitbuilders.com" },
  { role: "Admin", email: "dana@summitbuilders.com" },
  { role: "Sales Manager", email: "alicia@summitbuilders.com" },
  { role: "Sales Rep", email: "ryan@summitbuilders.com" },
  { role: "Project Manager", email: "luis@summitbuilders.com" },
  { role: "Dispatcher", email: "derek@summitbuilders.com" },
  { role: "Field Crew", email: "james@summitbuilders.com" },
];

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("admin@summitbuilders.com");
  const [password, setPassword] = useState("demo1234");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await loginAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.push({ title: "Welcome back", description: "Loading your workspace…" });
      router.push(next);
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-[392px]">
      <div className="eyebrow mb-3">Secure workspace</div>
      <h1 className="text-[29px] font-[780] leading-tight tracking-[-0.04em] text-ink">Welcome back</h1>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">Sign in to manage leads, projects, crews, and customers.</p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        <div className="field">
          <label className="label" htmlFor="email">Email address</label>
          <div className="relative">
            <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="email" name="email" type="email" autoComplete="email" required
              className="input input-icon" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@summitbuilders.com"
            />
          </div>
        </div>

        <div className="field">
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Password</label>
            <span className="mb-1.5 text-[10.5px] text-muted">Demo password: <span className="font-semibold text-ink2">demo1234</span></span>
          </div>
          <div className="relative">
            <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required
              className="input input-icon input-icon-r" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[11.5px] text-red-700">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
          {pending ? <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
          {pending ? "Signing in…" : "Sign in to CRM"}
        </button>
      </form>

      <div className="my-6 hr-text">Or use a demo account</div>

      <div className="grid grid-cols-2 gap-2">
        {DEMO.map((d, i) => (
          <button
            key={d.email}
            type="button"
            onClick={() => { setEmail(d.email); setPassword("demo1234"); setError(""); }}
            className={`rounded-lg border px-3 py-2 text-left transition ${
              email === d.email ? "border-brand bg-brandsoft" : "border-line bg-panel hover:border-line2"
            } ${i === DEMO.length - 1 ? "col-span-2" : ""}`}
          >
            <span className="block text-[11px] font-semibold text-ink">{d.role}</span>
            <span className="mt-0.5 block truncate text-[9.5px] text-muted">{d.email}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[10px] text-muted">Select a role, then press sign in. All demo accounts share the same password.</p>
    </div>
  );
}
