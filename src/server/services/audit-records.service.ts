import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditFiltersSchema, type AuditFilters } from "@/lib/validation/audit";
import { AuditRecordsRepository } from "@/server/repositories/audit-records.repository";
import type { AccessContext } from "@/types/domain/auth";

export function canViewAudit(access: AccessContext) {
  return access.permissions.has("admin.access") && access.permissions.has("audit.read");
}
export class AuditRecordsService {
  async list(access: AccessContext, filters: AuditFilters) {
    if (!canViewAudit(access)) throw new Error("forbidden");
    const parsed = auditFiltersSchema.parse(filters);
    return new AuditRecordsRepository(await createServerSupabaseClient()).list(parsed);
  }
}
