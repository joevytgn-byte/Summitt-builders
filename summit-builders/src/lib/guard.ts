import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { canAccess, type ModuleKey } from "@/lib/permissions";

export async function guard(module: ModuleKey): Promise<{ ok: true; user: SessionUser; error: null } | { ok: false; user: null; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, user: null, error: "Your session expired. Please sign in again." };
  if (!canAccess(user.role, module)) return { ok: false, user: null, error: "You do not have permission to perform this action." };
  return { ok: true, user, error: null };
}

export function actionError(e: unknown) {
  console.error(e);
  if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
    return "A record with that unique value already exists.";
  }
  return "Something went wrong. Please review the form and try again.";
}
