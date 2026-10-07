import { z } from "zod";
import { scienceWorkKinds, scienceWorkStages, scienceWorkStatuses } from "../../types/domain/science-work";

const slug = z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const nullableUuid = z.union([z.literal(""), z.uuid()]).transform(value => value || null);
const date = z.union([z.literal(""), z.iso.date()]).transform(value => value || null);
const translation = z.object({
  title: z.string().trim().min(3).max(240),
  slug,
  summary: z.string().trim().min(20).max(800),
  description: z.string().trim().min(40).max(30_000),
  results: z.string().trim().max(20_000),
});
export const scienceWorkKindSchema = z.enum(scienceWorkKinds);
export const scienceWorkStatusSchema = z.enum(scienceWorkStatuses);
export const scienceWorkInputSchema = z.object({
  stage: z.enum(scienceWorkStages),
  organizationId: nullableUuid,
  fieldId: z.uuid(),
  coverMediaId: nullableUuid,
  startDate: date,
  endDate: date,
  externalUrl: z.union([z.literal(""), z.url().max(500).refine(value => /^https?:\/\//i.test(value))]).transform(value => value || null),
  doi: z.union([z.literal(""), z.string().trim().max(200).regex(/^10\.\d{4,9}\/\S+$/)]).transform(value => value || null),
  leadScientistId: nullableUuid,
  memberIds: z.array(z.uuid()).max(50).refine(ids => new Set(ids).size === ids.length),
  ru: translation,
  kk: translation,
  en: translation.optional(),
}).superRefine((value, context) => {
  if (value.startDate && value.endDate && value.endDate < value.startDate)
    context.addIssue({ code: "custom", path: ["endDate"], message: "Дата окончания раньше даты начала." });
  if (value.leadScientistId && value.memberIds.includes(value.leadScientistId))
    context.addIssue({ code: "custom", path: ["memberIds"], message: "Руководитель уже включён в команду." });
});
export const scienceWorkListFiltersSchema = z.object({
  query: z.string().trim().max(120).default(""),
  status: z.union([z.literal("all"), scienceWorkStatusSchema]).default("all"),
});
export const publicScienceWorkFiltersSchema = z.object({
  locale: z.enum(["ru", "kk", "en"]).default("ru"),
  query: z.string().trim().max(120).default(""),
  field: z.union([z.literal(""), slug]).default(""),
  organization: z.union([z.literal(""), slug]).default(""),
  stage: z.union([z.literal("all"), z.enum(scienceWorkStages)]).default("all"),
});
export type ScienceWorkInput = z.infer<typeof scienceWorkInputSchema>;
export type ScienceWorkListFilters = z.infer<typeof scienceWorkListFiltersSchema>;
export type PublicScienceWorkFilters = z.infer<typeof publicScienceWorkFiltersSchema>;
