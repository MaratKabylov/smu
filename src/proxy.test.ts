import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), configured: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.client }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured, getPublicSupabaseEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.org", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "public-key" }) }));
import { proxy } from "./proxy";

describe("public redirects and session proxy", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.configured.mockReturnValue(true); mocks.client.mockReturnValue({ auth: { getUser: mocks.user } }); });
  it("permanently redirects legacy links before touching the session", async () => {
    const result = await proxy(new NextRequest("https://example.org/journal/kk/story?lang=ru&q=test"));
    expect(result.status).toBe(308);
    expect(result.headers.get("location")).toBe("https://example.org/kk/journal/story?q=test");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(["/admin/login", "/ru/journal", "/kk/mentorship/offer"])("continues session refresh on %s", async path => {
    const result = await proxy(new NextRequest(`https://example.org${path}`));
    expect(result.headers.get("location")).toBeNull(); expect(mocks.user).toHaveBeenCalledOnce();
  });
  it("preserves session cookies after locale routing", async () => {
    mocks.client.mockImplementationOnce((_url, _key, options) => {
      options.cookies.setAll([{ name: "session", value: "refreshed", options: { httpOnly: true } }]);
      return { auth: { getUser: mocks.user } };
    });
    const result = await proxy(new NextRequest("https://example.org/kk/events"));
    expect(result.cookies.get("session")?.value).toBe("refreshed");
  });
  it("works without Supabase configuration", async () => {
    mocks.configured.mockReturnValue(false);
    expect((await proxy(new NextRequest("https://example.org/scientists?lang=kk"))).status).toBe(308);
    expect((await proxy(new NextRequest("https://example.org/kk/scientists"))).status).toBe(200);
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
