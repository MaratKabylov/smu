import { z } from "zod";
import { scientistStatuses } from "../../types/domain/scientist";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const nullableUuid = z
  .union([z.literal(""), z.uuid()])
  .transform((value) => value || null);

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).transform((value) => value || null);

const optionalUrl = z
  .union([z.literal(""), z.url().max(500)])
  .transform((value) => value || null);

const translationSchema = z.object({
  fullName: z.string().trim().min(3).max(180),
  slug: slugSchema,
  position: z.string().trim().min(2).max(180),
  academicDegree: optionalText(180),
  shortBio: z.string().trim().min(20).max(600),
  biography: z.string().trim().min(40).max(20_000),
});

export const scientistInputSchema = z.object({
  organizationId: nullableUuid,
  avatarMediaId: nullableUuid,
  fieldIds: z.array(z.uuid()).max(20).refine((items) => new Set(items).size === items.length),
  publicEmail: z.union([z.literal(""), z.email().max(254)]).transform((value) => value || null),
  orcid: z.union([z.literal(""), z.string().trim().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/)]).transform((value) => value || null),
  scholarUrl: optionalUrl,
  ru: translationSchema,
  kk: translationSchema,
  en: translationSchema.optional(),
});

export const scientistListFiltersSchema = z.object({
  query: z.string().trim().max(120).default(""),
  status: z.union([z.literal("all"), z.enum(scientistStatuses)]).default("all"),
});

export const publicScientistFiltersSchema = z.object({
  locale: z.enum(["ru", "kk", "en"]).default("ru"),
  query: z.string().trim().max(120).default(""),
  organization: z.union([z.literal(""), slugSchema]).default(""),
  field: z.union([z.literal(""), slugSchema]).default(""),
});

export const scientistStatusSchema = z.enum(scientistStatuses);

export const scientistTaxonomyInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("field"),
    slug: slugSchema,
    nameRu: z.string().trim().min(2).max(140),
    nameKk: z.string().trim().min(2).max(140),
    nameEn: optionalText(140).optional().default(null),
  }),
  z.object({
    kind: z.literal("organization"),
    slug: slugSchema,
    nameRu: z.string().trim().min(2).max(200),
    nameKk: z.string().trim().min(2).max(200),
    nameEn: optionalText(200).optional().default(null),
    cityRu: optionalText(120),
    cityKk: optionalText(120),
    cityEn: optionalText(120).optional().default(null),
    websiteUrl: optionalUrl,
  }).refine(value => value.nameEn !== null || value.cityEn === null, { message: "Для английского города нужно английское название." }),
]);

export type ScientistInput = z.infer<typeof scientistInputSchema>;
export type ScientistListFilters = z.infer<typeof scientistListFiltersSchema>;
export type PublicScientistFilters = z.infer<typeof publicScientistFiltersSchema>;
export type ScientistTaxonomyInput = z.infer<typeof scientistTaxonomyInputSchema>;
