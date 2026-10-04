import "server-only";
import { ArticleRelationsRepository } from "./article-relations.repository";
import { loadArticleCredits, mapAuthor, mapTaxonomyItem, authorPublicColumns, taxonomyColumns, type AuthorRow } from "./article-credits.repository";
import type { RichTextNode } from "@/lib/articles/rich-text";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Article,
  ArticleContentType,
  ArticleLocale,
  ArticleStatus,
  ArticleTaxonomy,
  ArticleTaxonomyItem,
  ArticleTranslation,
} from "@/types/domain/article";
import type {
  ArticleInput,
  ArticleListFilters,
  TaxonomyInput, ArticleAuthorInput, TaxonomyUpdateInput,
} from "@/lib/validation/article";

type ArticleRow = {
  id: string;
  author_id: string;
  scientific_reviewer_id: string | null;
  content_version: number;
  approved_version: number | null;
  category_id: string | null;
  cover_media_id: string | null;
  content_type: ArticleContentType;
  status: ArticleStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type TranslationRow = {
  id: string;
  article_id: string;
  locale: ArticleLocale;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  content_json: RichTextNode | null;
  seo_title: string | null;
  seo_description: string | null;
};

type TaxonomyRow = {
  id: string;
  slug: string;
  name_ru: string;
  name_kk: string;
  is_active: boolean;
};

function mapTaxonomy(row: TaxonomyRow): ArticleTaxonomyItem {
  return {
    id: row.id,
    slug: row.slug,
    nameRu: row.name_ru,
    nameKk: row.name_kk,
    isActive: row.is_active,
  };
}

function mapTranslation(row: TranslationRow): ArticleTranslation {
  return {
    id: row.id,
    locale: row.locale,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    body: row.body,
    contentJson: row.content_json,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
  };
}

export class ArticleRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: ArticleListFilters): Promise<Article[]> {
    let matchingIds: string[] | null = null;
    if (filters.query) {
      const { data, error } = await this.client
        .from("article_translations")
        .select("article_id")
        .ilike("title", `%${filters.query}%`);
      if (error) throw error;
      matchingIds = [
        ...new Set(
          ((data ?? []) as Array<{ article_id: string }>).map(
            (row) => row.article_id,
          ),
        ),
      ];
      if (matchingIds.length === 0) return [];
    }

    let query = this.client
      .from("articles")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (filters.status !== "all") query = query.eq("status", filters.status);
    if (matchingIds) query = query.in("id", matchingIds);

