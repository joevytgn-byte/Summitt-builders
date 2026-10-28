"use server";

import { loginUser, logoutUser } from "@/lib/auth";
import { s } from "@/lib/forms";
import type { ActionResult } from "@/lib/forms";

export async function loginAction(formData: FormData): Promise<ActionResult & { role?: string }> {
  const email = s(formData, "email");
  const password = s(formData, "password");
  if (!email || !password) return { ok: false, error: "Enter your email and password." };
  const result = await loginUser(email, password);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: "Signed in", role: result.role };
}

export async function logoutAction() {
  await logoutUser();
}
