import { describe, expect, it } from "vitest";
import {
  articleInputSchema,
  publicArticleFiltersSchema,
  taxonomyInputSchema,
} from "./article";

const validInput = {
  contentType: "article",
  categoryId: "",
  coverMediaId: "",
  tagIds: [],
  ru: {
    title: "Научная статья",
    slug: "nauchnaya-statya",
    excerpt: "Краткое описание научной статьи.",
    body: "Основной текст научной статьи достаточной длины.",
    seoTitle: "",
    seoDescription: "",
  },
  kk: {
    title: "Ғылыми мақала",
    slug: "gylymi-makala",
    excerpt: "Ғылыми мақаланың қысқаша сипаттамасы.",
    body: "Ғылыми мақаланың жеткілікті ұзын негізгі мәтіні.",
    seoTitle: "",
    seoDescription: "",
  },
} as const;

describe("article validation", () => {
  it("accepts two complete translations", () => {
    expect(articleInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects a non-canonical slug", () => {
    const input = {
      ...validInput,
      ru: { ...validInput.ru, slug: "Статья 1" },
    };
    expect(articleInputSchema.safeParse(input).success).toBe(false);
  });

  it("validates bilingual taxonomy items", () => {
    expect(
      taxonomyInputSchema.safeParse({
        kind: "tag",
        slug: "artificial-intelligence",
        nameRu: "Искусственный интеллект",
        nameKk: "Жасанды интеллект",
      }).success,
    ).toBe(true);
  });

  it("rejects duplicate tags", () => {
    const tagId = "f3576689-3d41-43f6-a17d-56bca5d9dc18";
    expect(
      articleInputSchema.safeParse({
        ...validInput,
        tagIds: [tagId, tagId],
      }).success,
    ).toBe(false);
  });

  it("rejects unsafe public filter values", () => {
    expect(
      publicArticleFiltersSchema.safeParse({
        locale: "ru",
        query: "science",
        category: "../../drafts",
        tag: "",
      }).success,
    ).toBe(false);
  });
});
