import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ forward: vi.fn(), reverse: vi.fn() }));
vi.mock("@/server/services/article-relations.service", () => ({ ArticleRelationsService: class { publicRelations = mocks.forward; relatedArticles = mocks.reverse; } }));
import { PublicArticleRelations, RelatedArticles } from "./PublicArticleRelations";
beforeEach(() => vi.clearAllMocks());
describe("public relationship sections", () => {
  it("renders localized target kinds and roles with safe text", async () => {
    mocks.forward.mockResolvedValue([{ kind: "scientist", entityId: "scientist", title: "<script>Unsafe name</script>", href: "/scientists/kk/person", relationType: "expert" }]);
    const html = renderToStaticMarkup(await PublicArticleRelations({ id: "article", locale: "kk" }));
    expect(html).toContain("Ғалым · Сарапшы"); expect(html).toContain('href="/scientists/kk/person"');
    expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>");
    expect(mocks.forward).toHaveBeenCalledWith("article", "kk");
  });
  it("renders reverse journal links and keeps editorial roles visible", async () => {
    mocks.reverse.mockResolvedValue([{ id: "article", title: "An interview", href: "/journal/ru/interview", excerpt: "<b>Regional science</b>", relationType: "subject" }]);
    const html = renderToStaticMarkup(await RelatedArticles({ kind: "publication", id: "paper", locale: "ru" }));
    expect(html).toContain("Материалы журнала"); expect(html).toContain("Предмет материала");
    expect(html).toContain('href="/journal/ru/interview"'); expect(html).not.toContain("<b>");
    expect(mocks.reverse).toHaveBeenCalledWith("publication", "paper", "ru");
  });
  it("omits empty sections", async () => {
    mocks.forward.mockResolvedValue([]); mocks.reverse.mockResolvedValue([]);
    expect(await PublicArticleRelations({ id: "article", locale: "ru" })).toBeNull();
    expect(await RelatedArticles({ kind: "event", id: "event", locale: "kk" })).toBeNull();
  });
});
