import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), save: vi.fn(), path: vi.fn(), invalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path }));
vi.mock("@/lib/i18n/revalidation", () => ({ invalidatePublicContent: mocks.invalidate }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/site-content.service", () => ({ SiteContentService: class { save = mocks.save; } }));
import { saveSiteContent } from "./site-content.actions";
const input = { kind: "section", key: "hero", version: 0, data: { enabled: true, sort_order: 1, display_limit: 3, titles: { kk: "Ғылым" } } };
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access: { userId: "actor" } }); mocks.save.mockResolvedValue(1); });
it("rejects unauthenticated and malformed direct calls before the service", async () => {
  mocks.access.mockResolvedValueOnce({ state: "unauthenticated" }); expect(await saveSiteContent(input)).toEqual({ error: "forbidden" });
  expect(await saveSiteContent({ ...input, actor: "forged" })).toEqual({ error: "invalid_input" });
  expect(await saveSiteContent({ ...input, version: -1 })).toEqual({ error: "invalid_input" });
  expect(await saveSiteContent({ kind: "setting", key: "secret", version: 0, data: { value: "bad" } })).toEqual({ error: "invalid_input" });
  expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.invalidate).not.toHaveBeenCalled();
});
it("invalidates the public graph and all localized layouts after a successful write", async () => {
  expect(await saveSiteContent(input)).toEqual({ version: 1 });
  expect(mocks.save).toHaveBeenCalledWith({ userId: "actor" }, input);
  expect(mocks.invalidate).toHaveBeenCalledOnce();
  for (const locale of ["ru", "kk", "en"]) expect(mocks.path).toHaveBeenCalledWith(`/${locale}`, "layout");
  expect(mocks.path).toHaveBeenCalledWith("/admin/content/pages");
});
it("returns safe errors and leaves the cache intact on denied, stale and unexpected failures", async () => {
  for (const message of ["stale_version", "forbidden"]) {
    mocks.save.mockRejectedValueOnce({ message }); expect(await saveSiteContent(input)).toEqual({ error: message });
  }
  mocks.save.mockRejectedValueOnce(new Error("secret database connection details"));
  expect(await saveSiteContent(input)).toEqual({ error: "save_failed" }); expect(mocks.path).not.toHaveBeenCalled();
});
