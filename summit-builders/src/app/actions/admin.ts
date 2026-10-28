"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { guard, actionError } from "@/lib/guard";
import { recordAudit } from "@/lib/audit";
import { bool, int, optional, s } from "@/lib/forms";
import type { ActionResult } from "@/lib/forms";

function refreshWebsite() {
  revalidatePath("/crm/admin/website");
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath("/about");
  revalidatePath("/projects");
  revalidatePath("/contact");
}

function refreshAdmin() {
  revalidatePath("/crm/admin/users");
  revalidatePath("/crm/admin/settings");
  revalidatePath("/crm/admin/audit");
  revalidatePath("/crm/layout");
}

/* -------------------------------- CONTENT --------------------------------- */

export async function saveWebsiteContent(formData: FormData): Promise<ActionResult> {
  const g = await guard("website");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) {
    return { ok: false, error: "Only administrators can edit website content." };
  }
  try {
    const entries: Array<[string, string]> = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("content.") && typeof value === "string") {
        entries.push([key.slice("content.".length), value]);
      }
    }
    if (!entries.length) return { ok: false, error: "No content changes submitted." };

    let changed = 0;
    for (const [key, value] of entries) {
      const existing = await db.websiteContent.findUnique({ where: { key } });
      if (!existing) continue;
      if (existing.value === value) continue;
      await db.websiteContent.update({ where: { key }, data: { value } });
      await recordAudit({
        user: g.user, action: "UPDATE", module: "Website Content", recordId: key,
        recordLabel: existing.label ?? key,
        previousValue: existing.value.slice(0, 240), newValue: value.slice(0, 240),
      });
      changed += 1;
    }
    refreshWebsite();
    return { ok: true, message: changed ? `${changed} content field${changed === 1 ? "" : "s"} updated. Changes are live on the website.` : "No changes to save." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

/* -------------------------------- SERVICES -------------------------------- */

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function saveService(formData: FormData): Promise<ActionResult> {
  const g = await guard("website");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) {
    return { ok: false, error: "Only administrators can manage services." };
  }
  try {
    const id = s(formData, "id");
    const name = s(formData, "name");
    if (!name) return { ok: false, error: "Service name is required." };
    const shortDescription = s(formData, "shortDescription");
    if (!shortDescription) return { ok: false, error: "Add a short description for the website card." };
    const slug = s(formData, "slug") || slugify(name);

    const duplicate = await db.service.findFirst({ where: { OR: [{ name }, { slug }], ...(id ? { NOT: { id } } : {}) } });
    if (duplicate) return { ok: false, error: `${name} or its URL slug already exists.` };

    const data = {
      name, slug, shortDescription,
      description: optional(formData, "description"),
      icon: s(formData, "icon", "Hammer") || "Hammer",
      imageUrl: optional(formData, "imageUrl"),
      active: bool(formData, "active"),
      featured: bool(formData, "featured"),
      sortOrder: int(formData, "sortOrder", 99),
    };

    if (id) {
      const existing = await db.service.findUnique({ where: { id } });
      if (!existing) return { ok: false, error: "Service not found." };
      await db.service.update({ where: { id }, data });
      await recordAudit({ user: g.user, action: "UPDATE", module: "Services", recordId: id, recordLabel: existing.name, previousValue: existing.name, newValue: name });
    } else {
      const created = await db.service.create({ data });
      await recordAudit({ user: g.user, action: "CREATE", module: "Services", recordId: created.id, recordLabel: created.name });
    }
    refreshWebsite();
    refreshAdmin();
    return { ok: true, message: `${name} saved.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function toggleService(serviceId: string, active: boolean): Promise<ActionResult> {
  const g = await guard("website");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) return { ok: false, error: "Only administrators can manage services." };
  try {
    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service) return { ok: false, error: "Service not found." };
    await db.service.update({ where: { id: serviceId }, data: { active } });
    await recordAudit({ user: g.user, action: "UPDATE", module: "Services", recordId: serviceId, recordLabel: service.name, previousValue: service.active ? "active" : "inactive", newValue: active ? "active" : "inactive" });
    refreshWebsite();
    return { ok: true, message: `${service.name} ${active ? "activated" : "deactivated"}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function moveService(serviceId: string, direction: "up" | "down"): Promise<ActionResult> {
  const g = await guard("website");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) return { ok: false, error: "Only administrators can reorder services." };
  try {
    const services = await db.service.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    const index = services.findIndex((x) => x.id === serviceId);
    if (index < 0) return { ok: false, error: "Service not found." };
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= services.length) return { ok: false, error: "Already at the edge of the list." };
    const a = services[index];
    const b = services[swapWith];
    await db.$transaction([
      db.service.update({ where: { id: a.id }, data: { sortOrder: swapWith } }),
      db.service.update({ where: { id: b.id }, data: { sortOrder: index } }),
    ]);
    await recordAudit({ user: g.user, action: "UPDATE", module: "Services", recordId: a.id, recordLabel: `${a.name} reordered`, newValue: direction });
    refreshWebsite();
    return { ok: true, message: "Service order updated." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

/* ------------------------------- PORTFOLIO -------------------------------- */

export async function savePortfolioProject(formData: FormData): Promise<ActionResult> {
  const g = await guard("website");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) return { ok: false, error: "Only administrators can manage the portfolio." };
  try {
    const id = s(formData, "id");
    const title = s(formData, "title");
    const imageUrl = s(formData, "imageUrl");
    const description = s(formData, "description");
    if (!title || !imageUrl || !description) return { ok: false, error: "Title, image path and description are required." };
    const data = {
      title, category: s(formData, "category", "Residential") || "Residential",
      description, imageUrl, location: s(formData, "location"),
      completedAt: optional(formData, "completedAt") ? new Date(`${s(formData, "completedAt")}T12:00:00`) : null,
      featured: bool(formData, "featured"), active: bool(formData, "active"),
      sortOrder: int(formData, "sortOrder", 0),
    };
    if (id) {
      await db.portfolioProject.update({ where: { id }, data });
      await recordAudit({ user: g.user, action: "UPDATE", module: "Portfolio", recordId: id, recordLabel: title });
    } else {
      const created = await db.portfolioProject.create({ data });
      await recordAudit({ user: g.user, action: "CREATE", module: "Portfolio", recordId: created.id, recordLabel: title });
    }
    refreshWebsite();
    return { ok: true, message: `${title} saved.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function togglePortfolioProject(id: string, active: boolean): Promise<ActionResult> {
  const g = await guard("website");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const row = await db.portfolioProject.findUnique({ where: { id } });
    if (!row) return { ok: false, error: "Portfolio project not found." };
    await db.portfolioProject.update({ where: { id }, data: { active } });
    await recordAudit({ user: g.user, action: "UPDATE", module: "Portfolio", recordId: id, recordLabel: row.title, previousValue: row.active ? "visible" : "hidden", newValue: active ? "visible" : "hidden" });
    refreshWebsite();
    return { ok: true, message: `${row.title} ${active ? "published" : "hidden"}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

/* ------------------------------ TESTIMONIALS ------------------------------ */

export async function saveTestimonial(formData: FormData): Promise<ActionResult> {
  const g = await guard("website");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) return { ok: false, error: "Only administrators can manage testimonials." };
  try {
    const id = s(formData, "id");
    const name = s(formData, "name");
    const quote = s(formData, "quote");
    if (!name || !quote) return { ok: false, error: "Customer name and quote are required." };
    const data = {
      name, company: optional(formData, "company"), quote,
      rating: Math.max(1, Math.min(5, int(formData, "rating", 5))),
      active: bool(formData, "active"), sortOrder: int(formData, "sortOrder", 0),
    };
    if (id) {
      await db.testimonial.update({ where: { id }, data });
      await recordAudit({ user: g.user, action: "UPDATE", module: "Testimonials", recordId: id, recordLabel: name });
    } else {
      const created = await db.testimonial.create({ data });
      await recordAudit({ user: g.user, action: "CREATE", module: "Testimonials", recordId: created.id, recordLabel: name });
    }
    refreshWebsite();
    return { ok: true, message: `Testimonial from ${name} saved.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function deleteTestimonial(id: string): Promise<ActionResult> {
  const g = await guard("website");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) return { ok: false, error: "Only administrators can manage testimonials." };
  try {
    const row = await db.testimonial.findUnique({ where: { id } });
    if (!row) return { ok: false, error: "Testimonial not found." };
    await db.testimonial.delete({ where: { id } });
    await recordAudit({ user: g.user, action: "DELETE", module: "Testimonials", recordId: id, recordLabel: row.name, previousValue: row.quote.slice(0, 160) });
    refreshWebsite();
    return { ok: true, message: "Testimonial removed." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

/* ------------------------------ SERVICE AREAS ----------------------------- */

export async function saveServiceArea(formData: FormData): Promise<ActionResult> {
  const g = await guard("website");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) return { ok: false, error: "Only administrators can manage service areas." };
  try {
    const id = s(formData, "id");
    const name = s(formData, "name");
    if (!name) return { ok: false, error: "Enter a city or area name." };
    const data = { name, state: s(formData, "state", "CO") || "CO", active: bool(formData, "active"), sortOrder: int(formData, "sortOrder", 99) };
    if (id) {
      await db.serviceArea.update({ where: { id }, data });
      await recordAudit({ user: g.user, action: "UPDATE", module: "Service Areas", recordId: id, recordLabel: name });
    } else {
      const existing = await db.serviceArea.findUnique({ where: { name } });
      if (existing) return { ok: false, error: `${name} is already a service area.` };
      const created = await db.serviceArea.create({ data });
      await recordAudit({ user: g.user, action: "CREATE", module: "Service Areas", recordId: created.id, recordLabel: name });
    }
    refreshWebsite();
    return { ok: true, message: `${name} saved.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function toggleServiceArea(id: string, active: boolean): Promise<ActionResult> {
  const g = await guard("website");
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const row = await db.serviceArea.findUnique({ where: { id } });
    if (!row) return { ok: false, error: "Service area not found." };
    await db.serviceArea.update({ where: { id }, data: { active } });
    await recordAudit({ user: g.user, action: "UPDATE", module: "Service Areas", recordId: id, recordLabel: row.name, previousValue: row.active ? "active" : "inactive", newValue: active ? "active" : "inactive" });
    refreshWebsite();
    return { ok: true, message: `${row.name} ${active ? "enabled" : "disabled"}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

/* ---------------------------------- USERS --------------------------------- */

const VALID_ROLES = ["SUPER_ADMIN", "ADMIN", "SALES_MANAGER", "SALES_REP", "PROJECT_MANAGER", "DISPATCHER", "FIELD"];

export async function createUser(formData: FormData): Promise<ActionResult> {
  const g = await guard("users");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) return { ok: false, error: "Only administrators can create users." };
  try {
    const name = s(formData, "name");
    const email = s(formData, "email").toLowerCase();
    const role = s(formData, "role", "SALES_REP") || "SALES_REP";
    const password = s(formData, "password");
    if (!name || !email) return { ok: false, error: "Name and email are required." };
    if (!VALID_ROLES.includes(role)) return { ok: false, error: "Choose a valid role." };
    if (role === "SUPER_ADMIN" && g.user.role !== "SUPER_ADMIN") return { ok: false, error: "Only a Super Admin can create another Super Admin." };
    if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
    const duplicate = await db.user.findUnique({ where: { email } });
    if (duplicate) return { ok: false, error: `${email} already has an account.` };

    const created = await db.user.create({
      data: {
        name, email, role,
        passwordHash: await bcrypt.hash(password, 10),
        phone: optional(formData, "phone"),
        employeeId: optional(formData, "employeeId"),
        active: true,
      },
    });
    await recordAudit({ user: g.user, action: "CREATE", module: "Users", recordId: created.id, recordLabel: email, newValue: `Role: ${role}` });
    refreshAdmin();
    return { ok: true, message: `Account created for ${name}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function updateUser(formData: FormData): Promise<ActionResult> {
  const g = await guard("users");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) return { ok: false, error: "Only administrators can edit users." };
  try {
    const id = s(formData, "id");
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "User not found." };
    const role = s(formData, "role", existing.role) || existing.role;
    if (!VALID_ROLES.includes(role)) return { ok: false, error: "Choose a valid role." };
    if (role === "SUPER_ADMIN" && g.user.role !== "SUPER_ADMIN") return { ok: false, error: "Only a Super Admin can assign the Super Admin role." };
    if (existing.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
      const supers = await db.user.count({ where: { role: "SUPER_ADMIN", active: true } });
      if (supers <= 1) return { ok: false, error: "At least one active Super Admin must remain." };
    }
    const employeeId = optional(formData, "employeeId");
    const duplicateLink = employeeId ? await db.user.findFirst({ where: { employeeId, NOT: { id } } }) : null;
    if (duplicateLink) return { ok: false, error: "That employee is already linked to another user." };

    await db.user.update({
      where: { id },
      data: {
        name: s(formData, "name", existing.name) || existing.name,
        role, phone: optional(formData, "phone"), employeeId,
      },
    });
    await recordAudit({
      user: g.user, action: existing.role !== role ? "PERMISSION" : "UPDATE", module: "Users", recordId: id,
      recordLabel: existing.email, previousValue: `Role: ${existing.role}`, newValue: `Role: ${role}`,
    });
    refreshAdmin();
    return { ok: true, message: `${existing.name} updated.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const g = await guard("users");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) return { ok: false, error: "Only administrators can change account status." };
  try {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, error: "User not found." };
    if (userId === g.user.id && !active) return { ok: false, error: "You cannot deactivate your own account." };
    if (user.role === "SUPER_ADMIN" && !active) {
      const supers = await db.user.count({ where: { role: "SUPER_ADMIN", active: true } });
      if (supers <= 1) return { ok: false, error: "At least one active Super Admin must remain." };
    }
    await db.user.update({ where: { id: userId }, data: { active } });
    if (!active) await db.session.deleteMany({ where: { userId } });
    await recordAudit({ user: g.user, action: "PERMISSION", module: "Users", recordId: userId, recordLabel: user.email, previousValue: user.active ? "active" : "inactive", newValue: active ? "active" : "inactive" });
    refreshAdmin();
    return { ok: true, message: `${user.name} ${active ? "reactivated" : "deactivated"}.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function resetUserPassword(formData: FormData): Promise<ActionResult> {
  const g = await guard("users");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) return { ok: false, error: "Only administrators can reset passwords." };
  try {
    const id = s(formData, "id");
    const password = s(formData, "password");
    if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return { ok: false, error: "User not found." };
    if (user.role === "SUPER_ADMIN" && g.user.role !== "SUPER_ADMIN") return { ok: false, error: "Only a Super Admin can reset another Super Admin's password." };
    await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    await db.session.deleteMany({ where: { userId: id } });
    await recordAudit({ user: g.user, action: "PERMISSION", module: "Users", recordId: id, recordLabel: `${user.email} password reset` });
    refreshAdmin();
    return { ok: true, message: `Password reset for ${user.name}. Existing sessions were signed out.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

/* --------------------------------- SETTINGS -------------------------------- */

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  const g = await guard("settings");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) return { ok: false, error: "Only administrators can change settings." };
  try {
    const entries: Array<[string, string]> = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("setting.") && typeof value === "string") entries.push([key.slice("setting.".length), value]);
    }
    for (const [key, value] of entries) {
      const existing = await db.websiteContent.findUnique({ where: { key } });
      if (existing) {
        if (existing.value !== value) {
          await db.websiteContent.update({ where: { key }, data: { value } });
          await recordAudit({ user: g.user, action: "UPDATE", module: "Settings", recordId: key, recordLabel: existing.label ?? key, previousValue: existing.value.slice(0, 200), newValue: value.slice(0, 200) });
        }
      } else {
        await db.websiteContent.create({ data: { key, value, group: "Settings", label: key } });
      }
    }
    refreshAdmin();
    refreshWebsite();
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}

export async function createDepartment(formData: FormData): Promise<ActionResult> {
  const g = await guard("settings");
  if (!g.ok) return { ok: false, error: g.error };
  if (!["SUPER_ADMIN", "ADMIN"].includes(g.user.role)) return { ok: false, error: "Only administrators can manage departments." };
  try {
    const name = s(formData, "name");
    if (!name) return { ok: false, error: "Enter a department name." };
    const existing = await db.department.findUnique({ where: { name } });
    if (existing) return { ok: false, error: `${name} already exists.` };
    const created = await db.department.create({ data: { name, description: optional(formData, "description") } });
    await recordAudit({ user: g.user, action: "CREATE", module: "Settings", recordId: created.id, recordLabel: name });
    refreshAdmin();
    revalidatePath("/crm/employees");
    return { ok: true, message: `${name} created.` };
  } catch (e) {
    return { ok: false, error: actionError(e) };
  }
}
