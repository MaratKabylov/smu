import { z } from "zod";

export const deletedRecordKindSchema = z.enum(["article", "scientist"]);
export const deletedRecordsFiltersSchema = z.object({
  kind: z.enum(["all", "article", "scientist"]).default("all"),
  query: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
// Keep the exact PostgreSQL timestamp: converting to Date loses microseconds.
export const deletionTimestampSchema = z.iso.datetime({ offset: true });
export const restoreDeletedRecordSchema = z.object({
  kind: deletedRecordKindSchema,
  id: z.uuid(),
  expectedDeletedAt: deletionTimestampSchema,
  confirm: z.literal("yes"),
});
export type DeletedRecordsFilters = z.infer<typeof deletedRecordsFiltersSchema>;
