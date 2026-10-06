import "server-only";
import { canAccessAdmin, canDeleteArticle, canEditScientist } from "@/lib/permissions/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deletedRecordsFiltersSchema, type DeletedRecordsFilters } from "@/lib/validation/deleted-records";
import { DeletedRecordsRepository } from "@/server/repositories/deleted-records.repository";
import type { AccessContext } from "@/types/domain/auth";

export function canViewDeletedRecords(access: AccessContext) {
  return canAccessAdmin(access) && (canDeleteArticle(access) || canEditScientist(access));
}
export class DeletedRecordsService {
  async list(access: AccessContext, filters: DeletedRecordsFilters) {
    if (!canViewDeletedRecords(access) ||
      (filters.kind === "article" && !canDeleteArticle(access)) ||
      (filters.kind === "scientist" && !canEditScientist(access))) throw new Error("forbidden");
    const parsed = deletedRecordsFiltersSchema.parse(filters);
    return new DeletedRecordsRepository(await createServerSupabaseClient()).list(parsed);
  }
}
