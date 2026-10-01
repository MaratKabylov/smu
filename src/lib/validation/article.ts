import { z } from "zod";
import { articleContentTypes, articleStatuses } from "../../types/domain/article";

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
  body: z.string().trim().min(20).max(200_000),
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
});

export const articleInputSchema = z.object({
  contentType: z.enum(articleContentTypes),
  categoryId: nullableUuid,
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

export const taxonomyInputSchema = z.object({
  kind: z.enum(["category", "tag"]),
  slug: slugSchema,
  nameRu: z.string().trim().min(2).max(120),
  nameKk: z.string().trim().min(2).max(120),
});

export type ArticleInput = z.infer<typeof articleInputSchema>;
export type ArticleListFilters = z.infer<typeof articleListFiltersSchema>;
export type TaxonomyInput = z.infer<typeof taxonomyInputSchema>;
