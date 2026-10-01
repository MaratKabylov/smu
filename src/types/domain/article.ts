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
    seoTitle: string | null;
    seoDescription: string | null;
  };
  alternateTranslation: PublicArticleTranslation | null;
};
