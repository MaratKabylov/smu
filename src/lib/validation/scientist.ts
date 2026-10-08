import { z } from "zod";
import { collaborationKeys, scientistLinkTypes, verificationStatuses } from "../scientists/profile";
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

const safeLinkUrl = z.url().max(500).refine(value => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !/[\s\u0000-\u001f]/.test(value);
  } catch { return false; }
}, "Нужна безопасная HTTP(S)-ссылка.");
export const scientistLinkSchema = z.object({ type: z.enum(scientistLinkTypes), url: safeLinkUrl }).superRefine((value, context) => {
  if (!URL.canParse(value.url)) return;
  const url = new URL(value.url);
  const hosts = { orcid: ["orcid.org"], google_scholar: ["scholar.google.com"], scopus: ["scopus.com", "www.scopus.com"], researchgate: ["researchgate.net", "www.researchgate.net"], linkedin: ["linkedin.com", "www.linkedin.com"], website: [] };
  if (value.type !== "website" && (url.protocol !== "https:" || !hosts[value.type].includes(url.hostname))) context.addIssue({ code: "custom", message: "Ссылка не соответствует выбранному типу." });
  if (value.type === "orcid" && !/^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(value.url)) context.addIssue({ code: "custom", message: "Некорректный ORCID." });
});
export const collaborationSchema = z.partialRecord(z.enum(collaborationKeys), z.boolean());
export const scientistVerificationSchema = z.object({
  status: z.enum(verificationStatuses), expectedVersion: z.coerce.number().int().positive(), note: z.string().trim().max(2000).default(""),
}).refine(value => value.status !== "rejected" || value.note.length >= 10, { message: "Укажите причину отклонения." });
export const scientistMergeSchema = z.object({
  sourceId: z.uuid(), targetId: z.uuid(), sourceVersion: z.coerce.number().int().positive(), targetVersion: z.coerce.number().int().positive(), reason: z.string().trim().min(10).max(2000),
}).refine(value => value.sourceId !== value.targetId);
export const scientistAccountSchema = z.object({ email: z.union([z.literal(""), z.email().max(254)]), expectedVersion: z.coerce.number().int().positive() });
export const scientistInputSchema = z.object({
  expectedContentVersion: z.number().int().positive().optional(),
  isPublic: z.boolean().default(true),
  collaboration: collaborationSchema.default({}),
  links: z.array(scientistLinkSchema).max(6).refine(items => new Set(items.map(item => item.type)).size === items.length).default([]),
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
  status: z.union([z.literal("all"), z.enum([...scientistStatuses, "unverified", "pending", "rejected"])]).default("all"),
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
