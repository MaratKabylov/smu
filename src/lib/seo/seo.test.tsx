// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { siteOrigin, absoluteUrl } from "./site";
import { catalogMetadata, pageAlternates, openGraphLocale } from "./metadata";
import { articleJsonLd, personJsonLd, serializeJsonLd, organizationJsonLd } from "./structured-data";
import { rssFeed, sitemapIndex, sitemapXml, xmlEscape } from "./xml";
import { JsonLd } from "@/components/seo/JsonLd";
import type { PublicArticleDetail } from "@/types/domain/article";
import type { PublicScientistDetail } from "@/types/domain/scientist";

const article: PublicArticleDetail = {
  id: "00000000-0000-4000-a000-000000000001", contentType: "article", publishedAt: "2026-10-01T01:00:00Z", updatedAt: "2026-10-02T01:00:00Z", category: null, categories: [], tags: [], cover: null, contentTypeItem: null,
  authors: [{ id: "author", nameRu: "Автор", nameKk: "Автор", nameEn: "Author", role: "author", isActive: true, bioRu: null, bioKk: null, organization: null, position: null, websiteUrl: null }, { id: "editor", nameRu: "Редактор", nameKk: "Редактор", role: "editor", isActive: true, bioRu: null, bioKk: null, organization: null, position: null, websiteUrl: null }],
  translation: { locale: "en", title: "Water </script><script>alert(1)</script>", slug: "water", excerpt: "A & B < C", body: "Body", seoTitle: null, seoDescription: null }, alternateTranslations: [{ locale: "ru", title: "Вода", slug: "voda", excerpt: "Вода" }],
};
const person: PublicScientistDetail = { id: "scientist", avatarUrl: null, organization: null, fields: [], publicEmail: "public@example.com", orcid: "0000-0001-2345-6789", scholarUrl: null, translation: { id: "t", locale: "en", fullName: "Scientist", slug: "scientist", position: "Professor", academicDegree: null, shortBio: "Biography", biography: "Long biography" }, alternateTranslations: [] };
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://smu.example"));
afterEach(() => vi.unstubAllEnvs());

