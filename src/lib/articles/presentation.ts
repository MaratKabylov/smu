import type {
  ArticleContentType,
  ArticleStatus,
  ArticleLocale, ArticleTaxonomyItem, ArticleAuthorRole,
} from "@/types/domain/article";

export const articleStatusLabels: Record<ArticleStatus, string> = {
  draft: "Черновик",
  in_review: "На рецензии",
  changes_requested: "Требуются изменения",
  approved: "Одобрено",
  published: "Опубликовано",
  archived: "В архиве",
};

export const articleAuthorRoleLabels: Record<ArticleLocale, Record<ArticleAuthorRole, string>> = {
  ru: { author: "Автор", coauthor: "Соавтор", editor: "Редактор", translator: "Переводчик" },
  kk: { author: "Автор", coauthor: "Қосалқы автор", editor: "Редактор", translator: "Аудармашы" },
};
export function articleTypeLabel(code: string, item: ArticleTaxonomyItem | null | undefined, locale: ArticleLocale) {
  if (item) return locale === "ru" ? item.nameRu : item.nameKk;
  const kk: Record<string, string> = { article: "Мақала", news: "Жаңалық", interview: "Сұхбат", announcement: "Хабарландыру" };
  return (locale === "ru" ? articleContentTypeLabels[code] : kk[code]) ?? code;
}

export const articleContentTypeLabels: Record<ArticleContentType, string> = {
  article: "Статья",
  news: "Новость",
  interview: "Интервью",
  announcement: "Анонс",
};
