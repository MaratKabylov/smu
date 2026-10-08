import type { MetadataRoute } from "next";
import { notFound } from "next/navigation";
import { locales, publicSections } from "@/lib/i18n/locales";
import { absoluteUrl } from "@/lib/seo/site";
import { SeoService, sitemapPageSize } from "@/server/services/seo.service";

// Indexing always reads current public visibility; persistent caching is a
// separate implementation-plan step. Do not freeze the index at build time.
export async function sitemapIds() {
  const { total } = await new SeoService().page(1);
  const count = Math.max(1, Math.ceil(total / sitemapPageSize));
  if (count > 50000) throw new Error("Sitemap index requires another partition level.");
  return Array.from({ length: count }, (_, id) => ({ id }));
}
export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const rawId = await id;
  if (!/^(0|[1-9][0-9]*)$/.test(rawId) || Number(rawId) >= 50000) notFound();
  const index = Number(rawId);
  const { total, items } = await new SeoService().page(index + 1);
  if (index > 0 && index * sitemapPageSize >= total) notFound();
  const entries: MetadataRoute.Sitemap = index === 0 ? publicSections.flatMap(section => {
    const languages = Object.fromEntries(locales.map(locale => [locale, absoluteUrl("/" + locale + "/" + section)]));
    return locales.map(locale => ({ url: languages[locale], alternates: { languages } }));
  }) : [];
  for (const item of items) {
    const languages = Object.fromEntries(item.translations.map(t => [t.locale, absoluteUrl(t.href)]));
    for (const translation of item.translations) entries.push({ url: languages[translation.locale], lastModified: item.updatedAt, alternates: { languages } });
  }
  return entries;
}
