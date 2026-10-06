import { z } from "zod";
import { articleRelationKinds, articleRelationTypes } from "../../types/domain/article-relations";
import { plainTextDocument, richTextDocumentSchema, richTextToPlainText } from "../articles/rich-text";
import { articleAuthorRoles, articleReviewDecisions, articleStatuses } from "../../types/domain/article";

const nullableUuid = z
  .union([z.literal(""), z.uuid()])
  .transform((value) => value || null);

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .transform((value) => value || null);

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const translationSchema = z.object({
  title: z.string().trim().min(3).max(240),
  slug: slugSchema,
  excerpt: z.string().trim().min(10).max(1_000),
  body: z.string().max(200_000),
  contentJson: richTextDocumentSchema.optional(),
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
}).transform(value => {
  const contentJson = value.contentJson ?? plainTextDocument(value.body);
  return { ...value, contentJson, body: richTextToPlainText(contentJson) };
}).refine(value => value.body.trim().length >= 20 && value.body.length <= 200_000, { message: "Основной текст должен содержать от 20 до 200000 символов." });

export const articleInputSchema = z.object({
  relations: z.array(z.object({ kind: z.enum(articleRelationKinds), entityId: z.uuid(), relationType: z.enum(articleRelationTypes) }))
    .max(50).refine(items => new Set(items.map(item => `${item.kind}:${item.entityId}`)).size === items.length).optional(),
  expectedVersion: z.number().int().positive().optional(),
  contentType: slugSchema,
  categoryId: nullableUuid.default(""),
  categoryIds: z.array(z.uuid()).max(20).refine(items => new Set(items).size === items.length).optional(),
  authors: z.array(z.object({ authorId: z.uuid(), role: z.enum(articleAuthorRoles) }))
    .max(20).refine(items => new Set(items.map(item => item.authorId)).size === items.length).optional(),
  coverMediaId: nullableUuid,
  tagIds: z
    .array(z.uuid())
    .max(30)
    .refine((items) => new Set(items).size === items.length),
  ru: translationSchema,
  kk: translationSchema,
});

export const articleListFiltersSchema = z.object({
  query: z.string().trim().max(120).default(""),
  status: z.union([z.literal("all"), z.enum(articleStatuses)]).default("all"),
});

export const articleStatusSchema = z.enum(articleStatuses);

export const articleScheduleTimestampSchema = z.iso.datetime({ offset: true })
  .transform(value => new Date(value).toISOString());

export const articleScheduleFormSchema = z.iso.datetime({ local: true, precision: -1 })
  .refine(value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
  .transform(value => new Date(`${value}:00+05:00`).toISOString());

export const articleScheduleInputSchema = z.object({
  expectedVersion: z.number().int().positive(),
  scheduledAt: articleScheduleTimestampSchema.nullable(),
  expectedScheduledAt: articleScheduleTimestampSchema.nullable(),
});
export type ArticleScheduleInput = z.infer<typeof articleScheduleInputSchema>;

export const articleReviewConfigurationSchema = z.object({
  requiresScientificReview: z.boolean(),
  reviewerId: nullableUuid,
}).refine(value => !value.requiresScientificReview || value.reviewerId !== null, {
  message: "Для обязательной научной рецензии нужен рецензент.",
});

export const articleReviewDecisionSchema = z.object({
  decision: z.enum(articleReviewDecisions),
  comment: z.string().trim().min(3).max(5_000),
});

export const taxonomyInputSchema = z.object({
  kind: z.enum(["category", "tag", "type"]),
  slug: slugSchema,
  nameRu: z.string().trim().min(2).max(120),
  nameKk: z.string().trim().min(2).max(120),
});

export const taxonomyUpdateSchema = taxonomyInputSchema.extend({
  id: z.uuid(), isActive: z.boolean(),
});

export const articleAuthorInputSchema = z.object({
  profileId: nullableUuid,
  nameRu: z.string().trim().min(2).max(160),
  nameKk: z.string().trim().min(2).max(160),
  bioRu: optionalText(2000), bioKk: optionalText(2000),
  organization: optionalText(240), position: optionalText(240),
  websiteUrl: z.union([z.literal(""), z.url().max(500).refine(value => /^https?:\/\//i.test(value))])
    .transform(value => value || null),
  isActive: z.boolean(),
});
export type ArticleAuthorInput = z.infer<typeof articleAuthorInputSchema>;
export type TaxonomyUpdateInput = z.infer<typeof taxonomyUpdateSchema>;
export type ArticleReviewConfigurationInput = z.infer<typeof articleReviewConfigurationSchema>;
export type ArticleReviewDecisionInput = z.infer<typeof articleReviewDecisionSchema>;

export const publicArticleFiltersSchema = z.object({
  locale: z.enum(["ru", "kk"]).default("ru"),
  query: z.string().trim().max(120).default(""),
  category: z.union([z.literal(""), slugSchema]).default(""),
  tag: z.union([z.literal(""), slugSchema]).default(""),
});

export type ArticleInput = z.infer<typeof articleInputSchema>;
export type ArticleListFilters = z.infer<typeof articleListFiltersSchema>;
export type TaxonomyInput = z.infer<typeof taxonomyInputSchema>;
export type PublicArticleFilters = z.infer<typeof publicArticleFiltersSchema>;
