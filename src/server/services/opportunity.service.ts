import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import type { Locale } from "@/lib/i18n/locales";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { opportunityFiltersSchema, opportunityInputSchema, type OpportunityFilters, type OpportunityInput, type OpportunityPage, type opportunityStatuses } from "@/lib/validation/opportunity";
import { OpportunityRepository } from "@/server/repositories/opportunity.repository";
import type { AccessContext } from "@/types/domain/auth";

export function canManageOpportunities(access: AccessContext) {
  return access.permissions.has("admin.access") && access.permissions.has("opportunities.manage");
}
export class OpportunityService {
  private assertAccess(access: AccessContext) {
    if (!canManageOpportunities(access)) throw new Error("forbidden");
  }
  async list(access: AccessContext, filters: OpportunityFilters, page = 1, id: string | null = null) {
    this.assertAccess(access);
    return new OpportunityRepository(await createServerSupabaseClient()).list("ru", filters, page, true, id);
  }
  async save(access: AccessContext, input: OpportunityInput) {
    this.assertAccess(access);
    return new OpportunityRepository(await createServerSupabaseClient()).save(opportunityInputSchema.parse(input));
  }
  async changeStatus(access: AccessContext, id: string, version: number, status: typeof opportunityStatuses[number]) {
    this.assertAccess(access);
    return new OpportunityRepository(await createServerSupabaseClient()).changeStatus(id, version, status);
  }
}
export class PublicOpportunityService {
  async list(locale: Locale, filters: OpportunityFilters, page = 1): Promise<OpportunityPage> {
    if (!isSupabaseConfigured()) return { total: 0, page, pageSize: 12, items: [] };
    return new OpportunityRepository(createPublicSupabaseClient()).list(locale, filters, page);
  }
  async get(locale: Locale, slug: string) {
    if (!isSupabaseConfigured()) return null;
    const result = await new OpportunityRepository(createPublicSupabaseClient()).list(locale, opportunityFiltersSchema.parse({ availability: "all" }), 1, false, null, slug);
    return result.items[0] ?? null;
  }
}
export const getPublicOpportunity = cache((locale: Locale, slug: string) => new PublicOpportunityService().get(locale, slug));
