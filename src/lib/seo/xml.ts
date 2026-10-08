import type { MetadataRoute } from "next";
import { absoluteUrl } from "./site";
import type { Locale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { FeedItems } from "@/server/repositories/seo.repository";

// XML 1.0 permits tabs/newlines, printable BMP characters and astral pairs.
export function xmlEscape(value: string): string {
  return value.replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function sitemapIndex(ids: readonly number[]) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    ids.map(id => "<sitemap><loc>" + xmlEscape(absoluteUrl("/sitemap/" + id + ".xml")) + "</loc></sitemap>").join("") + "</sitemapindex>";
}

export function rssFeed(locale: Locale, items: FeedItems): string {
  const title = getDictionary(locale).common.brands.journal;
  const href = absoluteUrl("/" + locale + "/journal");
  const self = absoluteUrl("/" + locale + "/feed.xml");
  return '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>' +
    "<title>" + xmlEscape(title) + "</title><link>" + xmlEscape(href) + "</link><description>" + xmlEscape(getDictionary(locale).journalCatalog.intro) + "</description><language>" + locale + "</language>" +
    '<atom:link href="' + xmlEscape(self) + '" rel="self" type="application/rss+xml"/>' +
    items.map(item => "<item><title>" + xmlEscape(item.title) + "</title><link>" + xmlEscape(absoluteUrl(item.href)) + "</link>" +
      '<guid isPermaLink="false">urn:smu:article:' + item.id + ":" + locale + "</guid><description>" + xmlEscape(item.summary) + "</description><pubDate>" + new Date(item.publishedAt).toUTCString() + "</pubDate></item>").join("") + "</channel></rss>";
}

export function sitemapXml(entries: MetadataRoute.Sitemap) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
    entries.map(entry => "<url><loc>" + xmlEscape(entry.url) + "</loc>" +
      (entry.lastModified ? "<lastmod>" + new Date(entry.lastModified).toISOString() + "</lastmod>" : "") +
      Object.entries(entry.alternates?.languages ?? {}).map(([locale, href]) => href ? '<xhtml:link rel="alternate" hreflang="' + xmlEscape(locale) + '" href="' + xmlEscape(href) + '"/>' : "").join("") + "</url>").join("") + "</urlset>";
}
