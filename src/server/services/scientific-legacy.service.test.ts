import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ configured: vi.fn(), sessionClient: vi.fn(), publicClient: vi.fn(), user: vi.fn(), rpc: vi.fn(), publicRpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.sessionClient }));
vi.mock("@/lib/supabase/public", () => ({ createPublicSupabaseClient: mocks.publicClient }));
import { ScientificLegacyService } from "./scientific-legacy.service";
const service = new ScientificLegacyService();
const id = "00000000-0000-4000-a000-000000000001";
const user = { id, email: "own@example.org", email_confirmed_at: "2026-10-17", is_anonymous: false, user_metadata: { role: "super_admin" } };
const input = { id: null, version: null, kind: "topic", status: "draft", translations: ["ru", "kk"].map(locale => ({ locale, title: "Research topic", description: "Description of a scientific topic." })), sourceText: "SECRET", sourceUrl: "", rightsConfirmed: true };
const page = { total: 0, page: 1, pageSize: 20, items: [] };
beforeEach(() => {
  vi.clearAllMocks(); mocks.configured.mockReturnValue(true); mocks.user.mockResolvedValue({ data: { user }, error: null });
  mocks.sessionClient.mockResolvedValue({ auth: { getUser: mocks.user }, rpc: mocks.rpc }); mocks.publicClient.mockReturnValue({ rpc: mocks.publicRpc });
  mocks.rpc.mockResolvedValue({ data: page, error: null }); mocks.publicRpc.mockResolvedValue({ data: page, error: null });
});
it("uses only the fresh anonymous client for public reads", async () => {
  expect(await service.public("kk", 1, id, "archive")).toEqual(page);
  expect(mocks.publicRpc).toHaveBeenCalledExactlyOnceWith("list_scientific_legacy", { p_locale: "kk", p_page: 1, p_id: id, p_own: false, p_kind: "archive" });
  expect(mocks.sessionClient).not.toHaveBeenCalled(); expect(mocks.user).not.toHaveBeenCalled();
});
it("checks live auth for every owner read and mutation without forwarding identity", async () => {
  await service.own("ru", 2, id); expect(mocks.rpc).toHaveBeenLastCalledWith("list_scientific_legacy", { p_locale: "ru", p_page: 2, p_id: id, p_own: true, p_kind: "all" });
  mocks.rpc.mockResolvedValueOnce({ data: id, error: null }); expect(await service.save(input)).toBe(id);
  expect(mocks.rpc).toHaveBeenLastCalledWith("save_scientific_legacy", { p_input: input });
  await service.consent(id, 1, false); expect(mocks.rpc).toHaveBeenLastCalledWith("set_scientific_legacy_consent", { p_id: id, p_version: 1, p_granted: false });
  expect(mocks.user).toHaveBeenCalledTimes(3); expect(mocks.publicClient).not.toHaveBeenCalled();
});
it("rejects anonymous, expired and unconfirmed sessions on owner reads and both mutations", async () => {
  for (const result of [{ data: { user: null } }, { data: { user: { ...user, is_anonymous: true } } }, { data: { user: { ...user, email_confirmed_at: null } } }, { data: { user: { ...user, email: null } } }, { data: { user }, error: { message: "Auth secret" } }]) {
    mocks.user.mockResolvedValue(result);
    await expect(service.own("ru")).rejects.toThrow("session"); await expect(service.save(input)).rejects.toThrow("session"); await expect(service.consent(id, 1, true)).rejects.toThrow("session");
  }
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("validates inputs before any client access", async () => {
  // @ts-expect-error invalid runtime locale
  await expect(service.public("de")).rejects.toThrow("invalid");
  await expect(service.own("ru", 0)).rejects.toThrow("invalid"); await expect(service.public("ru", 1, "invalid")).rejects.toThrow("invalid"); await expect(service.public("ru", 1, null, "invalid")).rejects.toThrow("invalid");
  await expect(service.save({ ...input, owner_id: id })).rejects.toThrow("invalid"); await expect(service.consent(id, 0, true)).rejects.toThrow("invalid");
  expect(mocks.sessionClient).not.toHaveBeenCalled(); expect(mocks.publicClient).not.toHaveBeenCalled();
});
it("handles missing setup and invalid database responses", async () => {
  mocks.configured.mockReturnValue(false); expect(await service.public("en")).toEqual(page); await expect(service.own("en")).rejects.toThrow("setup");
  mocks.configured.mockReturnValue(true); mocks.publicRpc.mockResolvedValueOnce({ data: { secret: "invalid" }, error: null }); await expect(service.public("en")).rejects.toThrow();
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "stale_version" } }); await expect(service.consent(id, 1, true)).rejects.toEqual({ message: "stale_version" });
});
