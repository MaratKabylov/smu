import type { Metadata } from "next";
import { locales, localizedPath, type Locale, type PublicQuery, type PublicSection } from "@/lib/i18n/locales";
import { readPage } from "@/lib/search";
import { absoluteUrl } from "./site";

export const noIndex: Metadata["robots"] = { index: false, follow: false };
export const openGraphLocale: Record<Locale, string> = { ru: "ru_RU", kk: "kk_KZ", en: "en_GB" };

export function pageAlternates(locale: Locale, section: PublicSection, translations: readonly { locale: Locale; slug: string }[]) {
  const paths = Object.fromEntries(translations.map(t => [t.locale, absoluteUrl(localizedPath(t.locale, "/" + section + "/" + encodeURIComponent(t.slug)))]));
  return { canonical: paths[locale], languages: paths, types: { "application/rss+xml": absoluteUrl("/" + locale + "/feed.xml") } };
}

// Search/filter combinations are navigable but must not create an unlimited
// index. Unfiltered pagination has its own canonical; tracking is discarded.
export function catalogMetadata(locale: Locale, section: PublicSection, title: string, description: string, query: PublicQuery = {}): Metadata {
  const page = readPage(query.page);
  const filtered = ["q", "category", "tag", "organization", "field", "stage", "format", "kind", "period"].some(key => {
    const value = query[key];
    return (Array.isArray(value) ? value : [value]).some(item => item && (key === "period" ? item !== "upcoming" : item !== "all"));
  });
  const base = localizedPath(locale, "/" + section);
  const canonical = absoluteUrl(base + (!filtered && page > 1 ? "?page=" + page : ""));
  return {
    title, description,
    alternates: { canonical, types: { "application/rss+xml": absoluteUrl("/" + locale + "/feed.xml") }, ...(!filtered && page === 1 ? { languages: Object.fromEntries(locales.map(l => [l, absoluteUrl(localizedPath(l, "/" + section))])) } : {}) },
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { type: "website", title, description, url: canonical, locale: openGraphLocale[locale] },
  };
}
