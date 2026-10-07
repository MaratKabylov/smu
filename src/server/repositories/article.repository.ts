import type { Tables } from "@/types/database.types";
import { z } from "zod";
import "server-only";
import { ArticleRelationsRepository } from "./article-relations.repository";
import { loadArticleCredits, mapAuthor, mapTaxonomyItem, authorPublicColumns, taxonomyColumns, type AuthorRow } from "./article-credits.repository";
import { richTextDocumentSchema } from "@/lib/articles/rich-text";

import { callDatabaseRpc, databaseJson, requiredFields, type DatabaseClient } from "@/lib/supabase/database";
import type {
  Article,
  ArticleReview,
  ArticleReviewDecision,
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

type ArticleRow = Pick<Tables<"articles">, "id" | "author_id" | "scientific_reviewer_id" | "requires_scientific_review" | "content_version" | "approved_version" | "category_id" | "cover_media_id" | "content_type" | "status" | "published_at" | "scheduled_at" | "created_at" | "updated_at" | "deleted_at">;

type TranslationRow = Pick<Tables<"article_translations">, "id" | "article_id" | "locale" | "title" | "slug" | "excerpt" | "body" | "content_json" | "seo_title" | "seo_description">;

type TaxonomyRow = Pick<Tables<"article_categories">, "id" | "slug" | "name_ru" | "name_kk" | "is_active">;

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
    contentJson: row.content_json === null ? null : richTextDocumentSchema.parse(row.content_json),
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
  };
}

export class ArticleRepository {
  constructor(private readonly client: DatabaseClient) {}

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
          ((data ?? [])).map(
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
    return this.hydrate((data ?? []));
  }

