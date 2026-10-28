import { db } from "@/lib/db";

export async function getSiteData() {
  const [rows, services, portfolio, testimonials, areas] = await Promise.all([
    db.websiteContent.findMany({ select: { key: true, value: true } }),
    db.service.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.portfolioProject.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { completedAt: "desc" }] }),
    db.testimonial.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }] }),
    db.serviceArea.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  const content = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const c = (key: string, fallback = "") => content[key] || fallback;

  return { content, c, services, portfolio, testimonials, areas };
}

export type SiteData = Awaited<ReturnType<typeof getSiteData>>;
