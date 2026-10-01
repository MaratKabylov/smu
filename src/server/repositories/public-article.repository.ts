import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicArticleFilters } from "@/lib/validation/article";
import type {
  ArticleContentType,
  ArticleLocale,
  ArticleTaxonomy,
  ArticleTaxonomyItem,
  PublicArticleCard,
  PublicArticleCover,
  PublicArticleDetail,
  PublicArticleTranslation,
} from "@/types/domain/article";

type TaxonomyRow = {
  id: string;
  slug: string;
  name_ru: string;
  name_kk: string;
  is_active: boolean;
};

type ArticleRow = {
  id: string;
  category_id: string | null;
  cover_media_id: string | null;
  content_type: ArticleContentType;
  published_at: string;
};

type TranslationRow = {
  article_id: string;
  locale: ArticleLocale;
  title: string;
  slug: string;
  excerpt: string;
};

type CoverRow = {
  id: string;
  storage_bucket: string;
  storage_path: string;
  alt_ru: string | null;
  alt_kk: string | null;
  caption_ru: string | null;
  caption_kk: string | null;
};

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
  constructor(private readonly client: SupabaseClient) {}

  async listTaxonomy(): Promise<ArticleTaxonomy> {
    const [categoriesResult, tagsResult] = await Promise.all([
      this.client
        .from("article_categories")
        .select("id, slug, name_ru, name_kk, is_active")
        .eq("is_active", true)
        .order("sort_order")
        .order("name_ru"),
      this.client
        .from("article_tags")
        .select("id, slug, name_ru, name_kk, is_active")
        .eq("is_active", true)
        .order("name_ru"),
    ]);
    if (categoriesResult.error) throw categoriesResult.error;
    if (tagsResult.error) throw tagsResult.error;

    return {
      categories: ((categoriesResult.data ?? []) as TaxonomyRow[]).map(mapTaxonomy),
      tags: ((tagsResult.data ?? []) as TaxonomyRow[]).map(mapTaxonomy),
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
    let translations = (translationsResult.data ?? []) as TranslationRow[];

    if (tag) {
      const { data, error } = await this.client
        .from("article_tag_links")
        .select("article_id")
        .eq("tag_id", tag.id);
      if (error) throw error;
      const taggedIds = new Set(
        ((data ?? []) as Array<{ article_id: string }>).map((row) => row.article_id),
      );
      translations = translations.filter((row) => taggedIds.has(row.article_id));
    }
    if (translations.length === 0) return [];

    let articlesQuery = this.client
      .from("articles")
      .select("id, category_id, cover_media_id, content_type, published_at")
      .eq("status", "published")
      .is("deleted_at", null)
      .lte("published_at", new Date().toISOString())
      .in("id", translations.map((row) => row.article_id))
      .order("published_at", { ascending: false })
      .limit(60);
    if (category) articlesQuery = articlesQuery.eq("category_id", category.id);

    const { data, error } = await articlesQuery;
    if (error) throw error;
    const articles = (data ?? []) as ArticleRow[];
    if (articles.length === 0) return [];

    const articleIds = articles.map((article) => article.id);
    const coverIds = articles.flatMap((article) =>
      article.cover_media_id ? [article.cover_media_id] : [],
    );
    const [linksResult, coversResult] = await Promise.all([
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
    ]);
    if (linksResult.error) throw linksResult.error;
    if (coversResult.error) throw coversResult.error;

    const links = (linksResult.data ?? []) as Array<{
      article_id: string;
      tag_id: string;
    }>;
    const covers = (coversResult.data ?? []) as CoverRow[];

    return articles.flatMap((article) => {
      const translation = translations.find((item) => item.article_id === article.id);
      if (!translation) return [];
      return [
        {
          id: article.id,
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
        "article_id, locale, title, slug, excerpt, body, seo_title, seo_description",
      )
      .eq("locale", locale)
      .eq("slug", slug)
      .maybeSingle();
    if (translationError) throw translationError;
    if (!translationData) return null;

    const translation = translationData as TranslationRow & {
      body: string;
      seo_title: string | null;
      seo_description: string | null;
    };
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
    const article = articleData as ArticleRow;

    const [alternateResult, taxonomy, linksResult, coverResult] = await Promise.all([
      this.client
        .from("article_translations")
        .select("article_id, locale, title, slug, excerpt")
        .eq("article_id", article.id)
        .neq("locale", locale)
        .maybeSingle(),
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
    ]);
    if (alternateResult.error) throw alternateResult.error;
    if (linksResult.error) throw linksResult.error;
    if (coverResult.error) throw coverResult.error;

    const links = (linksResult.data ?? []) as Array<{ tag_id: string }>;
    return {
      id: article.id,
      contentType: article.content_type,
      publishedAt: article.published_at,
      category:
        taxonomy.categories.find((item) => item.id === article.category_id) ?? null,
      tags: links.flatMap((link) => {
        const item = taxonomy.tags.find((candidate) => candidate.id === link.tag_id);
        return item ? [item] : [];
      }),
      cover: this.mapCover((coverResult.data ?? undefined) as CoverRow | undefined),
      translation: {
        ...mapTranslation(translation),
        body: translation.body,
        seoTitle: translation.seo_title,
        seoDescription: translation.seo_description,
      },
      alternateTranslation: alternateResult.data
        ? mapTranslation(alternateResult.data as TranslationRow)
        : null,
    };
  }

  private mapCover(row?: CoverRow): PublicArticleCover | null {
    if (!row) return null;
    const { data } = this.client.storage
      .from(row.storage_bucket)
      .getPublicUrl(row.storage_path);
    return {
      url: data.publicUrl,
      altRu: row.alt_ru,
      altKk: row.alt_kk,
      captionRu: row.caption_ru,
      captionKk: row.caption_kk,
    };
  }
}
