import { z } from "zod";
export const programParticipantSchema = z.object({ workId: z.uuid(), applicationId: z.uuid(), scientistId: z.uuid() });
export const programProjectsInputSchema = z.object({
  expectedVersion: z.number().int().nonnegative(), workIds: z.array(z.uuid()).max(20),
  participants: z.array(programParticipantSchema).max(500),
}).superRefine((value, ctx) => {
  if (new Set(value.workIds).size !== value.workIds.length || value.participants.some(p => !value.workIds.includes(p.workId))
    || new Set(value.participants.map(p => p.workId + p.applicationId)).size !== value.participants.length
    || new Set(value.participants.map(p => p.workId + p.scientistId)).size !== value.participants.length)
    ctx.addIssue({ code: "custom", message: "Duplicate or invalid project assignment" });
});
export const programProjectOptionSchema = z.object({ id: z.uuid(), title: z.string(), status: z.enum(["draft", "published", "archived"]),
  members: z.array(z.object({ id: z.uuid(), name: z.string() })) });
export const programProjectsSchema = z.object({ version: z.number().int().nonnegative(), workIds: z.array(z.uuid()),
  participants: z.array(programParticipantSchema), applications: z.array(z.object({ id: z.uuid(), name: z.string(), status: z.enum(["accepted", "completed"]) })) });
export const publicProgramProjectSchema = z.object({ id: z.uuid(), title: z.string(), slug: z.string(),
  members: z.array(z.object({ id: z.uuid(), name: z.string(), slug: z.string() })) });
export type ProgramProjectsInput = z.infer<typeof programProjectsInputSchema>;
export type ProgramProjects = z.infer<typeof programProjectsSchema>;
export type ProgramProjectOption = z.infer<typeof programProjectOptionSchema>;
