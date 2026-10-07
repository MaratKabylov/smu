import type { Tables } from "@/types/database.types";
import "server-only";
import { loadArticleCredits, taxonomyColumns, mapTaxonomyItem } from "./article-credits.repository";
import { richTextDocumentSchema } from "@/lib/articles/rich-text";

import type { DatabaseClient } from "@/lib/supabase/database";
import { requiredFields } from "@/lib/supabase/database";
import type { PublicArticleFilters } from "@/lib/validation/article";
import type {
  ArticleLocale,
  ArticleTaxonomy,
  ArticleTaxonomyItem,
  PublicArticleCard,
  PublicArticleCover,
  PublicArticleDetail,
  PublicArticleTranslation,
} from "@/types/domain/article";

type TaxonomyRow = Pick<Tables<"article_categories">, "id" | "slug" | "name_ru" | "name_kk" | "is_active">;

type TranslationRow = Pick<Tables<"article_translations">, "article_id" | "locale" | "title" | "slug" | "excerpt">;

type CoverRow = Pick<Tables<"media_assets">, "id" | "storage_bucket" | "storage_path" | "alt_ru" | "alt_kk" | "caption_ru" | "caption_kk">;
type CoverTranslationRow = Pick<Tables<"media_asset_translations">, "media_asset_id" | "alt_text" | "caption">;

const publicMediaBuckets = [
  "avatars",
  "organization-logos",
  "article-media",
  "event-media",
];

function mapTaxonomy(row: TaxonomyRow): ArticleTaxonomyItem {
  return {
    id: row.id,
    slug: row.slug,
    nameRu: row.name_ru,
    nameKk: row.name_kk,
    isActive: row.is_active,
  };
}

function mapTranslation(row: TranslationRow): PublicArticleTranslation {
  return {
    locale: row.locale,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
  };
}

export class PublicArticleRepository {
  constructor(private readonly client: DatabaseClient) {}

  async listTaxonomy(): Promise<ArticleTaxonomy> {
    const [categoriesResult, tagsResult, typesResult, categoryTranslations, tagTranslations, typeTranslations] = await Promise.all([
      this.client
        .from("article_categories")
        .select("id, slug, name_ru, name_kk, is_active")
        .order("sort_order")
        .order("name_ru"),
      this.client
        .from("article_tags")
        .select("id, slug, name_ru, name_kk, is_active")
        .eq("is_active", true)
        .order("name_ru"),
      this.client.from("article_types").select(taxonomyColumns).order("name_ru"),
      this.client.from("article_category_translations").select("category_id, name").eq("locale", "en"),
      this.client.from("article_tag_translations").select("tag_id, name").eq("locale", "en"),
      this.client.from("article_type_translations").select("type_id, name").eq("locale", "en"),
    ]);
    if (categoriesResult.error) throw categoriesResult.error;
    if (tagsResult.error) throw tagsResult.error;
    if (typesResult.error) throw typesResult.error;
    if (categoryTranslations.error) throw categoryTranslations.error;
    if (tagTranslations.error) throw tagTranslations.error;
    if (typeTranslations.error) throw typeTranslations.error;

    const translated = <Key extends "category_id" | "tag_id" | "type_id">(item: ArticleTaxonomyItem, values: Array<{ name: string } & Record<Key, string>> | null, key: Key) => ({
      ...item,
      nameEn: (values ?? []).find(row => row[key] === item.id)?.name ?? null,
    });

    return {
      categories: (categoriesResult.data ?? []).map(row => translated(mapTaxonomy(row), categoryTranslations.data, "category_id")),
      tags: (tagsResult.data ?? []).map(row => translated(mapTaxonomy(row), tagTranslations.data, "tag_id")),
      contentTypes: (typesResult.data ?? []).map(row => translated(mapTaxonomyItem(row), typeTranslations.data, "type_id")), authors: [],
    };
  }