  async getById(id: string): Promise<Article | null> {
    const { data, error } = await this.client
      .from("articles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const [article] = await this.hydrate([data]);
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

    const [categoriesResult, tagsResult, typesResult, authorsResult, categoryTranslations, tagTranslations, typeTranslations, authorTranslations] = await Promise.all([
      categoryQuery,
      tagQuery,
      includeInactive ? this.client.from("article_types").select(taxonomyColumns).order("name_ru")
        : this.client.from("article_types").select(taxonomyColumns).eq("is_active", true).order("name_ru"),
      includeInactive ? this.client.from("authors").select(`${authorPublicColumns}, profile_id`).order("name_ru")
        : this.client.from("authors").select(`${authorPublicColumns}, profile_id`).eq("is_active", true).order("name_ru"),
      this.client.from("article_category_translations").select("category_id, locale, name").eq("locale", "en"),
      this.client.from("article_tag_translations").select("tag_id, locale, name").eq("locale", "en"),
      this.client.from("article_type_translations").select("type_id, locale, name").eq("locale", "en"),
      this.client.from("author_translations").select("author_id, locale, name, bio").eq("locale", "en"),
    ]);
    if (categoriesResult.error) throw categoriesResult.error;
    if (tagsResult.error) throw tagsResult.error;
    if (typesResult.error) throw typesResult.error;
    if (authorsResult.error) throw authorsResult.error;
    if (categoryTranslations.error) throw categoryTranslations.error;
    if (tagTranslations.error) throw tagTranslations.error;
    if (typeTranslations.error) throw typeTranslations.error;
    if (authorTranslations.error) throw authorTranslations.error;

    const translatedTaxonomy = <Key extends "category_id" | "tag_id" | "type_id">(row: TaxonomyRow, values: Array<{ name: string } & Record<Key, string>> | null, key: Key) => {
      const translation = (values ?? []).find(item => item[key] === row.id);
      return { ...mapTaxonomyItem(row), nameEn: translation?.name ?? null };
    };
    const translatedAuthor = (row: AuthorRow) => {
      const translation = (authorTranslations.data ?? []).find(item => item.author_id === row.id);
      return { ...mapAuthor(row), nameEn: translation?.name ?? null, bioEn: translation?.bio ?? null };
    };

    return {
      categories: (categoriesResult.data ?? []).map(row => translatedTaxonomy(row, categoryTranslations.data, "category_id")),
      tags: (tagsResult.data ?? []).map(row => translatedTaxonomy(row, tagTranslations.data, "tag_id")),
      contentTypes: (typesResult.data ?? []).map(row => translatedTaxonomy(row, typeTranslations.data, "type_id")),
      authors: (authorsResult.data ?? []).map(translatedAuthor),
    };
  }

  async create(input: ArticleInput): Promise<string> {
    return callDatabaseRpc(this.client, "save_article", { p_id: null, p_input: databaseJson(input) });
  }

  async update(id: string, input: ArticleInput) {
    await callDatabaseRpc(this.client, "save_article", { p_id: id, p_input: databaseJson(input) });
  }

  async changeStatus(id: string, status: ArticleStatus, expectedVersion: number) {
    await callDatabaseRpc(this.client, "change_article_state", { p_id: id, p_status: status, p_delete: false, p_expected_version: expectedVersion });
  }

  async softDelete(id: string) {
    await callDatabaseRpc(this.client, "change_article_state", { p_id: id, p_status: null, p_delete: true });
  }

  async restoreDeleted(id: string, expectedDeletedAt: string) {
    await callDatabaseRpc(this.client, "restore_deleted_article", { p_id: id, p_expected_deleted_at: expectedDeletedAt });
  }

  async schedule(id: string, expectedVersion: number, scheduledAt: string | null, expectedScheduledAt: string | null) {
    await callDatabaseRpc(this.client, "schedule_article", {
      p_id: id, p_expected_version: expectedVersion,
      p_scheduled_at: scheduledAt, p_expected_scheduled_at: expectedScheduledAt,
    });
  }

  async createTaxonomyItem(input: TaxonomyInput) {
    return callDatabaseRpc(this.client, "create_article_taxonomy", { p_input: databaseJson(input) });
  }

  async updateTaxonomyItem(input: TaxonomyUpdateInput) {
    return callDatabaseRpc(this.client, "save_article_taxonomy", { p_id: input.id, p_input: databaseJson(input) });
  }

  async saveAuthor(id: string | null, input: ArticleAuthorInput) {
    return callDatabaseRpc(this.client, "save_article_author", { p_id: id, p_input: databaseJson(input) });
  }

  async listAuthorProfiles() {
    const rows = await callDatabaseRpc(this.client, "list_article_author_profiles", {});
    return rows.map(row => requiredFields(row, "id"));
  }

  async listReviewers() {
    const rows = await callDatabaseRpc(this.client, "list_article_reviewers", {});
    return rows.map(value => {
      const row = requiredFields(value, "id");
      return { id: row.id, displayName: row.display_name ?? "Рецензент" };
    });
  }

  async assignReviewer(id: string, reviewerId: string | null) {
    await callDatabaseRpc(this.client, "assign_article_reviewer", { p_id: id, p_reviewer: reviewerId });
  }

  async configureReview(id: string, requiresScientificReview: boolean, reviewerId: string | null) {
    await callDatabaseRpc(this.client, "configure_article_review", {
      p_id: id,
      p_requires_scientific_review: requiresScientificReview,
      p_reviewer: reviewerId,
    });
  }

  async submitReview(id: string, expectedVersion: number, decision: ArticleReviewDecision, comment: string) {
    return callDatabaseRpc(this.client, "submit_article_review", {
      p_id: id,
      p_expected_version: expectedVersion,
      p_decision: decision,
      p_comment: comment,
    });
  }

  async listReviews(id: string): Promise<ArticleReview[]> {
    const rows = await callDatabaseRpc(this.client, "list_article_reviews", { p_id: id });
    return rows.map(value => {
      const row = requiredFields(value, "id", "article_id", "content_version", "reviewer_id", "reviewer_name", "comment", "created_at");
      return {
        id: row.id,
        articleId: row.article_id,
        contentVersion: row.content_version,
        reviewerId: row.reviewer_id,
        reviewerName: row.reviewer_name,
        decision: z.enum(["approved", "changes_requested"]).parse(row.decision),
        comment: row.comment,
        createdAt: row.created_at,
      };
    });
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

    const links = (linksResult.data ?? []);
    const tagIds = [...new Set(links.map((link) => link.tag_id))];
    const tagsResult =
      tagIds.length > 0
        ? await this.client
            .from("article_tags")
            .select("id, slug, name_ru, name_kk, is_active")
            .in("id", tagIds)
        : { data: [], error: null };
    if (tagsResult.error) throw tagsResult.error;

    const translations = translationsResult.data ?? [];
    const profiles = (profilesResult.data ?? []);
    const categories = (categoriesResult.data ?? []);
    const tags = (tagsResult.data ?? []);

    return rows.map((row) => ({
      id: row.id,
      relations: relations.get(row.id) ?? [],
      authorId: row.author_id,
      scientificReviewerId: row.scientific_reviewer_id,
      requiresScientificReview: row.requires_scientific_review,
      contentVersion: row.content_version,
      approvedVersion: row.approved_version,
      authorName:
        profiles.find((profile) => profile.id === row.author_id)?.display_name ??
        null,
      categories: credits.get(row.id)?.categories ?? [],
      authors: credits.get(row.id)?.authors ?? [],
      contentTypeItem: (typesResult.data ?? []).map(mapTaxonomyItem).find(item => item.slug === row.content_type) ?? null,
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
      scheduledAt: row.scheduled_at,
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
