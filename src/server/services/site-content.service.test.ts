import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
const mocks = vi.hoisted(() => ({ session: vi.fn(), anonymous: vi.fn(), rpc: vi.fn(), configured: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.session }));
vi.mock("@/lib/supabase/public", () => ({ createPublicSupabaseClient: mocks.anonymous }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured }));
import { getPublicSiteContent, SiteContentService } from "./site-content.service";
import type { AccessContext } from "@/types/domain/auth";

const manager: AccessContext = { userId: "actor", roles: new Set(["content_manager"]), permissions: new Set(["admin.access", "content.manage"]) };
const input = { kind: "section", key: "hero", version: 0, data: { enabled: true, sort_order: 1, display_limit: 3, titles: { ru: "Welcome" } } } as const;
const publicData = { page: null, sections: [], settings: { site_name: "SMU", contact_email: "", social_links: [] } };
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockResolvedValue({ rpc: mocks.rpc }); mocks.anonymous.mockReturnValue({ rpc: mocks.rpc });
  mocks.configured.mockReturnValue(true); mocks.rpc.mockResolvedValue({ data: { pages: [], sections: [], settings: [] }, error: null });
});
it("rejects missing permissions before opening the session client", async () => {
  const service = new SiteContentService();
  for (const permissions of [new Set(["content.manage"]), new Set(["admin.access"]), new Set<string>()]) {
    const actor = { ...manager, permissions } as AccessContext;
    await expect(service.list(actor)).rejects.toThrow("forbidden");
    await expect(service.save(actor, input)).rejects.toThrow("forbidden");
  }
  await expect(service.save(manager, { kind: "setting", key: "site_name", version: 0, data: { value: "SMU" } })).rejects.toThrow("forbidden");
  expect(mocks.session).not.toHaveBeenCalled();
});
it("validates writes and performs exactly one session-bound versioned RPC", async () => {
  mocks.rpc.mockResolvedValue({ data: 1, error: null });
  expect(await new SiteContentService().save(manager, input)).toBe(1);
  expect(mocks.rpc).toHaveBeenCalledWith("save_site_content", { p_kind: "section", p_key: "hero", p_expected_version: 0, p_data: input.data });
  await expect(new SiteContentService().save(manager, { ...input, data: { ...input.data, display_limit: 99 } })).rejects.toThrow();
  expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.anonymous).not.toHaveBeenCalled();
});
it("uses the anonymous client for public configuration without reading session state", async () => {
  mocks.rpc.mockResolvedValue({ data: publicData, error: null });
  expect(await getPublicSiteContent("kk", "about")).toEqual(publicData);
  expect(mocks.rpc).toHaveBeenCalledWith("read_public_site_content", { p_locale: "kk", p_page_key: "about" });
  expect(mocks.session).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValueOnce({ data: { settings: {} }, error: null });
  await expect(getPublicSiteContent("ru")).rejects.toThrow();
});
it("returns an explicit unconfigured fallback but propagates configured database failures", async () => {
  mocks.configured.mockReturnValue(false);
  expect((await getPublicSiteContent("en")).page).toBeNull(); expect(mocks.anonymous).not.toHaveBeenCalled();
  mocks.configured.mockReturnValue(true); mocks.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
  await expect(getPublicSiteContent("ru")).rejects.toEqual({ message: "offline" });
});
