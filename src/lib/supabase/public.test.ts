import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), cookies: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.create }));
vi.mock("@/lib/env", () => ({ getPublicSupabaseEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://public.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable" }) }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
import { createPublicSupabaseClient } from "./public";
beforeEach(() => { vi.clearAllMocks(); });
describe("anonymous public Supabase client", () => {
  it("uses only the public key and disables session persistence and refresh", () => {
    createPublicSupabaseClient();
    expect(mocks.create).toHaveBeenCalledWith("https://public.supabase.co", "publishable", expect.objectContaining({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }));
    expect(mocks.cookies).not.toHaveBeenCalled();
  });
  it("creates independent instances and never supplies a cookie adapter", () => {
    createPublicSupabaseClient(); createPublicSupabaseClient();
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[0][2]).not.toHaveProperty("cookies");
  });
  it("explicitly reads current visibility without freezing a Supabase fetch", async () => {
    vi.stubGlobal("fetch", mocks.fetch);
    try {
      createPublicSupabaseClient();
      await mocks.create.mock.calls[0][2].global.fetch("https://public.supabase.co/rest/v1/rpc/seo_public_page", { method: "POST", headers: { Authorization: "Bearer publishable" }, body: "{}", cache: "force-cache" });
      expect(mocks.fetch).toHaveBeenCalledWith("https://public.supabase.co/rest/v1/rpc/seo_public_page", { method: "POST", headers: { Authorization: "Bearer publishable" }, body: "{}", cache: "no-store" });
    } finally { vi.unstubAllGlobals(); }
  });
});
