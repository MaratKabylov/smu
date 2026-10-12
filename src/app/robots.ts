import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/site";
import { locales } from "@/lib/i18n/locales";
export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", ...locales.map(locale => `/${locale}/account`)] }, sitemap: absoluteUrl("/sitemap.xml") };
}