  async list(
    filters: PublicArticleFilters,
    taxonomy: ArticleTaxonomy,
  ): Promise<PublicArticleCard[]> {
    const category = filters.category
      ? taxonomy.categories.find((item) => item.slug === filters.category)
      : null;
    const tag = filters.tag
      ? taxonomy.tags.find((item) => item.slug === filters.tag)
      : null;
    if ((filters.category && !category) || (filters.tag && !tag)) return [];

    let translationsQuery = this.client
      .from("article_translations")
      .select("article_id, locale, title, slug, excerpt")
      .eq("locale", filters.locale);
    if (filters.query) {
      translationsQuery = translationsQuery.ilike("title", `%${filters.query}%`);
    }
    const translationsResult = await translationsQuery;
    if (translationsResult.error) throw translationsResult.error;
    let translations = (translationsResult.data ?? []);

    if (category) {
      const { data, error } = await this.client.from("article_category_links").select("article_id").eq("category_id", category.id);
      if (error) throw error;
      const ids = new Set(((data ?? [])).map(row => row.article_id));
      translations = translations.filter(row => ids.has(row.article_id));
    }
    if (tag) {
      const { data, error } = await this.client
        .from("article_tag_links")
        .select("article_id")
        .eq("tag_id", tag.id);
      if (error) throw error;
      const taggedIds = new Set(
        ((data ?? [])).map((row) => row.article_id),
      );
      translations = translations.filter((row) => taggedIds.has(row.article_id));
    }
    if (translations.length === 0) return [];

    const articlesQuery = this.client
      .from("articles")
      .select("id, category_id, cover_media_id, content_type, published_at")
      .eq("status", "published")
      .is("deleted_at", null)
      .lte("published_at", new Date().toISOString())
      .in("id", translations.map((row) => row.article_id))
      .order("published_at", { ascending: false })
      .limit(60);

    const { data, error } = await articlesQuery;
    if (error) throw error;
    const articles = (data ?? []).map(row => requiredFields(row, "published_at"));
    if (articles.length === 0) return [];

    const articleIds = articles.map((article) => article.id);
    const coverIds = articles.flatMap((article) =>
      article.cover_media_id ? [article.cover_media_id] : [],
    );
    const [linksResult, coversResult, coverTranslationsResult, credits] = await Promise.all([
      this.client
        .from("article_tag_links")
        .select("article_id, tag_id")
        .in("article_id", articleIds),
      coverIds.length > 0
        ? this.client
            .from("media_assets")
            .select(
              "id, storage_bucket, storage_path, alt_ru, alt_kk, caption_ru, caption_kk",
            )
            .in("id", coverIds)
            .eq("status", "ready")
            .is("deleted_at", null)
            .in("storage_bucket", publicMediaBuckets)
        : Promise.resolve({ data: [], error: null }),
      coverIds.length > 0
        ? this.client.from("media_asset_translations").select("media_asset_id, alt_text, caption").eq("locale", "en").in("media_asset_id", coverIds)
        : Promise.resolve({ data: [], error: null }),
      loadArticleCredits(this.client, articleIds),
    ]);
    if (linksResult.error) throw linksResult.error;
    if (coversResult.error) throw coversResult.error;
    if (coverTranslationsResult.error) throw coverTranslationsResult.error;

    const links = (linksResult.data ?? []);
    const covers = (coversResult.data ?? []);
    const coverTranslations = (coverTranslationsResult.data ?? []);

    return articles.flatMap((article) => {
      const translation = translations.find((item) => item.article_id === article.id);
      if (!translation) return [];
      return [
        {
          id: article.id,
          categories: credits.get(article.id)?.categories ?? [], authors: credits.get(article.id)?.authors ?? [],
          contentTypeItem: taxonomy.contentTypes.find(item => item.slug === article.content_type) ?? null,
          contentType: article.content_type,
          publishedAt: article.published_at,
          category:
            taxonomy.categories.find((item) => item.id === article.category_id) ?? null,
          tags: links
            .filter((link) => link.article_id === article.id)
            .flatMap((link) => {
              const item = taxonomy.tags.find((candidate) => candidate.id === link.tag_id);
              return item ? [item] : [];
            }),
          cover: this.mapCover(
            covers.find((cover) => cover.id === article.cover_media_id),
            coverTranslations.find(item => item.media_asset_id === article.cover_media_id),
          ),
          translation: mapTranslation(translation),
        },
      ];
    });
  }

