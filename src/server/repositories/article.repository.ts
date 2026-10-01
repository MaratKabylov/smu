import "server-only";

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
  TaxonomyInput,
} from "@/lib/validation/article";

type ArticleRow = {
  id: string;
  author_id: string;
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

    const [categoriesResult, tagsResult] = await Promise.all([
      categoryQuery,
      tagQuery,
    ]);
    if (categoriesResult.error) throw categoriesResult.error;
    if (tagsResult.error) throw tagsResult.error;

    return {
      categories: ((categoriesResult.data ?? []) as TaxonomyRow[]).map(
        mapTaxonomy,
      ),
      tags: ((tagsResult.data ?? []) as TaxonomyRow[]).map(mapTaxonomy),
    };
  }

  async create(authorId: string, input: ArticleInput): Promise<string> {
    const { data, error } = await this.client
      .from("articles")
      .insert({
        author_id: authorId,
        category_id: input.categoryId,
        cover_media_id: input.coverMediaId,
        content_type: input.contentType,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;

    const articleId = (data as { id: string }).id;
    try {
      await this.replaceTranslations(articleId, input);
      await this.replaceTags(articleId, input.tagIds);
      return articleId;
    } catch (cause) {
      await this.client.from("articles").delete().eq("id", articleId);
      throw cause;
    }
  }

  async update(id: string, input: ArticleInput) {
    const { error } = await this.client
      .from("articles")
      .update({
        category_id: input.categoryId,
        cover_media_id: input.coverMediaId,
        content_type: input.contentType,
      })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw error;

    await this.replaceTranslations(id, input);
    await this.replaceTags(id, input.tagIds);
  }

  async changeStatus(id: string, status: ArticleStatus) {
    const values: { status: ArticleStatus; published_at?: string | null } = {
      status,
    };
    if (status === "published") values.published_at = new Date().toISOString();
    if (status === "draft") values.published_at = null;

    const { error } = await this.client
      .from("articles")
      .update(values)
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw error;
  }

  async softDelete(id: string) {
    const { error } = await this.client
      .from("articles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw error;
  }

  async createTaxonomyItem(input: TaxonomyInput) {
    const table = input.kind === "category" ? "article_categories" : "article_tags";
    const { data, error } = await this.client
      .from(table)
      .insert({
        slug: input.slug,
        name_ru: input.nameRu,
        name_kk: input.nameKk,
      })
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: string }).id;
  }

  async isUsableCover(id: string) {
    const { data, error } = await this.client
      .from("media_assets")
      .select("id")
      .eq("id", id)
      .eq("status", "ready")
      .is("deleted_at", null)
      .like("mime_type", "image/%")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  private async replaceTranslations(articleId: string, input: ArticleInput) {
    const { error } = await this.client.from("article_translations").upsert(
      (["ru", "kk"] as const).map((locale) => ({
        article_id: articleId,
        locale,
        title: input[locale].title,
        slug: input[locale].slug,
        excerpt: input[locale].excerpt,
        body: input[locale].body,
        seo_title: input[locale].seoTitle,
        seo_description: input[locale].seoDescription,
      })),
      { onConflict: "article_id,locale" },
    );
    if (error) throw error;
  }

  private async replaceTags(articleId: string, tagIds: string[]) {
    const { error: deleteError } = await this.client
      .from("article_tag_links")
      .delete()
      .eq("article_id", articleId);
    if (deleteError) throw deleteError;
    if (tagIds.length === 0) return;

    const { error } = await this.client.from("article_tag_links").insert(
      tagIds.map((tagId) => ({ article_id: articleId, tag_id: tagId })),
    );
    if (error) throw error;
  }

  private async hydrate(rows: ArticleRow[]): Promise<Article[]> {
    if (rows.length === 0) return [];

    const articleIds = rows.map((row) => row.id);
    const categoryIds = [
      ...new Set(rows.flatMap((row) => (row.category_id ? [row.category_id] : []))),
    ];
    const authorIds = [...new Set(rows.map((row) => row.author_id))];

    const [translationsResult, linksResult, profilesResult, categoriesResult] =
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
      ]);

    if (translationsResult.error) throw translationsResult.error;
    if (linksResult.error) throw linksResult.error;
    if (profilesResult.error) throw profilesResult.error;
    if (categoriesResult.error) throw categoriesResult.error;

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
      authorId: row.author_id,
      authorName:
        profiles.find((profile) => profile.id === row.author_id)?.display_name ??
        null,
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
