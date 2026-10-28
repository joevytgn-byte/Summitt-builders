import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

export { ROLE_LABELS, type Role };

const COOKIE = "summit_session";
const SESSION_DAYS = 7;

export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          employee: { include: { department: true } },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return session.user;
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { employee: true },
  });
  if (!user || !user.active) return { ok: false as const, error: "Invalid email or password." };
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { ok: false as const, error: "Invalid email or password." };

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const userAgent = h.get("user-agent") ?? "unknown";

  await db.session.create({ data: { token, userId: user.id, expiresAt, ip, userAgent } });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Only mark the cookie Secure when the request actually arrived over HTTPS.
    // A blanket NODE_ENV check breaks `next start` behind plain-HTTP previews/LAN.
    secure: (h.get("x-forwarded-proto") ?? "http") === "https",
    path: "/",
    expires: expiresAt,
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      userName: user.name,
      action: "LOGIN",
      module: "Auth",
      recordLabel: "User signed in",
      ip,
      userAgent,
    },
  });

  return { ok: true as const, role: user.role as Role };
}

export async function logoutUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const session = await db.session.findUnique({ where: { token }, include: { user: true } }).catch(() => null);
    if (session) {
      await db.auditLog.create({
        data: { userId: session.userId, userName: session.user.name, action: "LOGOUT", module: "Auth", recordLabel: "User signed out" },
      });
    }
    await db.session.deleteMany({ where: { token } });
  }
  jar.delete(COOKIE);
  redirect("/login");
}

export function roleLabel(role: string) {
  return ROLE_LABELS[role as Role] ?? role;
}
