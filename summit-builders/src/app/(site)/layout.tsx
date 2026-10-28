import type { Metadata } from "next";
import { getSiteData } from "@/lib/site";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getSiteData();
  return {
    title: data.c("seo.title", "Summit Builders — Construction & Remodeling in Denver"),
    description: data.c("seo.description", "Licensed general contractor serving Denver, Boulder, and the Front Range."),
    openGraph: {
      title: data.c("seo.title"),
      description: data.c("seo.description"),
      images: [data.c("home.hero.image", "/images/hero.jpg")],
      type: "website",
    },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const data = await getSiteData();
  return (
    <div className="site">
      <SiteHeader name={data.c("company.name", "Summit Builders")} phone={data.c("company.phone", "(555) 123-4567")} />
      <main>{children}</main>
      <SiteFooter data={data} />
    </div>
  );
}
