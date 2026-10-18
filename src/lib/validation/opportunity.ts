import { z } from "zod";
import { locales } from "@/lib/i18n/locales";

export const opportunityTypes = ["grant", "conference", "internship", "competition", "open_call", "scholarship", "other"] as const;
export const opportunityStatuses = ["draft", "published", "archived"] as const;
export const opportunityAdminPath = "/admin/opportunities";
export const opportunitySlug = z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const sourceUrl = z.url().min(10).max(2000).refine(value => {
  const url = new URL(value);
  return /^https?:$/.test(url.protocol) && !url.username && !url.password && !/[\s\\]/.test(value);
});
export const opportunityTranslation = z.object({
  locale: z.enum(locales), slug: opportunitySlug,
  title: z.string().trim().min(3).max(240), summary: z.string().trim().min(20).max(800),
  description: z.string().trim().min(40).max(30000), organization: z.string().trim().min(2).max(240),
  funding: z.string().trim().max(1000),
});
export const opportunityInputSchema = z.object({
  id: z.uuid().nullable(), version: z.number().int().positive().nullable(), type: z.enum(opportunityTypes),
  country: z.string().trim().toUpperCase().regex(/^([A-Z]{2})?$/),
  deadline: z.iso.datetime({ offset: true }).nullable(), sourceUrl,
  translations: z.array(opportunityTranslation).min(2).max(3),
}).superRefine((data, ctx) => {
  if ((data.id === null) !== (data.version === null)) ctx.addIssue({ code: "custom", message: "Invalid version" });
  const languages = data.translations.map(t => t.locale);
  if (!languages.includes("ru") || !languages.includes("kk") || new Set(languages).size !== languages.length)
    ctx.addIssue({ code: "custom", message: "Required RU/KK translations" });
});
export type OpportunityInput = z.infer<typeof opportunityInputSchema>;
export const opportunitySchema = z.object({
  id: z.uuid(), type: z.enum(opportunityTypes), country: z.string(), deadline: z.iso.datetime({ offset: true }).nullable(),
  sourceUrl, status: z.enum(opportunityStatuses), publishedAt: z.iso.datetime({ offset: true }).nullable(),
  translations: z.array(opportunityTranslation.extend({ description: z.string() })), version: z.number().int().positive().optional(),
});
export const opportunityPageSchema = z.object({ total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.literal(12), items: z.array(opportunitySchema) });
export type Opportunity = z.infer<typeof opportunitySchema>;
export type OpportunityPage = z.infer<typeof opportunityPageSchema>;
export const opportunityFiltersSchema = z.object({
  q: z.string().trim().max(120).default(""), type: z.enum(["all", ...opportunityTypes]).default("all"),
  country: z.string().trim().toUpperCase().regex(/^([A-Z]{2})?$/).default(""),
  availability: z.enum(["all", "open", "closed"]).default("open"),
  status: z.enum(["all", ...opportunityStatuses]).default("all"),
});
export type OpportunityFilters = z.infer<typeof opportunityFiltersSchema>;
