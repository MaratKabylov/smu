vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ page: vi.fn(), feed: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/services/seo.service", () => ({ sitemapPageSize: 1000, SeoService: class { page = mocks.page; feed = mocks.feed; } }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not_found"); } }));
import sitemap, { sitemapIds } from "./sitemap";
import { GET as indexGET } from "@/app/sitemap.xml/route";
import { GET as partGET } from "@/app/sitemap/[id]/route";
import { GET as feedGET } from "@/app/[locale]/feed.xml/route";
import robots from "@/app/robots";
import { metadata as adminMetadata } from "@/app/admin/layout";
import { metadata as previewMetadata } from "@/app/admin/(panel)/content/articles/[id]/preview/[locale]/page";
vi.mock("@/server/services/access.service", () => ({}));
vi.mock("@/server/services/article.service", () => ({}));
vi.mock("@/server/repositories/article-images.repository", () => ({}));
vi.mock("@/lib/supabase/server", () => ({}));
vi.mock("@/components/articles/ArticleCredits", () => ({}));
vi.mock("@/components/articles/RichTextContent", () => ({}));

const entry = { id: "00000000-0000-4000-a000-000000000001", section: "journal", updatedAt: "2026-10-01T00:00:00Z", translations: [{ locale: "ru", href: "/ru/journal/voda" }, { locale: "kk", href: "/kk/journal/su" }] };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://smu.example"); mocks.page.mockResolvedValue({ total: 1001, items: [entry] }); mocks.feed.mockResolvedValue([]); });
afterEach(() => vi.unstubAllEnvs());
describe("public indexing routes", () => {
  it("partitions all records and includes every catalog exactly once", async () => {
    expect(await sitemapIds()).toEqual([{ id: 0 }, { id: 1 }]);
    const first = await sitemap({ id: Promise.resolve("0") });
    expect(first).toHaveLength(26);
    expect(first.filter(item => item.url.includes("/en/"))).toHaveLength(8);
    const second = await sitemap({ id: Promise.resolve("1") });
    expect(second).toHaveLength(2); expect(mocks.page).toHaveBeenLastCalledWith(2);
    expect(second[0].alternates?.languages).toEqual({ ru: "https://smu.example/ru/journal/voda", kk: "https://smu.example/kk/journal/su" });
    expect(second[0].lastModified).toBe(entry.updatedAt);
  });
  it("keeps a catalog sitemap for an empty site and rejects invalid/out-of-range parts", async () => {
    mocks.page.mockResolvedValue({ total: 0, items: [] });
    expect(await sitemapIds()).toEqual([{ id: 0 }]);
    expect(await sitemap({ id: Promise.resolve("0") })).toHaveLength(24);
    for (const id of ["1", "-1", "01", "NaN", "50000", "100000000000000000000"]) await expect(sitemap({ id: Promise.resolve(id) })).rejects.toThrow("not_found");
  });
  it("serves XML parts and an index without persistent caching", async () => {
    const index = await indexGET();
    expect(index.headers.get("Content-Type")).toContain("application/xml");
    expect(index.headers.get("Cache-Control")).toBe("no-store");
    expect(await index.text()).toContain("https://smu.example/sitemap/1.xml");
    const part = await partGET(new Request("https://smu.example/sitemap/1.xml"), { params: Promise.resolve({ id: "1.xml" }) });
    expect(await part.text()).toContain('hreflang="kk" href="https://smu.example/kk/journal/su"');
    expect((await partGET(new Request("https://smu.example/sitemap/wrong"), { params: Promise.resolve({ id: "wrong" }) })).status).toBe(404);
  });
  it.each(["ru", "kk", "en"])("serves only the requested %s feed", async locale => {
    const response = await feedGET(new Request("https://smu.example/" + locale + "/feed.xml"), { params: Promise.resolve({ locale }) });
    expect(response.headers.get("Content-Type")).toContain("application/rss+xml");
    expect(await response.text()).toContain("<language>" + locale + "</language>");
    expect(mocks.feed).toHaveBeenCalledWith(locale);
  });
  it("rejects unsupported feed locales before querying the database", async () => {
    expect((await feedGET(new Request("https://smu.example/de/feed.xml"), { params: Promise.resolve({ locale: "de" }) })).status).toBe(404);
    expect(mocks.feed).not.toHaveBeenCalled();
  });
  it("blocks admin/API crawling and marks admin/preview as noindex", () => {
    expect(robots()).toMatchObject({ rules: { disallow: ["/admin", "/api/"] }, sitemap: "https://smu.example/sitemap.xml" });
    expect(adminMetadata.robots).toEqual({ index: false, follow: false });
    expect(previewMetadata.robots).toEqual({ index: false, follow: false });
  });
});
