import { describe, expect, it, vi } from "vitest";
import type { DatabaseClient } from "@/lib/supabase/database";
vi.mock("server-only", () => ({}));
import { PublicArticleRepository } from "./public-article.repository";
import type { ArticleTaxonomy } from "@/types/domain/article";

type Row = Record<string, unknown>;
type Call = { table: string; operation: string; args: unknown[] };
function clientWith(rows: Record<string, Row[]>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      let result = [...(rows[table] ?? [])];
      const query: Record<string, unknown> = {};
      for (const operation of ["select", "eq", "neq", "is", "in", "order", "limit", "ilike", "lte"]) {
        query[operation] = (...args: unknown[]) => {
          calls.push({ table, operation, args });
          const key = String(args[0]);
          if (operation === "eq" || operation === "is") result = result.filter(row => row[key] === args[1]);
          if (operation === "neq") result = result.filter(row => row[key] !== args[1]);
          if (operation === "in") result = result.filter(row => (args[1] as unknown[]).includes(row[key]));
          if (operation === "lte") result = result.filter(row => row[key] !== null && String(row[key]) <= (args[1] === "now" ? new Date().toISOString() : String(args[1])));
          if (operation === "limit") result = result.slice(0, Number(args[0]));
          if (operation === "order") result.sort((a, b) => String(a[key]).localeCompare(String(b[key])));
          return query;
        };
      }
      query.maybeSingle = () => Promise.resolve({ data: result[0] ?? null, error: null });
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: result, error: null }).then(resolve);
      return query;
    },
  };
  return { client: client as unknown as DatabaseClient, calls };
}
const category = (id: string, slug: string) => ({ id, slug, nameRu: slug, nameKk: `KK ${slug}`, isActive: true });
const taxonomy: ArticleTaxonomy = { categories: [category("first", "science"), category("second", "people")], tags: [], authors: [], contentTypes: [category("report", "report")] };
const filters = { locale: "ru" as const, query: "", category: "", tag: "" };
const records = {
  articles: [{ id: "article", content_type: "report", category_id: "first", cover_media_id: null, status: "published", published_at: "2026-01-01T00:00:00Z", deleted_at: null }],
  article_translations: [{ article_id: "article", locale: "ru", title: "Research", slug: "research", excerpt: "Research report", body: "Research report body", content_json: null, seo_title: null, seo_description: null }],
  article_category_links: [{ article_id: "article", category_id: "first", sort_order: 0 }, { article_id: "article", category_id: "second", sort_order: 1 }],
  article_categories: [{ id: "first", slug: "science", name_ru: "Science", name_kk: "Ғылым", is_active: true }, { id: "second", slug: "people", name_ru: "People", name_kk: "Адамдар", is_active: false }],
  article_types: [{ id: "report", slug: "report", name_ru: "Отчёт", name_kk: "Есеп", is_active: true }],
  article_authors: [{ article_id: "article", author_id: "external", role: "translator", sort_order: 1 }, { article_id: "article", author_id: "internal", role: "author", sort_order: 0 }],
  authors: ["external", "internal"].map(id => ({ id, name_ru: `${id} RU`, name_kk: `${id} KK`, bio_ru: "Bio", bio_kk: "KK Bio", organization: null, position: null, website_url: null, is_active: false })),
};
describe("public article credits with editorial sessions", () => {
  it("hydrates ordered roles, inactive attached categories and managed types without reading account identities", async () => {
    const { client, calls } = clientWith(records);
    const [article] = await new PublicArticleRepository(client).list(filters, taxonomy);
    expect(article.authors.map(author => [author.id, author.role])).toEqual([["internal", "author"], ["external", "translator"]]);
    expect(article.categories.map(item => item.id)).toEqual(["first", "second"]);
    expect(article.contentTypeItem?.slug).toBe("report");
    expect(calls.some(call => call.table === "profiles")).toBe(false);
    const columns = calls.find(call => call.table === "authors" && call.operation === "select")?.args[0];
    expect(columns).not.toContain("profile_id");
    expect(calls).toContainEqual({ table: "articles", operation: "eq", args: ["status", "published"] });
    expect(calls).toContainEqual({ table: "articles", operation: "is", args: ["deleted_at", null] });
    expect(calls.some(call => call.table === "articles" && call.operation === "lte" && call.args[0] === "published_at")).toBe(true);
  });
  it("finds a material through a secondary category", async () => {
    const { client, calls } = clientWith(records);
    expect(await new PublicArticleRepository(client).list({ ...filters, category: "people" }, taxonomy)).toHaveLength(1);
    expect(calls).toContainEqual({ table: "article_category_links", operation: "eq", args: ["category_id", "second"] });
    expect(calls).not.toContainEqual({ table: "articles", operation: "eq", args: ["category_id", "second"] });
  });
  it("does not fetch credits for draft, deleted or future articles readable by editors", async () => {
    for (const patch of [{ status: "draft" }, { deleted_at: "2026-01-01" }, { published_at: "2999-01-01T00:00:00Z" }]) {
      const { client, calls } = clientWith({ ...records, articles: [{ ...records.articles[0], ...patch }] });
      expect(await new PublicArticleRepository(client).getBySlug("ru", "research")).toBeNull();
      expect(calls.some(call => call.table === "authors" || call.table === "article_authors")).toBe(false);
    }
  });
  it("returns bilingual directory data on the public detail", async () => {
    const { client } = clientWith(records);
    const article = await new PublicArticleRepository(client).getBySlug("ru", "research");
    expect(article?.contentTypeItem?.nameKk).toBe("Есеп");
    expect(article?.categories.map(item => item.nameKk)).toEqual(["Ғылым", "Адамдар"]);
    expect(article?.authors[0].nameKk).toBe("internal KK");
  });
});
