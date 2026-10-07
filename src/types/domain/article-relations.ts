export const articleRelationKinds = ["scientist", "project", "research", "event", "publication"] as const;
export const articleRelationTypes = ["author", "subject", "expert", "mentioned", "reviewer"] as const;
export type ArticleRelationKind = (typeof articleRelationKinds)[number];
export type ArticleRelationType = (typeof articleRelationTypes)[number];
export type ArticleRelationLink = { kind: ArticleRelationKind; entityId: string; relationType: ArticleRelationType };
export type ArticleRelationOption = { kind: ArticleRelationKind; entityId: string; titleRu: string; titleKk: string };
export type PublicRelation = { kind: ArticleRelationKind; entityId: string; title: string; href: string; relationType: ArticleRelationType };
export type RelatedArticle = { id: string; title: string; href: string; excerpt: string; relationType: ArticleRelationType };
export const relationKindLabels = {
  ru: { scientist: "Учёный", project: "Проект", research: "Исследование", event: "Событие", publication: "Научная публикация" },
  kk: { scientist: "Ғалым", project: "Жоба", research: "Зерттеу", event: "Іс-шара", publication: "Ғылыми жарияланым" },
  en: { scientist: "Scientist", project: "Project", research: "Research", event: "Event", publication: "Scientific publication" },
};
export const relationTypeLabels = {
  ru: { author: "Автор", subject: "Предмет материала", expert: "Эксперт", mentioned: "Упоминание", reviewer: "Рецензент" },
  kk: { author: "Автор", subject: "Материал тақырыбы", expert: "Сарапшы", mentioned: "Аталған", reviewer: "Рецензент" },
  en: { author: "Author", subject: "Subject", expert: "Expert", mentioned: "Mentioned", reviewer: "Reviewer" },
};
