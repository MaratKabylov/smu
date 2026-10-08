import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ access: vi.fn(), create: vi.fn(), restore: vi.fn(), invalidate: vi.fn(), invalidateTag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.invalidate, revalidateTag: mocks.invalidateTag }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/article-revision.service", () => ({ ArticleRevisionService: class { create = mocks.create; restore = mocks.restore; } }));
import { createArticleRevision, restoreArticleRevision } from "./article-revision.actions";
import { ArticleServiceError } from "@/server/services/article.service";

const id = "00000000-0000-4000-a000-000000000002";
const revision = "00000000-0000-4000-a000-000000000003";
const path = `/admin/content/articles/${id}/revisions`;
function confirmed() { const form = new FormData(); form.set("confirm", "yes"); return form; }
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access: { userId: id } }); mocks.create.mockResolvedValue(revision); });
describe("revision actions", () => {
  it("rejects malformed references and versions before querying access", async () => {
    await expect(createArticleRevision("invalid", 1)).rejects.toThrow("error=validation");
    await expect(createArticleRevision(id, 0)).rejects.toThrow("error=validation");
    await expect(restoreArticleRevision(id, "bad", 3, confirmed())).rejects.toThrow("error=validation");
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("requires confirmation and a current session before restoring", async () => {
    await expect(restoreArticleRevision(id, revision, 3, new FormData())).rejects.toThrow("error=confirm_restore");
    mocks.access.mockResolvedValue({ state: "unauthenticated" });
    await expect(restoreArticleRevision(id, revision, 3, confirmed())).rejects.toThrow("redirect:/admin/login");
    mocks.access.mockResolvedValue({ state: "forbidden" });
    await expect(createArticleRevision(id, 3)).rejects.toThrow("error=forbidden");
    expect(mocks.restore).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("creates a saved version and redirects to it", async () => {
    await expect(createArticleRevision(id, 3)).rejects.toThrow(`redirect:${path}?revision=${revision}&created=1`);
    expect(mocks.create).toHaveBeenCalledWith({ userId: id }, id, 3);
    expect(mocks.invalidate).toHaveBeenCalledWith(path);
  });
  it("refreshes editorial and public routes only after a successful restoration", async () => {
    await expect(restoreArticleRevision(id, revision, 3, confirmed())).rejects.toThrow(`redirect:/admin/content/articles/${id}?restored=1`);
    expect(mocks.restore).toHaveBeenCalledWith({ userId: id }, id, revision, 3);
    expect(mocks.invalidate).toHaveBeenCalledWith("/admin/content/articles", "layout");
    expect(mocks.invalidateTag).toHaveBeenCalledWith("smu:public-content:v1", { expire: 0 });
    for (const locale of ["ru", "kk"]) expect(mocks.invalidate).toHaveBeenCalledWith(`/${locale}/journal`, "layout");
  });
  it("preserves revision selection and skips invalidation on a failed restore", async () => {
    mocks.restore.mockRejectedValue(new ArticleServiceError("stale_version", "Conflict"));
    await expect(restoreArticleRevision(id, revision, 3, confirmed())).rejects.toThrow(`redirect:${path}?revision=${revision}&error=stale_version`);
    expect(mocks.invalidate).not.toHaveBeenCalled(); expect(mocks.invalidateTag).not.toHaveBeenCalled();
  });
});
