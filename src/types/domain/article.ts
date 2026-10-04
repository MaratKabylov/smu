import type { RichTextNode } from "@/lib/articles/rich-text";

export const articleStatuses = [
  "draft",
  "in_review",
  "approved",
  "published",
  "archived",
] as const;

export type ArticleStatus = (typeof articleStatuses)[number];

export const articleContentTypes = [
  "article",
  "news",
  "interview",
  "announcement",
] as const;

export type ArticleContentType = (typeof articleContentTypes)[number];
export type ArticleLocale = "ru" | "kk";

export type ArticleTranslation = {
  id: string;
  locale: ArticleLocale;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  contentJson?: RichTextNode | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type ArticleTaxonomyItem = {
  id: string;
  slug: string;
  nameRu: string;
  nameKk: string;
  isActive: boolean;
};

export type Article = {
  id: string;
  authorId: string;
  scientificReviewerId: string | null;
  contentVersion: number;
  approvedVersion: number | null;
  authorName: string | null;
  categoryId: string | null;
  category: ArticleTaxonomyItem | null;
  coverMediaId: string | null;
  contentType: ArticleContentType;
  status: ArticleStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  translations: ArticleTranslation[];
  tags: ArticleTaxonomyItem[];
};

export type ArticleTaxonomy = {
  categories: ArticleTaxonomyItem[];
  tags: ArticleTaxonomyItem[];
};

export type ArticleSnapshot = {
  contentType: ArticleContentType;
  categoryId: string | null;
  coverMediaId: string | null;
  tagIds: string[];
  ru: Omit<ArticleTranslation, "id" | "locale">;
  kk: Omit<ArticleTranslation, "id" | "locale">;
};

export type ArticleRevisionReason = "manual" | "review" | "publish" | "before_restore";
export type ArticleRevisionSummary = {
  id: string;
  articleId: string;
  revisionNumber: number;
  contentVersion: number;
  reason: ArticleRevisionReason;
  titleRu: string;
  titleKk: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
};
export type ArticleRevision = ArticleRevisionSummary & { snapshot: ArticleSnapshot };

export type PublicArticleCover = {
  url: string;
  altRu: string | null;
  altKk: string | null;
  captionRu: string | null;
  captionKk: string | null;
};

export type PublicArticleTranslation = {
  locale: ArticleLocale;
  title: string;
  slug: string;
  excerpt: string;
};

export type PublicArticleCard = {
  id: string;
  contentType: ArticleContentType;
  publishedAt: string;
  category: ArticleTaxonomyItem | null;
  tags: ArticleTaxonomyItem[];
  cover: PublicArticleCover | null;
  translation: PublicArticleTranslation;
};

export type PublicArticleDetail = Omit<PublicArticleCard, "translation"> & {
  translation: PublicArticleTranslation & {
    body: string;
    contentJson?: RichTextNode | null;
    seoTitle: string | null;
    seoDescription: string | null;
  };
  alternateTranslation: PublicArticleTranslation | null;
};
