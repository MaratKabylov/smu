import { z } from "zod";
import { applicationStatuses, mentorshipFormats, mentorshipStatuses } from "../../types/domain/mentorship";
const slug = z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const translation = z.object({ title: z.string().trim().min(3).max(240), slug,
  summary: z.string().trim().min(20).max(800), description: z.string().trim().min(40).max(20000) });
export const mentorshipStatusSchema = z.enum(mentorshipStatuses);
export const applicationStatusSchema = z.enum(applicationStatuses);
export const mentorshipInputSchema = z.object({ scientistId: z.uuid(), fieldId: z.uuid(), format: z.enum(mentorshipFormats),
  capacity: z.coerce.number().int().min(1).max(50), ru: translation, kk: translation, en: translation.optional() });
export const mentorshipApplicationSchema = z.object({ offerId: z.uuid(), locale: z.enum(["ru", "kk", "en"]),
  fullName: z.string().trim().min(2).max(160), email: z.string().trim().max(254).pipe(z.email()).transform(value => value.toLowerCase()),
  motivation: z.string().trim().min(40).max(5000), consent: z.literal(true), website: z.literal("") });
export const applicationUpdateSchema = z.object({ status: applicationStatusSchema, note: z.string().trim().max(5000) });
export const mentorshipFiltersSchema = z.object({ locale: z.enum(["ru", "kk", "en"]).default("ru"), query: z.string().trim().max(120).default(""),
  field: z.union([z.literal(""), slug]).default(""), format: z.union([z.literal("all"), z.enum(mentorshipFormats)]).default("all") });
export type MentorshipInput = z.infer<typeof mentorshipInputSchema>;
export type MentorshipApplicationInput = z.infer<typeof mentorshipApplicationSchema>;
export type MentorshipFilters = z.infer<typeof mentorshipFiltersSchema>;
