import { z } from "zod";
import { applicationStatuses, researchProgramFormats, researchProgramStatuses } from "../../types/domain/research-program";
const slug = z.string().trim().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const translation = z.object({ title: z.string().trim().min(3).max(240), slug,
  summary: z.string().trim().min(20).max(800), description: z.string().trim().min(40).max(20000),
  curriculum: z.string().trim().min(20).max(10000), eligibility: z.string().trim().min(20).max(5000),
  outcomes: z.string().trim().min(20).max(10000) });
export const researchProgramStatusSchema = z.enum(researchProgramStatuses);
export const applicationStatusSchema = z.enum(applicationStatuses);
export const researchProgramInputSchema = z.object({ coordinatorId: z.uuid(), fieldId: z.uuid(), format: z.enum(researchProgramFormats),
  capacity: z.coerce.number().int().min(1).max(500),
  applicationsOpenOn: z.iso.date(), applicationDeadline: z.iso.date(), startsOn: z.iso.date(), endsOn: z.iso.date(),
  ru: translation, kk: translation }).refine(value =>
    value.applicationsOpenOn <= value.applicationDeadline && value.applicationDeadline <= value.startsOn && value.startsOn <= value.endsOn,
    { message: "Проверьте последовательность дат набора и проведения программы.", path: ["applicationDeadline"] });
export const researchProgramApplicationSchema = z.object({ programId: z.uuid(), locale: z.enum(["ru", "kk"]),
  fullName: z.string().trim().min(2).max(160), email: z.string().trim().max(254).pipe(z.email()).transform(value => value.toLowerCase()),
  motivation: z.string().trim().min(40).max(5000), consent: z.literal(true), website: z.literal("") });
export const applicationUpdateSchema = z.object({ status: applicationStatusSchema, note: z.string().trim().max(5000) });
export const researchProgramFiltersSchema = z.object({ locale: z.enum(["ru", "kk"]).default("ru"), query: z.string().trim().max(120).default(""),
  field: z.union([z.literal(""), slug]).default(""), format: z.union([z.literal("all"), z.enum(researchProgramFormats)]).default("all") });
export type ResearchProgramInput = z.infer<typeof researchProgramInputSchema>;
export type ResearchProgramApplicationInput = z.infer<typeof researchProgramApplicationSchema>;
export type ResearchProgramFilters = z.infer<typeof researchProgramFiltersSchema>;
