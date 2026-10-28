"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function CrmError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-red-50 text-red-600"><TriangleAlert size={22} /></div>
        <h1 className="mt-4 text-[20px] font-[750] tracking-[-0.03em] text-ink">Something went wrong</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">The page could not be loaded. This has been logged. Try again or return to the dashboard.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={reset} className="btn btn-primary">Try again</button>
          <a href="/crm/dashboard" className="btn btn-outline">Dashboard</a>
        </div>
      </div>
    </div>
  );
}
