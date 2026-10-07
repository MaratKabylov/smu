import type { Locale } from "@/lib/i18n/locales";
import type { ArticleRelationLink } from "./article-relations";
import type { RichTextNode } from "@/lib/articles/rich-text";

export const articleStatuses = [
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "scheduled",
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

export type ArticleContentType = string;
export type ArticleLocale = Locale;

export const articleAuthorRoles = ["author", "coauthor", "editor", "translator"] as const;
export type ArticleAuthorRole = (typeof articleAuthorRoles)[number];
export type ArticleAuthor = {
  id: string;
  profileId?: string | null;
  nameRu: string;
  nameKk: string;
  nameEn?: string | null;
  bioRu: string | null;
  bioKk: string | null;
  bioEn?: string | null;
  organization: string | null;
  position: string | null;
  websiteUrl: string | null;
  isActive: boolean;
};
export type ArticleAuthorCredit = ArticleAuthor & { role: ArticleAuthorRole };
export type ArticleAuthorLink = { authorId: string; role: ArticleAuthorRole };

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
  nameEn?: string | null;
  isActive: boolean;
};

export type Article = {
  relations?: ArticleRelationLink[];
  id: string;
  authorId: string;
  scientificReviewerId: string | null;
  requiresScientificReview: boolean;
  contentVersion: number;
  approvedVersion: number | null;
  authorName: string | null;
  categoryId: string | null;
  category: ArticleTaxonomyItem | null;
  categories: ArticleTaxonomyItem[];
  authors: ArticleAuthorCredit[];
  contentTypeItem: ArticleTaxonomyItem | null;
  coverMediaId: string | null;
  contentType: ArticleContentType;
  status: ArticleStatus;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  translations: ArticleTranslation[];
  tags: ArticleTaxonomyItem[];
};

export const articleReviewDecisions = ["approved", "changes_requested"] as const;
export type ArticleReviewDecision = (typeof articleReviewDecisions)[number];
export type ArticleReview = {
  id: string;
  articleId: string;
  contentVersion: number;
  reviewerId: string;
  reviewerName: string;
  decision: ArticleReviewDecision;
  comment: string;
  createdAt: string;
};

export type ArticleTaxonomy = {
  categories: ArticleTaxonomyItem[];
  tags: ArticleTaxonomyItem[];
  contentTypes: ArticleTaxonomyItem[];
  authors: ArticleAuthor[];
};

export type ArticleSnapshot = {
  relations?: ArticleRelationLink[];
  contentType: ArticleContentType;
  categoryId: string | null;
  // Absent in revisions created before migration 012.
  categoryIds?: string[];
  authors?: ArticleAuthorLink[];
  coverMediaId: string | null;
  tagIds: string[];
  ru: Omit<ArticleTranslation, "id" | "locale">;
  kk: Omit<ArticleTranslation, "id" | "locale">;
  en?: Omit<ArticleTranslation, "id" | "locale">;
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
  isSystem: boolean;
  createdAt: string;
};
export type ArticleRevision = ArticleRevisionSummary & { snapshot: ArticleSnapshot };

export type PublicArticleCover = {
  url: string;
  altRu: string | null;
  altKk: string | null;
  altEn: string | null;
  captionRu: string | null;
  captionKk: string | null;
  captionEn: string | null;
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
  categories: ArticleTaxonomyItem[];
  authors: ArticleAuthorCredit[];
  contentTypeItem: ArticleTaxonomyItem | null;
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
  alternateTranslations: PublicArticleTranslation[];
};