describe("public SEO serialization and canonical policy", () => {
  it("uses a trusted configured origin and rejects credentials, paths and non-HTTP URLs", () => {
    expect(siteOrigin()).toBe("https://smu.example");
    expect(absoluteUrl("/kk/journal?v=2")).toBe("https://smu.example/kk/journal?v=2");
    for (const value of ["ftp://example.com", "https://user:secret@example.com", "https://example.com/sub", "https://example.com/?secret=one", "https://example.com/#one"]) {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", value); expect(() => siteOrigin()).toThrow();
    }
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://smu.example/");
    for (const path of ["//external.example", "/\\external.example", "https://external.example"]) expect(() => absoluteUrl(path)).toThrow();
  });
  it("maps real translated slugs without inventing English versions", () => {
    expect(pageAlternates("ru", "journal", [{ locale: "ru", slug: "voda" }, { locale: "kk", slug: "su" }])).toMatchObject({ canonical: "https://smu.example/ru/journal/voda", languages: { ru: "https://smu.example/ru/journal/voda", kk: "https://smu.example/kk/journal/su" } });
    expect(pageAlternates("ru", "journal", [{ locale: "ru", slug: "voda" }]).languages).not.toHaveProperty("en");
    expect(openGraphLocale.en).toBe("en_GB");
  });
  it("indexes unfiltered catalog pagination with its own canonical and discards tracking", () => {
    expect(catalogMetadata("kk", "scientists", "Title", "Intro", { page: "2", lang: "ru", utm_source: "campaign" })).toMatchObject({ alternates: { canonical: "https://smu.example/kk/scientists?page=2" }, robots: { index: true, follow: true } });
    expect(catalogMetadata("en", "journal", "Title", "Intro", { page: "1" }).alternates?.languages).toHaveProperty("en");
    expect(catalogMetadata("en", "journal", "Title", "Intro", { page: "2" }).alternates?.languages).toBeUndefined();
  });
  it.each(["q", "category", "tag", "organization", "field", "stage", "format", "kind", "period"])("keeps %s filter results out of the index", key => {
    expect(catalogMetadata("ru", "journal", "T", "D", { [key]: "filter", page: "2" })).toMatchObject({ alternates: { canonical: "https://smu.example/ru/journal" }, robots: { index: false, follow: true } });
  });
  it("keeps the default upcoming-event catalog indexable and excludes alternate periods", () => {
    expect(catalogMetadata("en", "events", "T", "D", { period: "upcoming" }).robots).toEqual({ index: true, follow: true });
    for (const period of ["all", "past"]) expect(catalogMetadata("en", "events", "T", "D", { period }).robots).toEqual({ index: false, follow: true });
  });
  it("uses actual author roles and publication dates without inventing an author", () => {
    expect(articleJsonLd(article)).toMatchObject({ "@type": "Article", inLanguage: "en", datePublished: article.publishedAt, dateModified: article.updatedAt, author: [{ "@type": "Person", name: "Author" }] });
    expect(articleJsonLd({ ...article, authors: [] })).not.toHaveProperty("author");
    expect(organizationJsonLd("en")).toHaveProperty("@id", "https://smu.example/#organization");
  });
  it("describes only the public scientist projection and excludes email/account identity", () => {
    const data = personJsonLd(person);
    expect(data).toMatchObject({ "@type": "Person", name: "Scientist", sameAs: ["https://orcid.org/0000-0001-2345-6789"] });
    expect(JSON.stringify(data)).not.toContain("public@example.com");
    expect(data).not.toHaveProperty("userId");
  });
  it("prevents JSON-LD script breakout while preserving parsed text including Unicode", () => {
    const data = { ...articleJsonLd(article), extra: "Line\u2028separator\u2029" };
    expect(serializeJsonLd(data)).not.toContain("</script>");
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
    const html = renderToStaticMarkup(<JsonLd data={data} />);
    const document = new DOMParser().parseFromString(html, "text/html");
    expect(document.querySelectorAll("script")).toHaveLength(1);
    expect(JSON.parse(document.querySelector("script")!.textContent!)).toEqual(data);
  });
  it("emits valid localized RSS with escaped text, permanent GUIDs and no full private body", () => {
    const xml = rssFeed("en", [{ id: article.id, title: article.translation.title, summary: article.translation.excerpt, href: "/en/journal/water", publishedAt: article.publishedAt }]);
    const document = new DOMParser().parseFromString(xml, "application/xml");
    expect(document.querySelector("item title")?.textContent).toBe(article.translation.title);
    expect(document.querySelector("item description")?.textContent).toBe(article.translation.excerpt);
    expect(document.querySelector("guid")?.textContent).toBe("urn:smu:article:" + article.id + ":en");
    expect(document.querySelector("language")?.textContent).toBe("en");
    expect(document.querySelector("pubDate")?.textContent).toBe("Thu, 01 Oct 2026 01:00:00 GMT");
    expect(rssFeed("kk", [])).toContain("<language>kk</language>");
    expect(xmlEscape("one\u0000two & < \ud800")).toBe("onetwo &amp; &lt; ");
  });
  it("serializes sitemap parts and language alternates as parseable XML", () => {
    const document = new DOMParser().parseFromString(sitemapXml([{ url: "https://smu.example/ru/journal/water", lastModified: article.updatedAt, alternates: { languages: { ru: "https://smu.example/ru/journal/water", kk: "https://smu.example/kk/journal/su" } } }]), "application/xml");
    expect(document.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "link")).toHaveLength(2);
    const index = new DOMParser().parseFromString(sitemapIndex([0, 1]), "application/xml");
    expect(Array.from(index.querySelectorAll("loc"), node => node.textContent)).toEqual(["https://smu.example/sitemap/0.xml", "https://smu.example/sitemap/1.xml"]);
  });
});
