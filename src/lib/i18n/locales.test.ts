import { describe, expect, it } from "vitest";
import { canonicalPublicHref, isLocale, languageSwitchPath, legacyPublicUrl, publicSections, translationPaths } from "./locales";
import { getDictionary } from "./dictionaries";

describe("public locale routing", () => {
  it.each(publicSections)("moves the %s catalogue and its detail while preserving query parameters", section => {
    const catalog = legacyPublicUrl(new URL(`https://example.org/${section}?lang=kk&q=%D2%93%D1%8B%D0%BB%D1%8B%D0%BC&field=physics&field=biology&page=3`))!;
    expect(catalog.pathname).toBe(`/kk/${section}`);
    expect(catalog.searchParams.get("q")).toBe("ғылым");
    expect(catalog.searchParams.getAll("field")).toEqual(["physics", "biology"]);
    expect(catalog.searchParams.get("page")).toBe("3");
    expect(catalog.searchParams.has("lang")).toBe(false);
    const detail = legacyPublicUrl(new URL(`https://example.org/${section}/kk/localized-slug?lang=ru&utm_source=old`))!;
    expect(detail.pathname).toBe(`/kk/${section}/localized-slug`);
    expect(detail.search).toBe("?utm_source=old");
  });
  it.each(["/admin", "/admin/login", "/api/cron/publish-scheduled", "/_next/static/file.js", "/favicon.ico", "/robots.txt", "/unknown", "/journal/de/story", "/journal/ru", "/journal/ru/story/more", "/ru/journal", "/kk/scientists/name"])("leaves %s to its own route", path => {
    expect(legacyPublicUrl(new URL(path, "https://example.org"))).toBeNull();
  });
  it("uses a deterministic default and accepts only registered locales", () => {
    for (const value of [undefined, null, "de", "RU", "__proto__", "constructor", "ru-RU"]) expect(isLocale(value)).toBe(false);
    expect(legacyPublicUrl(new URL("https://example.org/?lang=kk&q=test"))?.pathname).toBe("/kk/journal");
    expect(legacyPublicUrl(new URL("https://example.org/journal?lang=en"))?.pathname).toBe("/en/journal");
    expect(isLocale("ru")).toBe(true); expect(isLocale("kk")).toBe(true); expect(isLocale("en")).toBe(true);
  });
  it("normalizes only known RPC addresses", () => {
    expect(canonicalPublicHref("/scientists/kk/name?q=a#publications")).toBe("/kk/scientists/name?q=a#publications");
    for (const path of ["/ru/scientists/name", "/admin", "https://example.org/journal/ru/story", "//example.org/journal/ru/story"]) expect(canonicalPublicHref(path)).toBe(path);
  });
  it("switches catalog filters and details with different translated slugs", () => {
    const query = new URLSearchParams("lang=ru&q=science&field=physics&page=2&tag=one&tag=two");
    expect(languageSwitchPath("journal", "kk", query)).toBe("/kk/journal?q=science&field=physics&page=2&tag=one&tag=two");
    const paths = translationPaths("journal", [{ locale: "ru", slug: "russian-title" }, { locale: "kk", slug: "kazakh-title" }]);
    expect(languageSwitchPath("journal", "kk", new URLSearchParams(), paths)).toBe("/kk/journal/kazakh-title");
    expect(languageSwitchPath("journal", "kk", new URLSearchParams(), { ru: "/ru/journal/russian-title" })).toBe("/kk/journal");
    expect(query.get("lang")).toBe("ru");
  });
  it("provides the same dictionary keys and localized shared navigation", () => {
    const ru = getDictionary("ru"), kk = getDictionary("kk"), en = getDictionary("en");
    for (const section of Object.keys(ru) as Array<keyof typeof ru>) {
      expect(Object.keys(kk[section]).sort()).toEqual(Object.keys(ru[section]).sort());
      expect(Object.keys(en[section]).sort()).toEqual(Object.keys(ru[section]).sort());
    }
    expect(kk.common.brands.journal).toBe("Жас ғалымдар журналы");
    expect(kk.common.sections.scientists).toBe("Ғалымдар");
    expect(en.common.sections.scientists).toBe("Scientists");
  });
});
