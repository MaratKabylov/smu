import { z } from "zod";
import { applicationStatuses, researchProgramStatuses } from "@/types/domain/research-program";
import { publicResearchOutputSchema } from "./research-output";

const locale = z.enum(["ru", "kk", "en"]);
const participationStatus = z.enum(["active", "completed"]);
export const programMentorInputSchema = z.object({
  applicationId: z.uuid(), mentorId: z.uuid().nullable(), expectedVersion: z.coerce.number().int().positive(),
});
export const managedParticipationSchema = z.object({ status: participationStatus, mentorId: z.uuid().nullable(), version: z.number().int().positive() });
export type ManagedParticipation = z.infer<typeof managedParticipationSchema>;
export const accountResearchProgramSchema = z.object({
  applicationStatus: z.enum(applicationStatuses),
  program: z.object({ title: z.string(), locale: locale.nullable(), status: z.enum(researchProgramStatuses),
    applicationsOpenOn: z.iso.date(), applicationDeadline: z.iso.date(), startsOn: z.iso.date(), endsOn: z.iso.date(), curriculum: z.string() }),
  participation: z.object({ status: participationStatus, createdAt: z.string(), baseline: z.boolean(), mentorAssigned: z.boolean(),
    mentor: z.object({ name: z.string(), locale, slug: z.string() }).nullable() }).nullable(),
  projects: z.array(z.object({ id: z.uuid(), title: z.string(), locale: locale.nullable(), status: z.enum(["draft", "published", "archived"]),
    summary: z.string(), outputs: z.array(publicResearchOutputSchema) })).max(20),
});
export type AccountResearchProgram = z.infer<typeof accountResearchProgramSchema>;
