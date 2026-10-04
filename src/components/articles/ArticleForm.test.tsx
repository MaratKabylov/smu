import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Article, ArticleTaxonomy } from "@/types/domain/article";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/server/actions/article.actions", () => ({ saveArticleDraft: vi.fn() }));
vi.mock("./RichTextEditor", () => ({ RichTextEditor: () => null }));
import { ArticleForm } from "./ArticleForm";
const item = (id: string, isActive = true) => ({ id, slug: id, nameRu: `${id} RU`, nameKk: `${id} KK`, isActive });
const person = { id: "person", nameRu: "Сохранённый автор", nameKk: "Автор KK", bioRu: null, bioKk: null, organization: null, position: null, websiteUrl: null, isActive: false };
const taxonomy: ArticleTaxonomy = { categories: [item("chosen", false), item("hidden", false), item("new")], tags: [], contentTypes: [item("report", false), item("hidden-type", false), item("article")], authors: [person] };
const article: Article = { id: "article", authorId: "owner", authorName: "Owner", scientificReviewerId: null, contentVersion: 2, approvedVersion: null, categoryId: "chosen", category: item("chosen", false), categories: [item("chosen", false)], authors: [{ ...person, role: "translator" }], contentType: "report", contentTypeItem: item("report", false), coverMediaId: null, status: "draft", publishedAt: null, createdAt: "2026-10-04", updatedAt: "2026-10-04", deletedAt: null, translations: [], tags: [] };
describe("editor credit selections", () => {
  it("retains selected inactive categories, authors and type without offering unrelated inactive values", () => {
    const html = renderToStaticMarkup(<ArticleForm article={article} taxonomy={taxonomy} media={[]} action={vi.fn()} />);
    expect(html).toContain('name="categoryIds" value="chosen"');
    expect(html).toContain('value="report" selected=""');
    expect(html).toContain("Сохранённый автор"); expect(html).toContain("translator");
    expect(html).not.toContain("hidden RU"); expect(html).not.toContain("hidden-type RU");
    expect(html).not.toContain("Без категории");
  });
  it("offers only active directory selections for a new draft", () => {
    const html = renderToStaticMarkup(<ArticleForm taxonomy={taxonomy} media={[]} action={vi.fn()} />);
    expect(html).toContain("article RU"); expect(html).toContain("new RU");
    expect(html).not.toContain("chosen RU"); expect(html).not.toContain("report RU");
    expect(html).not.toContain("Сохранённый автор"); expect(html).toContain('name="authors" value="[]"');
  });
});
