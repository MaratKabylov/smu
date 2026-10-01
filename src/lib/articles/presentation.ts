import type {
  ArticleContentType,
  ArticleStatus,
} from "@/types/domain/article";

export const articleStatusLabels: Record<ArticleStatus, string> = {
  draft: "Черновик",
  in_review: "На рецензии",
  approved: "Одобрено",
  published: "Опубликовано",
  archived: "В архиве",
};

export const articleContentTypeLabels: Record<ArticleContentType, string> = {
  article: "Статья",
  news: "Новость",
  interview: "Интервью",
  announcement: "Анонс",
};
