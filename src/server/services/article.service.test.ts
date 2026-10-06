import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  client: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), status: vi.fn(), assign: vi.fn(),
  configure: vi.fn(), submitReview: vi.fn(), listReviews: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
vi.mock("@/server/repositories/article.repository", () => ({ ArticleRepository: class {
  getById = mocks.get; create = mocks.create; update = mocks.update;
  changeStatus = mocks.status; assignReviewer = mocks.assign;
  configureReview = mocks.configure; submitReview = mocks.submitReview; listReviews = mocks.listReviews;
} }));
import { ArticleService } from "./article.service";
import type { AccessContext, PermissionCode } from "@/types/domain/auth";
import type { ArticleInput } from "@/lib/validation/article";

const access = (permissions: PermissionCode[], userId = "user"): AccessContext => ({ userId, roles: new Set(), permissions: new Set(permissions) });
const article = { id: "id", authorId: "author", scientificReviewerId: "assigned", requiresScientificReview: false, contentVersion: 1, status: "published", deletedAt: null };
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue(article); });
describe("article service authorization", () => {
  it("denies author directory writes and profile listings before constructing a client", async () => {
    await expect(new ArticleService().saveAuthor(access(["articles.create"]), null, {} as never)).rejects.toMatchObject({ code: "forbidden" });
    await expect(new ArticleService().updateTaxonomyItem(access(["articles.review"]), {} as never)).rejects.toMatchObject({ code: "forbidden" });
    await expect(new ArticleService().listAuthorProfiles(access(["articles.edit_own"]))).rejects.toMatchObject({ code: "forbidden" });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("rejects missing and stale edit versions before writing", async () => {
    for (const input of [{}, { expectedVersion: 2 }]) await expect(new ArticleService().update(access(["articles.edit_any"]), "id", input as ArticleInput)).rejects.toMatchObject({ code: "stale_version" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("restricts preview to authors, editorial staff and assigned reviewers", async () => {
    mocks.get.mockResolvedValue({ ...article, status: "draft" });
    expect(await new ArticleService().getPreview(access(["articles.review"], "other"), "id")).toBeNull();
    expect(await new ArticleService().getPreview(access(["articles.edit_own"], "author"), "id")).toMatchObject({ id: "id" });
    expect(await new ArticleService().getPreview(access(["articles.review"], "assigned"), "id")).toMatchObject({ id: "id" });
    expect(await new ArticleService().getPreview(access(["articles.publish"]), "id")).toMatchObject({ id: "id" });
    mocks.get.mockResolvedValue(article);
    expect(await new ArticleService().getPreview(access(["admin.access"]), "id")).toBeNull();
  });
  it("rejects a repeated published status from a non-editorial manager", async () => {
    await expect(new ArticleService().changeStatus(access(["admin.access", "scientists.edit"]), "id", "published")).rejects.toMatchObject({ code: "invalid_transition" });
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it("also rejects a publisher's repeated request", async () => {
    await expect(new ArticleService().changeStatus(access(["articles.publish"]), "id", "published")).rejects.toMatchObject({ code: "invalid_transition" });
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it("rejects creation before constructing a client when permission is missing", async () => {
    await expect(new ArticleService().create(access([]), {} as ArticleInput)).rejects.toMatchObject({ code: "forbidden" });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("restricts review to the assigned reviewer", async () => {
    mocks.get.mockResolvedValue({ ...article, status: "in_review" });
    await expect(new ArticleService().changeStatus(access(["articles.review"], "other"), "id", "approved")).rejects.toMatchObject({ code: "invalid_transition" });
    expect(mocks.status).not.toHaveBeenCalled();
    await new ArticleService().submitReview(access(["articles.review"], "assigned"), "id", 1, { decision: "approved", comment: "Accurate results." });
    expect(mocks.submitReview).toHaveBeenCalledWith("id", 1, "approved", "Accurate results.");
  });
  it("allows editorial review and explicit unpublish with separate permissions", async () => {
    mocks.get.mockResolvedValue({ ...article, status: "in_review" });
    await new ArticleService().submitReview(access(["articles.review", "articles.edit_any"]), "id", 1, { decision: "approved", comment: "Editorial review complete." });
    mocks.get.mockResolvedValue(article);
    await new ArticleService().changeStatus(access(["articles.publish"]), "id", "draft");
    expect(mocks.status).toHaveBeenLastCalledWith("id", "draft", 1);
  });
  it("does not let an author update a published article", async () => {
    await expect(new ArticleService().update(access(["articles.edit_own"], "author"), "id", {} as ArticleInput)).rejects.toMatchObject({ code: "forbidden" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("performs an editor's update through the single transactional repository method", async () => {
    await new ArticleService().update(access(["articles.edit_any"]), "id", { expectedVersion: 1 } as ArticleInput);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it("surfaces database authorization and slug failures", async () => {
    mocks.update.mockRejectedValueOnce({ message: "forbidden" });
    await expect(new ArticleService().update(access(["articles.edit_any"]), "id", { expectedVersion: 1 } as ArticleInput)).rejects.toMatchObject({ code: "forbidden" });
    mocks.update.mockRejectedValueOnce({ code: "23505", message: "duplicate key" });
    await expect(new ArticleService().update(access(["articles.edit_any"]), "id", { expectedVersion: 1 } as ArticleInput)).rejects.toMatchObject({ code: "slug_conflict" });
  });
  it("rejects review of a newer version than the reviewer opened", async () => {
    mocks.get.mockResolvedValue({ ...article, status: "in_review", contentVersion: 2 });
    await expect(new ArticleService().submitReview(access(["articles.review"], "assigned"), "id", 1, { decision: "approved", comment: "Old review." })).rejects.toMatchObject({ code: "stale_version" });
    expect(mocks.submitReview).not.toHaveBeenCalled();
  });
  it("requires the assigned reviewer for mandatory scientific review", async () => {
    mocks.get.mockResolvedValue({ ...article, status: "in_review", requiresScientificReview: true });
    await expect(new ArticleService().submitReview(access(["articles.review", "articles.edit_any"], "editor"), "id", 1, { decision: "approved", comment: "Editorial approval." })).rejects.toMatchObject({ code: "forbidden" });
    await new ArticleService().submitReview(access(["articles.review"], "assigned"), "id", 1, { decision: "changes_requested", comment: "Clarify the method." });
    expect(mocks.submitReview).toHaveBeenCalledWith("id", 1, "changes_requested", "Clarify the method.");
  });
  it("does not send a mandatory review without an assigned reviewer", async () => {
    mocks.get.mockResolvedValue({ ...article, status: "draft", requiresScientificReview: true, scientificReviewerId: null });
    await expect(new ArticleService().changeStatus(access(["articles.edit_own"], "author"), "id", "in_review", 1)).rejects.toMatchObject({ code: "invalid_transition" });
    expect(mocks.status).not.toHaveBeenCalled();
  });
});
