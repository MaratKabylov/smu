import { z } from "zod";

const optionalId = z.union([z.uuid(), z.literal("")]).default("");
const optionalDate = z.union([z.iso.date().refine(value => value >= "0001-01-01" && value <= "9998-12-31"), z.literal("")]).default("");
export const auditFiltersSchema = z.object({
  entityType: z.string().trim().max(80).default(""),
  action: z.string().trim().max(120).default(""),
  actor: optionalId,
  entityId: optionalId,
  from: optionalDate,
  until: optionalDate,
  page: z.coerce.number().int().min(1).max(10000).default(1),
}).refine(value => !value.from || !value.until || value.from <= value.until);
export type AuditFilters = z.infer<typeof auditFiltersSchema>;
