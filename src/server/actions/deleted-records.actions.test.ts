import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), article: vi.fn(), scientist: vi.fn(), invalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.invalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/article.service", () => ({
  ArticleService: class { restoreDeleted = mocks.article; },
  ArticleServiceError: class extends Error { constructor(public code: string) { super(code); } },
}));
vi.mock("@/server/services/scientist.service", () => ({
  ScientistService: class { restoreDeleted = mocks.scientist; },
  ScientistServiceError: class extends Error { constructor(public code: string) { super(code); } },
}));
import { restoreDeletedRecord } from "./deleted-records.actions";
import { ArticleServiceError } from "@/server/services/article.service";
const id = "00000000-0000-4000-a000-000000000002";
const timestamp = "2026-10-06T12:00:00.123456+00:00";
function form(kind = "article") {
  const data = new FormData();
  data.set("kind", kind); data.set("id", id); data.set("expectedDeletedAt", timestamp); data.set("confirm", "yes");
  return data;
}
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access: { userId: id } }); });
describe("deleted record actions", () => {
  it.each(["article", "scientist"])("restores %s through its service and invalidates all affected pages", async kind => {
    await expect(restoreDeletedRecord(form(kind))).rejects.toThrow(`redirect:/admin/deleted?kind=${kind}&restored=1`);
    expect(kind === "article" ? mocks.article : mocks.scientist).toHaveBeenCalledWith({ userId: id }, id, timestamp);
    expect(kind === "article" ? mocks.scientist : mocks.article).not.toHaveBeenCalled();
    for (const path of ["/journal", "/scientists", "/publications", "/mentorship", "/research-program", "/admin/content/articles", "/admin/science/scientists"]) for (const target of path.startsWith("/admin") ? [path] : [`/ru${path}`, `/kk${path}`]) expect(mocks.invalidate).toHaveBeenCalledWith(target, "layout");
    expect(mocks.invalidate).toHaveBeenCalledWith("/admin/deleted");
  });
  it("rejects invalid kind, id, timestamp or missing confirmation before authenticating", async () => {
    for (const [key, value] of [["kind", "media"], ["id", "bad"], ["expectedDeletedAt", "invalid"], ["confirm", ""]]) {
      const data = form(); data.set(key, value);
      await expect(restoreDeletedRecord(data)).rejects.toThrow("error=validation");
    }
    expect(mocks.access).not.toHaveBeenCalled(); expect(mocks.article).not.toHaveBeenCalled();
  });
  it("requires a current admin session", async () => {
    mocks.access.mockResolvedValueOnce({ state: "unauthenticated" });
    await expect(restoreDeletedRecord(form())).rejects.toThrow("redirect:/admin/login");
    mocks.access.mockResolvedValueOnce({ state: "forbidden" });
    await expect(restoreDeletedRecord(form())).rejects.toThrow("error=forbidden");
    expect(mocks.article).not.toHaveBeenCalled(); expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("preserves safe RPC failure reasons and performs no invalidation on failure", async () => {
    mocks.article.mockRejectedValueOnce(new ArticleServiceError("invalid_reference", "Invalid reference"));
    await expect(restoreDeletedRecord(form())).rejects.toThrow("kind=article&error=invalid_reference");
    mocks.article.mockRejectedValueOnce(new Error("private database error"));
    await expect(restoreDeletedRecord(form())).rejects.toThrow("error=action_failed");
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});
