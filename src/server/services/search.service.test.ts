import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessContext } from "@/types/domain/auth";

const mocks = vi.hoisted(() => ({ configured: vi.fn(), rpc: vi.fn(), client: vi.fn(), publicClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
vi.mock("@/lib/supabase/public", () => ({ createPublicSupabaseClient: mocks.publicClient }));
import { SearchService } from "./search.service";

const access: AccessContext = { userId: "00000000-0000-4000-a000-000000000001", roles: new Set(), permissions: new Set(["admin.access"]) };
const result = { total: 1, page: 2, pageSize: 12, items: [{ id: access.userId, locale: "en", section: "journal", title: "Water", summary: "Research", href: "/en/journal/water" }] };
beforeEach(() => {
  vi.clearAllMocks(); mocks.configured.mockReturnValue(true);
  mocks.publicClient.mockReturnValue({ rpc: mocks.rpc }); mocks.client.mockResolvedValue({ rpc: mocks.rpc }); mocks.rpc.mockResolvedValue({ data: result, error: null });
});
describe("global search service", () => {
  it("uses the anonymous client and typed public RPC with the route locale and page", async () => {
    expect(await new SearchService().publicPage("en", "water", "journal", 2)).toEqual(result);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.publicClient).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("search_public", { p_locale: "en", p_query: "water", p_section: "journal", p_filters: {}, p_page: 2, p_page_size: 12 });
  });
  it("rejects admin access before making a query and uses the protected admin RPC for authorized sessions", async () => {
    await expect(new SearchService().adminPage({ ...access, permissions: new Set() }, "water")).rejects.toThrow("forbidden");
    expect(mocks.client).not.toHaveBeenCalled();
    await new SearchService().adminPage(access, "water", "journal", 2);
    expect(mocks.rpc).toHaveBeenCalledWith("search_admin", { p_query: "water", p_section: "journal", p_page: 2, p_page_size: 20 });
  });
  it("renders setup and empty-search states without reading data", async () => {
    mocks.configured.mockReturnValue(false);
    expect((await new SearchService().publicPage("ru", "water")).total).toBe(0);
    expect((await new SearchService().adminPage(access, "")).total).toBe(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects malformed database results and preserves RPC errors", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ...result, items: [{ ...result.items[0], href: "//external.example/path" }] }, error: null });
    await expect(new SearchService().publicPage("en", "water")).rejects.toThrow();
    mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("database unavailable") });
    await expect(new SearchService().publicPage("en", "water")).rejects.toThrow("database unavailable");
  });
});
