import "server-only";
import { canAccessAdmin, canDeleteArticle, canEditScientist } from "@/lib/permissions/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deletedRecordsFiltersSchema, purgeDeletedRecordSchema, type DeletedRecordsFilters, type PurgeDeletedRecordInput } from "@/lib/validation/deleted-records";
import { DeletedRecordsRepository } from "@/server/repositories/deleted-records.repository";
import type { AccessContext } from "@/types/domain/auth";

export function canViewDeletedRecords(access: AccessContext) {
  return canAccessAdmin(access) && (canDeleteArticle(access) || canEditScientist(access));
}
export function canPurgeDeletedRecords(access: AccessContext) {
  return canAccessAdmin(access) && access.roles.has("super_admin");
}
export class DeletedRecordsService {
  async purge(access: AccessContext, input: PurgeDeletedRecordInput) {
    if (!canPurgeDeletedRecords(access)) throw new Error("forbidden");
    const parsed = purgeDeletedRecordSchema.parse(input);
    return new DeletedRecordsRepository(await createServerSupabaseClient()).purge(parsed);
  }
  async list(access: AccessContext, filters: DeletedRecordsFilters) {
    if (!canViewDeletedRecords(access) ||
      (filters.kind === "article" && !canDeleteArticle(access)) ||
      (filters.kind === "scientist" && !canEditScientist(access))) throw new Error("forbidden");
    const parsed = deletedRecordsFiltersSchema.parse(filters);
    return new DeletedRecordsRepository(await createServerSupabaseClient()).list(parsed);
  }
}
