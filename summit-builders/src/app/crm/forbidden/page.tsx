import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";

export default async function ForbiddenPage() {
  const user = await requireUser();
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="card w-full max-w-md p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-brandsoft text-brand">
          <ShieldAlert size={22} />
        </div>
        <h1 className="mt-4 text-[20px] font-[750] tracking-[-0.03em] text-ink">Access restricted</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
          Your role ({user.role.replace(/_/g, " ").toLowerCase()}) does not have permission to view this area. If you believe this is incorrect, contact your administrator.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/crm/dashboard" className="btn btn-primary">Back to dashboard</Link>
          <Link href="/" className="btn btn-outline">Public website</Link>
        </div>
      </div>
    </div>
  );
}
