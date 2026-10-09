import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), cookies: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.create }));
vi.mock("@/lib/env", () => ({ getPublicSupabaseEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://public.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable" }) }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
import { createPublicSupabaseClient } from "./public";
import { createPublicFetch, publicContentTag, publicCacheSeconds } from "./public-cache";
const origin = "https://public.supabase.co";
const anonymous = { Authorization: "Bearer publishable", apikey: "publishable" };
const publicFetch = createPublicFetch(origin, "publishable");
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", mocks.fetch); mocks.fetch.mockResolvedValue(new Response("[]")); });
afterEach(() => vi.unstubAllGlobals());

describe("anonymous public Supabase cache", () => {
  it("uses only the public key and disables session persistence and refresh", () => {
    createPublicSupabaseClient();
    expect(mocks.create).toHaveBeenCalledWith(origin, "publishable", expect.objectContaining({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }));
    expect(mocks.cookies).not.toHaveBeenCalled();
  });
  it("creates independent instances without a cookie adapter", () => {
    createPublicSupabaseClient(); createPublicSupabaseClient();
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[0][2]).not.toHaveProperty("cookies");
  });
  it.each(["search_public", "seo_public_page", "seo_public_feed", "public_article_relations", "public_related_articles", "list_public_publications", "list_public_work_publications"])("caches the read-only %s POST including its body", async rpc => {
    createPublicSupabaseClient();
    const init = { method: "POST", headers: anonymous, body: '{"p_locale":"kk","p_page":2}', cache: "no-store" };
    const url = origin + "/rest/v1/rpc/" + rpc;
    await mocks.create.mock.calls[0][2].global.fetch(url, init);
    expect(mocks.fetch).toHaveBeenCalledWith(url, { ...init, cache: "force-cache", next: { revalidate: publicCacheSeconds, tags: [publicContentTag] } });
  });
  it("keeps locale, filters, pagination and projections in GET cache keys", async () => {
    const url = origin + "/rest/v1/article_translations?locale=eq.en&slug=eq.water&select=title";
    await publicFetch(new URL(url), { headers: anonymous });
    expect(mocks.fetch).toHaveBeenCalledWith(new URL(url), expect.objectContaining({ cache: "force-cache", next: { revalidate: 60, tags: [publicContentTag] } }));
  });
  it.each([
    ["/rest/v1/articles", "POST", anonymous],
    ["/rest/v1/articles", "PATCH", anonymous],
    ["/rest/v1/articles", "DELETE", anonymous],
    ["/rest/v1/rpc/save_article", "POST", anonymous],
    ["/rest/v1/rpc/search_admin", "POST", anonymous],
    ["/rest/v1/rpc/unknown_function", "GET", anonymous],
    ["/auth/v1/user", "GET", anonymous],
    ["/storage/v1/object/article-media/photo.png", "GET", anonymous],
    ["/rest/v1/articles", "GET", { Authorization: "Bearer admin-token" }],
    ["/rest/v1/articles", "GET", { Cookie: "session=private" }],
  ])("excludes %s %s and session-bearing requests even with caller cache options", async (path, method, headers) => {
    await publicFetch(origin + path, { method, headers, cache: "force-cache", next: { tags: ["private"], revalidate: 3600 } });
    expect(mocks.fetch.mock.calls[0][1]).toMatchObject({ cache: "no-store", next: { revalidate: 0 } });
  });
  it("never caches another origin and checks Request headers as well as init", async () => {
    await publicFetch("https://other.example/rest/v1/articles", { headers: anonymous });
    expect(mocks.fetch.mock.calls[0][1].cache).toBe("no-store");
    await publicFetch(new Request(origin + "/rest/v1/articles", { headers: { Authorization: "Bearer service-role" } }));
    expect(mocks.fetch.mock.calls[1][1].cache).toBe("no-store");
    await publicFetch(new Request(origin + "/rest/v1/rpc/save_article", { method: "POST", headers: anonymous, body: "{}" }));
    expect(mocks.fetch.mock.calls[2][1].cache).toBe("no-store");
  });
  it("propagates network failures instead of manufacturing a cacheable empty result", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("offline"));
    await expect(publicFetch(origin + "/rest/v1/articles")).rejects.toThrow("offline");
  });
});