    const { data, error } = await query;
    if (error) throw error;
    return this.hydrate((data ?? []) as ArticleRow[]);
  }

  async getById(id: string): Promise<Article | null> {
    const { data, error } = await this.client
      .from("articles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const [article] = await this.hydrate([data as ArticleRow]);
    return article ?? null;
  }

  async listTaxonomy(includeInactive = false): Promise<ArticleTaxonomy> {
    let categoryQuery = this.client
      .from("article_categories")
      .select("id, slug, name_ru, name_kk, is_active")
      .order("sort_order")
      .order("name_ru");
    let tagQuery = this.client
      .from("article_tags")
      .select("id, slug, name_ru, name_kk, is_active")
      .order("name_ru");

    if (!includeInactive) {
      categoryQuery = categoryQuery.eq("is_active", true);
      tagQuery = tagQuery.eq("is_active", true);
    }

    const [categoriesResult, tagsResult, typesResult, authorsResult] = await Promise.all([
      categoryQuery,
      tagQuery,
      includeInactive ? this.client.from("article_types").select(taxonomyColumns).order("name_ru")
        : this.client.from("article_types").select(taxonomyColumns).eq("is_active", true).order("name_ru"),
      includeInactive ? this.client.from("authors").select(`${authorPublicColumns}, profile_id`).order("name_ru")
        : this.client.from("authors").select(`${authorPublicColumns}, profile_id`).eq("is_active", true).order("name_ru"),
    ]);
    if (categoriesResult.error) throw categoriesResult.error;
    if (tagsResult.error) throw tagsResult.error;
    if (typesResult.error) throw typesResult.error;
    if (authorsResult.error) throw authorsResult.error;

    return {
      categories: ((categoriesResult.data ?? []) as TaxonomyRow[]).map(
        mapTaxonomy,
      ),
      tags: ((tagsResult.data ?? []) as TaxonomyRow[]).map(mapTaxonomy),
      contentTypes: ((typesResult.data ?? []) as TaxonomyRow[]).map(mapTaxonomyItem),
      authors: ((authorsResult.data ?? []) as AuthorRow[]).map(mapAuthor),
    };
  }

  async create(input: ArticleInput): Promise<string> {
    return this.mutate<string>("save_article", { p_id: null, p_input: input });
  }

  async update(id: string, input: ArticleInput) {
    await this.mutate<string>("save_article", { p_id: id, p_input: input });
  }

  async changeStatus(id: string, status: ArticleStatus, expectedVersion: number) {
    await this.mutate("change_article_state", { p_id: id, p_status: status, p_delete: false, p_expected_version: expectedVersion });
  }

  async softDelete(id: string) {
    await this.mutate("change_article_state", { p_id: id, p_status: null, p_delete: true });
  }

  async createTaxonomyItem(input: TaxonomyInput) {
    return this.mutate<string>("create_article_taxonomy", { p_input: input });
  }

  async updateTaxonomyItem(input: TaxonomyUpdateInput) {
    return this.mutate<string>("save_article_taxonomy", { p_id: input.id, p_input: input });
  }

  async saveAuthor(id: string | null, input: ArticleAuthorInput) {
    return this.mutate<string>("save_article_author", { p_id: id, p_input: input });
  }

  async listAuthorProfiles() {
    return this.mutate<Array<{ id: string; display_name: string | null }>>("list_article_author_profiles", {});
  }

  async listReviewers() {
    const rows = await this.mutate<Array<{ id: string; display_name: string | null }>>("list_article_reviewers", {});
    return rows.map((row) => ({ id: row.id, displayName: row.display_name ?? "Рецензент" }));
  }

  async assignReviewer(id: string, reviewerId: string | null) {
    await this.mutate("assign_article_reviewer", { p_id: id, p_reviewer: reviewerId });
  }

  private async mutate<T = void>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw error;
    return data as T;
  }

  private async hydrate(rows: ArticleRow[]): Promise<Article[]> {
    if (rows.length === 0) return [];

    const articleIds = rows.map((row) => row.id);
    const categoryIds = [
      ...new Set(rows.flatMap((row) => (row.category_id ? [row.category_id] : []))),
    ];
    const authorIds = [...new Set(rows.map((row) => row.author_id))];

    const [translationsResult, linksResult, profilesResult, categoriesResult, credits, typesResult, relations] =
      await Promise.all([
        this.client
          .from("article_translations")
          .select("*")
          .in("article_id", articleIds),
        this.client
          .from("article_tag_links")
          .select("article_id, tag_id")
          .in("article_id", articleIds),
        this.client
          .from("profiles")
          .select("id, display_name")
          .in("id", authorIds),
        categoryIds.length > 0
          ? this.client
              .from("article_categories")
              .select("id, slug, name_ru, name_kk, is_active")
              .in("id", categoryIds)
          : Promise.resolve({ data: [], error: null }),
        loadArticleCredits(this.client, articleIds),
        this.client.from("article_types").select(taxonomyColumns).in("slug", [...new Set(rows.map(row => row.content_type))]),
        new ArticleRelationsRepository(this.client).loadLinks(articleIds),
      ]);

    if (translationsResult.error) throw translationsResult.error;
    if (linksResult.error) throw linksResult.error;
    if (profilesResult.error) throw profilesResult.error;
    if (categoriesResult.error) throw categoriesResult.error;
    if (typesResult.error) throw typesResult.error;

    const links = (linksResult.data ?? []) as Array<{
      article_id: string;
      tag_id: string;
    }>;
    const tagIds = [...new Set(links.map((link) => link.tag_id))];
    const tagsResult =
      tagIds.length > 0
        ? await this.client
            .from("article_tags")
            .select("id, slug, name_ru, name_kk, is_active")
            .in("id", tagIds)
        : { data: [], error: null };
    if (tagsResult.error) throw tagsResult.error;

    const translations = (translationsResult.data ?? []) as TranslationRow[];
    const profiles = (profilesResult.data ?? []) as Array<{
      id: string;
      display_name: string | null;
    }>;
    const categories = (categoriesResult.data ?? []) as TaxonomyRow[];
    const tags = (tagsResult.data ?? []) as TaxonomyRow[];

    return rows.map((row) => ({
      id: row.id,
      relations: relations.get(row.id) ?? [],
      authorId: row.author_id,
      scientificReviewerId: row.scientific_reviewer_id,
      contentVersion: row.content_version,
      approvedVersion: row.approved_version,
      authorName:
        profiles.find((profile) => profile.id === row.author_id)?.display_name ??
        null,
      categories: credits.get(row.id)?.categories ?? [],
      authors: credits.get(row.id)?.authors ?? [],
      contentTypeItem: ((typesResult.data ?? []) as TaxonomyRow[]).map(mapTaxonomyItem).find(item => item.slug === row.content_type) ?? null,
      categoryId: row.category_id,
      category:
        categories.find((category) => category.id === row.category_id)
          ? mapTaxonomy(
              categories.find((category) => category.id === row.category_id)!,
            )
          : null,
      coverMediaId: row.cover_media_id,
      contentType: row.content_type,
      status: row.status,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      translations: translations
        .filter((translation) => translation.article_id === row.id)
        .map(mapTranslation),
      tags: links
        .filter((link) => link.article_id === row.id)
        .flatMap((link) => {
          const tag = tags.find((item) => item.id === link.tag_id);
          return tag ? [mapTaxonomy(tag)] : [];
        }),
    }));
  }
}
