import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { plainTextDocument } from "@/lib/articles/rich-text";
import type { Article, ArticleRevision } from "@/types/domain/article";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ access: vi.fn(), article: vi.fn(), list: vi.fn(), revision: vi.fn(), taxonomy: vi.fn(), images: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("not_found"); }, redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/article.service", () => ({ ArticleService: class { getById = mocks.article; } }));
vi.mock("@/server/repositories/article.repository", () => ({ ArticleRepository: class { listTaxonomy = mocks.taxonomy; } }));
vi.mock("@/server/repositories/article-images.repository", () => ({ getArticleImages: mocks.images }));
vi.mock("@/server/actions/article-revision.actions", () => ({ createArticleRevision: vi.fn(), restoreArticleRevision: vi.fn() }));
vi.mock("@/server/services/article-revision.service", async importOriginal => ({
  ...await importOriginal<object>(), ArticleRevisionService: class { list = mocks.list; get = mocks.revision; },
}));
import Page from "@/app/admin/(panel)/content/articles/[id]/revisions/page";

const id = "00000000-0000-4000-a000-000000000002";
const revisionId = "00000000-0000-4000-a000-000000000003";
const category = "00000000-0000-4000-a000-000000000004";
const translation = { title: "Старая версия <script>", slug: "article", excerpt: "Описание исследования", body: "Текст исследования и результаты.", contentJson: plainTextDocument("Текст исследования и результаты."), seoTitle: null, seoDescription: null };
const article: Article = {
  id, authorId: "author", scientificReviewerId: "reviewer", contentVersion: 3, approvedVersion: null,
  authorName: "Автор", categoryId: category, category: null, coverMediaId: null, contentType: "article",
  status: "draft", publishedAt: null, createdAt: "2026-10-04T12:00:00Z", updatedAt: "2026-10-04T12:00:00Z", deletedAt: null,
  translations: [
    { ...translation, id: "ru", locale: "ru", title: "Новая версия" },
    { ...translation, id: "kk", locale: "kk", title: "Қазақша қазіргі тақырып" },
  ], tags: [],
};
const revision: ArticleRevision = {
  id: revisionId, articleId: id, revisionNumber: 1, contentVersion: 1, reason: "manual",
  titleRu: translation.title, titleKk: "Қазақша тарихи тақырып", createdBy: "author", createdByName: "Автор",
  createdAt: "2026-10-04T12:00:00Z",
  snapshot: { contentType: "article", categoryId: category, coverMediaId: null, tagIds: [],
    ru: translation, kk: { ...translation, title: "Қазақша тарихи тақырып" } },
};
function page(query: Record<string, string | undefined> = {}) { return Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve(query) }); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ state: "allowed", access: { userId: "editor", roles: new Set(), permissions: new Set(["admin.access", "articles.edit_any"]) } });
  mocks.article.mockResolvedValue(article); mocks.list.mockResolvedValue({ revisions: [revision], total: 21 });
  mocks.revision.mockResolvedValue(revision); mocks.images.mockResolvedValue([]);
  mocks.taxonomy.mockResolvedValue({ categories: [{ id: category, nameRu: "Исследования", nameKk: "Зерттеулер" }], tags: [] });
});
describe("article revision page", () => {
  it("shows safe comparison, meaningful taxonomy labels, pagination and explicit restore confirmation", async () => {
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Старая версия &lt;script&gt;"); expect(html).not.toContain("Старая версия <script>");
    expect(html).toContain("Новая версия"); expect(html).toContain("Изменено");
    expect(html).toContain("Исследования"); expect(html).not.toContain(category);
    expect(html).toContain("Следующая страница"); expect(html).toContain("Подтверждаю восстановление обеих языковых версий");
    expect(html).toContain('name="confirm"'); expect(html).toContain("Создать версию");
  });
  it("switches comparison and preview to KK", async () => {
    const html = renderToStaticMarkup(await page({ locale: "kk" }));
    expect(html).toContain('lang="kk"'); expect(html).toContain("Қазақша тарихи тақырып");
    expect(html).toContain("Қазақша қазіргі тақырып"); expect(html).toContain("Зерттеулер");
  });
  it("lets assigned reviewers read history without mutation controls", async () => {
    mocks.access.mockResolvedValue({ state: "allowed", access: { userId: "reviewer", permissions: new Set(["admin.access", "articles.review"]) } });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Сохранённые версии"); expect(html).not.toContain("Создать версию");
    expect(html).not.toContain('name="confirm"');
  });
  it("rejects malformed queries and unrelated revision IDs instead of falling back", async () => {
    for (const query of [{ revision: "bad" }, { locale: "en" }, { page: "0" }]) await expect(page(query)).rejects.toThrow("not_found");
    expect(mocks.access).not.toHaveBeenCalled();
    mocks.revision.mockResolvedValueOnce(null);
    await expect(page({ revision: revisionId })).rejects.toThrow("not_found");
    expect(mocks.revision).toHaveBeenCalledWith(expect.anything(), id, revisionId);
  });
  it("requires login and refuses an unrelated user before reading revision data", async () => {
    mocks.access.mockResolvedValueOnce({ state: "unauthenticated" });
    await expect(page()).rejects.toThrow("redirect:/admin/login");
    mocks.access.mockResolvedValueOnce({ state: "allowed", access: { userId: "other", permissions: new Set(["admin.access", "articles.edit_own"]) } });
    await expect(page()).rejects.toThrow("not_found");
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.revision).not.toHaveBeenCalled();
  });
  it("compares two saved revisions and handles empty history", async () => {
    const otherId = "00000000-0000-4000-a000-000000000005";
    mocks.revision.mockResolvedValueOnce(revision).mockResolvedValueOnce({ ...revision, id: otherId, revisionNumber: 2 });
    const html = renderToStaticMarkup(await page({ compare: otherId }));
    expect(html).toContain("версия №2"); expect(html).toContain("Содержимое совпадает.");
    mocks.list.mockResolvedValue({ revisions: [], total: 0 });
    const empty = renderToStaticMarkup(await page());
    expect(empty).toContain("пока нет сохранённых версий"); expect(empty).not.toContain('name="confirm"');
  });
  it("handles older articles with an incomplete translation without offering unsafe restore", async () => {
    mocks.article.mockResolvedValue({ ...article, translations: article.translations.filter(item => item.locale === "ru") });
    const html = renderToStaticMarkup(await page({ locale: "kk" }));
    expect(html).toContain("сначала заполните и сохраните обе языковые версии");
    expect(html).not.toContain('name="confirm"'); expect(html).not.toContain("Создать версию");
  });
});
