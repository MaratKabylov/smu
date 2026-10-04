import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), article: vi.fn(), list: vi.fn(), get: vi.fn(), create: vi.fn(), restore: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
vi.mock("@/server/repositories/article.repository", () => ({ ArticleRepository: class { getById = mocks.article; } }));
vi.mock("@/server/repositories/article-revision.repository", () => ({ ArticleRevisionRepository: class {
  list = mocks.list; get = mocks.get; create = mocks.create; restore = mocks.restore;
} }));
import { ArticleRevisionService } from "./article-revision.service";
import type { AccessContext, PermissionCode } from "@/types/domain/auth";

const access = (permissions: PermissionCode[], userId = "editor"): AccessContext => ({ userId, roles: new Set(), permissions: new Set(["admin.access", ...permissions]) });
const article = { id: "article", authorId: "author", scientificReviewerId: "reviewer", contentVersion: 3, deletedAt: null, status: "draft" };
beforeEach(() => { vi.clearAllMocks(); mocks.article.mockResolvedValue(article); });

describe("article revision service", () => {
  it("requires admin access before opening a client", async () => {
    await expect(new ArticleRevisionService().list({ ...access([]), permissions: new Set() }, "article")).rejects.toMatchObject({ code: "forbidden" });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("denies history reads of deleted/missing records and unrelated published articles", async () => {
    mocks.article.mockResolvedValueOnce(null).mockResolvedValueOnce({ ...article, deletedAt: "date" });
    for (let i = 0; i < 2; i++) await expect(new ArticleRevisionService().list(access(["articles.edit_any"]), "article")).rejects.toMatchObject({ code: "not_found" });
    mocks.article.mockResolvedValue({ ...article, status: "published" });
    await expect(new ArticleRevisionService().get(access(["articles.edit_own"], "other"), "article", "revision")).rejects.toMatchObject({ code: "forbidden" });
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.get).not.toHaveBeenCalled();
  });
  it("allows authors, publishers and assigned reviewers to read but scopes every lookup to the article", async () => {
    for (const reader of [access(["articles.edit_own"], "author"), access(["articles.publish"]), access(["articles.review"], "reviewer")]) {
      await new ArticleRevisionService().get(reader, "article", "revision");
      expect(mocks.get).toHaveBeenLastCalledWith("article", "revision");
    }
    await expect(new ArticleRevisionService().list(access(["articles.review"], "other"), "article")).rejects.toMatchObject({ code: "forbidden" });
  });
  it("rejects a reviewer's restore and an author's restore outside draft", async () => {
    await expect(new ArticleRevisionService().restore(access(["articles.review"], "reviewer"), "article", "revision", 3)).rejects.toMatchObject({ code: "forbidden" });
    mocks.article.mockResolvedValue({ ...article, status: "published" });
    await expect(new ArticleRevisionService().restore(access(["articles.edit_own"], "author"), "article", "revision", 3)).rejects.toMatchObject({ code: "forbidden" });
    mocks.article.mockResolvedValue({ ...article, status: "archived" });
    await expect(new ArticleRevisionService().create(access(["articles.edit_any"]), "article", 3)).rejects.toMatchObject({ code: "forbidden" });
    expect(mocks.restore).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("checks the expected version for both mutations before entering RPC", async () => {
    for (const version of [0, 2, 4, NaN, 3.5]) {
      await expect(new ArticleRevisionService().create(access(["articles.edit_any"]), "article", version)).rejects.toMatchObject({ code: "stale_version" });
      await expect(new ArticleRevisionService().restore(access(["articles.edit_any"]), "article", "revision", version)).rejects.toMatchObject({ code: "stale_version" });
    }
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.restore).not.toHaveBeenCalled();
  });
  it("uses a single transactional restore and surfaces database conflicts", async () => {
    mocks.restore.mockResolvedValueOnce(4);
    expect(await new ArticleRevisionService().restore(access(["articles.edit_any"]), "article", "revision", 3)).toBe(4);
    expect(mocks.restore).toHaveBeenCalledWith("article", "revision", 3);
    mocks.restore.mockRejectedValueOnce({ message: "invalid_reference" });
    await expect(new ArticleRevisionService().restore(access(["articles.edit_any"]), "article", "revision", 3)).rejects.toMatchObject({ code: "invalid_reference" });
    mocks.create.mockRejectedValueOnce({ message: "stale_version" });
    await expect(new ArticleRevisionService().create(access(["articles.edit_any"]), "article", 3)).rejects.toMatchObject({ code: "stale_version" });
  });
  it("validates pagination and forwards a valid page", async () => {
    for (const page of [0, -1, 1.5, Infinity, 100001]) await expect(new ArticleRevisionService().list(access(["articles.edit_any"]), "article", page)).rejects.toMatchObject({ code: "invalid_input" });
    expect(mocks.client).not.toHaveBeenCalled();
    await new ArticleRevisionService().list(access(["articles.edit_any"]), "article", 2);
    expect(mocks.list).toHaveBeenCalledWith("article", 2);
  });
});
