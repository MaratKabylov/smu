import type { Article, ArticleLocale, ArticleRevisionReason, ArticleSnapshot } from "@/types/domain/article";

export const revisionReasonLabels: Record<ArticleRevisionReason, string> = {
  manual: "Создана вручную", review: "Отправка на рецензию",
  publish: "Публикация", before_restore: "Перед восстановлением",
};

export function articleSnapshot(article: Article): ArticleSnapshot {
  function translation(locale: ArticleLocale): Omit<import("@/types/domain/article").ArticleTranslation, "id" | "locale"> {
    const value = article.translations.find(item => item.locale === locale);
    if (!value) return {
      title: "", slug: "", excerpt: "", body: "", contentJson: { type: "doc", content: [] },
      seoTitle: null, seoDescription: null,
    };
    return {
      title: value.title, slug: value.slug, excerpt: value.excerpt, body: value.body,
      contentJson: value.contentJson, seoTitle: value.seoTitle, seoDescription: value.seoDescription,
    };
  }
  return {
    relations: article.relations ?? [],
    contentType: article.contentType, categoryId: article.categoryId, coverMediaId: article.coverMediaId,
    categoryIds: article.categories.map(item => item.id),
    authors: article.authors.map(item => ({ authorId: item.id, role: item.role })),
    tagIds: article.tags.map(tag => tag.id), ru: translation("ru"), kk: translation("kk"),
    ...(article.translations.some(item => item.locale === "en") ? { en: translation("en") } : {}),
  };
}

// JSON key order does not represent an editorial change. Array order does,
// except for the set of tags, which is sorted separately below.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]),
  );
  return value ?? null;
}
export function snapshotComparison(left: ArticleSnapshot, right: ArticleSnapshot, locale: ArticleLocale) {
  const emptyTranslation = { title: "", slug: "", excerpt: "", body: "", contentJson: { type: "doc", content: [] }, seoTitle: null, seoDescription: null };
  const leftTranslation = left[locale] ?? emptyTranslation;
  const rightTranslation = right[locale] ?? emptyTranslation;
  const fields: Array<{ label: string; left: unknown; right: unknown; structured?: boolean }> = [
    { label: "Тип материала", left: left.contentType, right: right.contentType },
    { label: "Категории", left: left.categoryIds ?? (left.categoryId ? [left.categoryId] : []), right: right.categoryIds ?? (right.categoryId ? [right.categoryId] : []) },
    { label: "Связанные научные объекты", left: left.relations ?? [], right: right.relations ?? [] },
    { label: "Авторы и роли", left: left.authors ?? [], right: right.authors ?? [] },
    { label: "Обложка", left: left.coverMediaId, right: right.coverMediaId },
    { label: "Теги", left: [...left.tagIds].sort(), right: [...right.tagIds].sort() },
    ...([
      ["title", "Заголовок"], ["slug", "Адрес (slug)"], ["excerpt", "Краткое описание"],
      ["body", "Текст"], ["seoTitle", "SEO-заголовок"], ["seoDescription", "SEO-описание"],
      ["contentJson", "Форматирование и блоки"],
    ] as const).map(([key, label]) => ({
      label, left: leftTranslation[key], right: rightTranslation[key], structured: key === "contentJson",
    })),
  ];
  return fields.map(field => ({
    ...field,
    changed: JSON.stringify(canonical(field.left)) !== JSON.stringify(canonical(field.right)),
    leftText: display(field.left), rightText: display(field.right),
  }));
}
function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "string" ? value : JSON.stringify(canonical(value), null, 2);
}
