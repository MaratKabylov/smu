import { z } from "zod";
import { richTextDocumentSchema } from "@/lib/articles/rich-text";

export const accountSections = ["scientist", "articles", "projects", "applications", "research-program"] as const;
export const accountSectionSchema = z.enum(accountSections);
export type AccountSection = z.infer<typeof accountSectionSchema>;
export const accountRecordIdSchema = z.uuid();
export const accountPageSchema = z.number().int().min(1).max(100000);
export function accountPageNumber(value: unknown) {
  const parsed = accountPageSchema.safeParse(typeof value === "string" && /^[1-9][0-9]{0,5}$/.test(value) ? Number(value) : 1);
  return parsed.success ? parsed.data : 1;
}

const recordSchema = z.object({
  id: z.uuid(), kind: z.enum(["scientist", "article", "project", "research", "mentorship_application", "program_application"]),
  title: z.string(), status: z.string(), updatedAt: z.string(), locale: z.enum(["ru", "kk", "en"]).nullable(),
  summary: z.string().nullable(), body: z.string().nullable(),
  content: z.unknown().transform(value => { const result = richTextDocumentSchema.safeParse(value); return result.success ? result.data : null; }),
  relationship: z.enum(["owner", "member", "applicant"]),
});
export const accountRecordsSchema = z.object({ total: z.number().int().nonnegative(), page: accountPageSchema, pageSize: z.literal(20), items: z.array(recordSchema).max(20) });
export type AccountRecord = z.infer<typeof recordSchema>;
export type AccountRecordsPage = z.infer<typeof accountRecordsSchema>;
