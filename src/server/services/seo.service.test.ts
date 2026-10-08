import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ configured: vi.fn(), publicClient: vi.fn(), sessionClient: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/public", () => ({ createPublicSupabaseClient: mocks.publicClient }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.sessionClient }));
import { SeoService } from "./seo.service";
const item = { id: "00000000-0000-4000-a000-000000000001", section: "journal", updatedAt: "2026-10-01T00:00:00Z", translations: [{ locale: "en", href: "/en/journal/water" }] };
beforeEach(() => {
  vi.clearAllMocks(); mocks.configured.mockReturnValue(true);
  mocks.publicClient.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { total: 1, items: [item] }, error: null });
});
describe("anonymous SEO data service", () => {
  it("loads complete sitemap pages without inheriting a signed-in session", async () => {
    expect(await new SeoService().page(2)).toEqual({ total: 1, items: [item] });
    expect(mocks.rpc).toHaveBeenCalledWith("seo_public_page", { p_page: 2, p_page_size: 1000, p_section: "", p_id: null });
    expect(mocks.sessionClient).not.toHaveBeenCalled();
  });
  it("looks up only real publicly available translations of a record", async () => {
    expect(await new SeoService().paths("journal", item.id)).toEqual({ en: "/en/journal/water" });
    expect(mocks.rpc).toHaveBeenCalledWith("seo_public_page", { p_page: 1, p_page_size: 1, p_section: "journal", p_id: item.id });
    mocks.rpc.mockResolvedValueOnce({ data: { total: 0, items: [] }, error: null });
    expect(await new SeoService().paths("journal", item.id)).toEqual({});
  });
  it("loads a bounded feed and handles an unconfigured local setup", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await new SeoService().feed("kk")).toEqual([]);
    expect(mocks.rpc).toHaveBeenCalledWith("seo_public_feed", { p_locale: "kk", p_limit: 50 });
    vi.clearAllMocks(); mocks.configured.mockReturnValue(false);
    expect(await new SeoService().page()).toEqual({ total: 0, items: [] });
    expect(await new SeoService().paths("journal", item.id)).toEqual({});
    expect(await new SeoService().feed("en")).toEqual([]);
    expect(mocks.publicClient).not.toHaveBeenCalled();
  });
  it("propagates database errors and rejects unsafe or malformed projections", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("missing migration") });
    await expect(new SeoService().page()).rejects.toThrow("missing migration");
    for (const href of ["//external.example/path", "/\\external.example/path", "https://external.example/path"]) {
      mocks.rpc.mockResolvedValueOnce({ data: { total: 1, items: [{ ...item, translations: [{ locale: "en", href }] }] }, error: null });
      await expect(new SeoService().page()).rejects.toThrow();
    }
    mocks.rpc.mockResolvedValueOnce({ data: [{ id: item.id, title: "T", summary: "S", href: "/en/journal/water", publishedAt: null }], error: null });
    await expect(new SeoService().feed("en")).rejects.toThrow();
  });
});
