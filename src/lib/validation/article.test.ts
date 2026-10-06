import { describe, expect, it } from "vitest";
import {
  articleInputSchema,
  articleReviewConfigurationSchema,
  articleReviewDecisionSchema,
  publicArticleFiltersSchema,
  taxonomyInputSchema,
  articleAuthorInputSchema,
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
  it("accepts managed types and ordered credit/category selections", () => {
    const first = "f3576689-3d41-43f6-a17d-56bca5d9dc18";
    const second = "f3576689-3d41-43f6-a17d-56bca5d9dc19";
    expect(articleInputSchema.parse({ ...validInput, contentType: "scientific-report", categoryIds: [first, second], authors: [{ authorId: second, role: "translator" }, { authorId: first, role: "author" }] })).toMatchObject({ contentType: "scientific-report", categoryIds: [first, second] });
    expect(taxonomyInputSchema.safeParse({ kind: "type", slug: "scientific-report", nameRu: "Отчёт", nameKk: "Есеп" }).success).toBe(true);
  });
  it("rejects duplicate, excessive or invalid credits and categories", () => {
    const id = "f3576689-3d41-43f6-a17d-56bca5d9dc18";
    for (const patch of [{ categoryIds: [id, id] }, { authors: [{ authorId: id, role: "author" }, { authorId: id, role: "coauthor" }] }, { authors: [{ authorId: id, role: "owner" }] }, { authors: null }, { categoryIds: Array(21).fill(id) }, { contentType: "Invalid type" }]) {
      expect(articleInputSchema.safeParse({ ...validInput, ...patch }).success).toBe(false);
    }
  });
  it("validates bilingual external authors without a user account", () => {
    expect(articleAuthorInputSchema.parse({ profileId: "", nameRu: "Автор", nameKk: "Автор", bioRu: "", bioKk: "", organization: "", position: "", websiteUrl: "", isActive: true })).toMatchObject({ profileId: null, bioRu: null, websiteUrl: null });
  });
  it("rejects unsafe websites and incomplete author translations", () => {
    const input = { profileId: "", nameRu: "Автор", nameKk: "Автор", bioRu: "", bioKk: "", organization: "", position: "", websiteUrl: "https://example.kz", isActive: true };
    for (const patch of [{ nameKk: "" }, { profileId: "unknown" }, { websiteUrl: "javascript:alert(1)" }, { websiteUrl: "file:///local" }]) expect(articleAuthorInputSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
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

  it("validates versioned review configuration and decisions", () => {
    const reviewerId = "f3576689-3d41-43f6-a17d-56bca5d9dc18";
    expect(articleReviewConfigurationSchema.safeParse({ requiresScientificReview: true, reviewerId }).success).toBe(true);
    expect(articleReviewConfigurationSchema.safeParse({ requiresScientificReview: true, reviewerId: "" }).success).toBe(false);
    expect(articleReviewConfigurationSchema.safeParse({ requiresScientificReview: false, reviewerId: "" }).success).toBe(true);
    expect(articleReviewDecisionSchema.parse({ decision: "changes_requested", comment: "  Clarify the method.  " }))
      .toEqual({ decision: "changes_requested", comment: "Clarify the method." });
    expect(articleReviewDecisionSchema.safeParse({ decision: "approved", comment: "" }).success).toBe(false);
  });
});
