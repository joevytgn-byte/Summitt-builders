import { headers } from "next/headers";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

type AuditInput = {
  user?: Pick<SessionUser, "id" | "name"> | null;
  action: "CREATE" | "UPDATE" | "DELETE" | "ASSIGN" | "STATUS" | "LOGIN" | "LOGOUT" | "EXPORT" | "PERMISSION" | "ARCHIVE" | string;
  module: string;
  recordId?: string | null;
  recordLabel?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
};

export async function recordAudit({ user, action, module, recordId, recordLabel, previousValue, newValue }: AuditInput) {
  let ip = "local";
  let userAgent = "unknown";
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    userAgent = h.get("user-agent") || "unknown";
  } catch {
    // headers unavailable outside request scope
  }
  await db.auditLog.create({
    data: {
      userId: user?.id ?? null,
      userName: user?.name ?? "System",
      action,
      module,
      recordId: recordId ?? null,
      recordLabel: recordLabel ?? null,
      previousValue: previousValue ?? null,
      newValue: newValue ?? null,
      ip,
      userAgent,
    },
  });
}