  async getBySlug(
    locale: ArticleLocale,
    slug: string,
  ): Promise<PublicArticleDetail | null> {
    const { data: translationData, error: translationError } = await this.client
      .from("article_translations")
      .select(
        "article_id, locale, title, slug, excerpt, body, content_json, seo_title, seo_description",
      )
      .eq("locale", locale)
      .eq("slug", slug)
      .maybeSingle();
    if (translationError) throw translationError;
    if (!translationData) return null;

    const translation = translationData;
    const { data: articleData, error: articleError } = await this.client
      .from("articles")
      .select("id, category_id, cover_media_id, content_type, published_at")
      .eq("id", translation.article_id)
      .eq("status", "published")
      .is("deleted_at", null)
      .lte("published_at", new Date().toISOString())
      .maybeSingle();
    if (articleError) throw articleError;
    if (!articleData) return null;
    const article = requiredFields(articleData, "published_at");

    const [alternateResult, taxonomy, linksResult, coverResult, coverTranslationResult, credits] = await Promise.all([
      this.client
        .from("article_translations")
        .select("article_id, locale, title, slug, excerpt")
        .eq("article_id", article.id)
        .neq("locale", locale),
      this.listTaxonomy(),
      this.client
        .from("article_tag_links")
        .select("article_id, tag_id")
        .eq("article_id", article.id),
      article.cover_media_id
        ? this.client
            .from("media_assets")
            .select(
              "id, storage_bucket, storage_path, alt_ru, alt_kk, caption_ru, caption_kk",
            )
            .eq("id", article.cover_media_id)
            .eq("status", "ready")
            .is("deleted_at", null)
            .in("storage_bucket", publicMediaBuckets)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      article.cover_media_id
        ? this.client.from("media_asset_translations").select("media_asset_id, alt_text, caption").eq("media_asset_id", article.cover_media_id).eq("locale", "en").maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      loadArticleCredits(this.client, [article.id]),
    ]);
    if (alternateResult.error) throw alternateResult.error;
    if (linksResult.error) throw linksResult.error;
    if (coverResult.error) throw coverResult.error;
    if (coverTranslationResult.error) throw coverTranslationResult.error;

    const links = (linksResult.data ?? []);
    return {
      id: article.id,
      categories: credits.get(article.id)?.categories ?? [], authors: credits.get(article.id)?.authors ?? [],
      contentTypeItem: taxonomy.contentTypes.find(item => item.slug === article.content_type) ?? null,
      contentType: article.content_type,
      publishedAt: article.published_at,
      category:
        taxonomy.categories.find((item) => item.id === article.category_id) ?? null,
      tags: links.flatMap((link) => {
        const item = taxonomy.tags.find((candidate) => candidate.id === link.tag_id);
        return item ? [item] : [];
      }),
      cover: this.mapCover(coverResult.data ?? undefined, coverTranslationResult.data ?? undefined),
      translation: {
        ...mapTranslation(translation),
        body: translation.body,
        contentJson: translation.content_json === null ? null : richTextDocumentSchema.parse(translation.content_json),
        seoTitle: translation.seo_title,
        seoDescription: translation.seo_description,
      },
      alternateTranslations: (alternateResult.data ?? []).map(mapTranslation),
    };
  }

  private mapCover(row?: CoverRow, en?: CoverTranslationRow): PublicArticleCover | null {
    if (!row) return null;
    const { data } = this.client.storage
      .from(row.storage_bucket)
      .getPublicUrl(row.storage_path);
    return {
      url: data.publicUrl,
      altRu: row.alt_ru,
      altKk: row.alt_kk,
      altEn: en?.alt_text ?? null,
      captionRu: row.caption_ru,
      captionKk: row.caption_kk,
      captionEn: en?.caption ?? null,
    };
  }
}
