import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArticleAuthor, ArticleAuthorRole, ArticleTaxonomyItem } from "@/types/domain/article";

export const authorPublicColumns = "id, name_ru, name_kk, bio_ru, bio_kk, organization, position, website_url, is_active";
export const taxonomyColumns = "id, slug, name_ru, name_kk, is_active";
export type AuthorRow = {
  id: string; profile_id?: string | null; name_ru: string; name_kk: string;
  bio_ru: string | null; bio_kk: string | null; organization: string | null;
  position: string | null; website_url: string | null; is_active: boolean;
};
export type TaxonomyRow = { id: string; slug: string; name_ru: string; name_kk: string; is_active: boolean };
export function mapAuthor(row: AuthorRow): ArticleAuthor {
  return {
    id: row.id, ...(row.profile_id !== undefined ? { profileId: row.profile_id } : {}),
    nameRu: row.name_ru, nameKk: row.name_kk, bioRu: row.bio_ru, bioKk: row.bio_kk,
    organization: row.organization, position: row.position, websiteUrl: row.website_url, isActive: row.is_active,
  };
}
export function mapTaxonomyItem(row: TaxonomyRow): ArticleTaxonomyItem {
  return { id: row.id, slug: row.slug, nameRu: row.name_ru, nameKk: row.name_kk, isActive: row.is_active };
}
type DirectoryTranslationRow = { locale: "ru" | "kk" | "en"; name: string; bio?: string | null };
function withTaxonomyTranslations(item: ArticleTaxonomyItem, rows: DirectoryTranslationRow[]) {
  return { ...item, nameEn: rows.find(row => row.locale === "en")?.name ?? null };
}
function withAuthorTranslations(item: ArticleAuthor, rows: DirectoryTranslationRow[]) {
  const en = rows.find(row => row.locale === "en");
  return { ...item, nameEn: en?.name ?? null, bioEn: en?.bio ?? null };
}

// Callers first resolve the visible articles. Public callers explicitly constrain
// status/time/deletion, so an editorial session cannot reveal unpublished credits.
export async function loadArticleCredits(client: SupabaseClient, articleIds: string[]) {
  if (!articleIds.length) return new Map<string, { categories: ArticleTaxonomyItem[]; authors: Array<ArticleAuthor & { role: ArticleAuthorRole }> }>();
  const [categoryResult, authorResult] = await Promise.all([
    client.from("article_category_links").select("article_id, category_id, sort_order").in("article_id", articleIds).order("sort_order"),
    client.from("article_authors").select("article_id, author_id, role, sort_order").in("article_id", articleIds).order("sort_order"),
  ]);
  if (categoryResult.error) throw categoryResult.error;
  if (authorResult.error) throw authorResult.error;
  const categories = (categoryResult.data ?? []) as Array<{ article_id: string; category_id: string }>;
  const authors = (authorResult.data ?? []) as Array<{ article_id: string; author_id: string; role: ArticleAuthorRole }>;
  const categoryIds = [...new Set(categories.map(item => item.category_id))];
  const authorIds = [...new Set(authors.map(item => item.author_id))];
  const [itemsResult, peopleResult, itemTranslationsResult, peopleTranslationsResult] = await Promise.all([
    categoryIds.length ? client.from("article_categories").select(taxonomyColumns).in("id", categoryIds) : { data: [], error: null },
    authorIds.length ? client.from("authors").select(authorPublicColumns).in("id", authorIds) : { data: [], error: null },
    categoryIds.length ? client.from("article_category_translations").select("category_id, locale, name").in("category_id", categoryIds) : { data: [], error: null },
    authorIds.length ? client.from("author_translations").select("author_id, locale, name, bio").in("author_id", authorIds) : { data: [], error: null },
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (peopleResult.error) throw peopleResult.error;
  if (itemTranslationsResult.error) throw itemTranslationsResult.error;
  if (peopleTranslationsResult.error) throw peopleTranslationsResult.error;
  const itemTranslations = (itemTranslationsResult.data ?? []) as Array<DirectoryTranslationRow & { category_id: string }>;
  const peopleTranslations = (peopleTranslationsResult.data ?? []) as Array<DirectoryTranslationRow & { author_id: string }>;
  const items = new Map(((itemsResult.data ?? []) as TaxonomyRow[]).map(row => [row.id, withTaxonomyTranslations(mapTaxonomyItem(row), itemTranslations.filter(item => item.category_id === row.id))]));
  const people = new Map(((peopleResult.data ?? []) as AuthorRow[]).map(row => [row.id, withAuthorTranslations(mapAuthor(row), peopleTranslations.filter(item => item.author_id === row.id))]));
  return new Map(articleIds.map(id => [id, {
    categories: categories.filter(link => link.article_id === id).flatMap(link => items.has(link.category_id) ? [items.get(link.category_id)!] : []),
    authors: authors.filter(link => link.article_id === id).flatMap(link => people.has(link.author_id) ? [{ ...people.get(link.author_id)!, role: link.role }] : []),
  }]));
}
