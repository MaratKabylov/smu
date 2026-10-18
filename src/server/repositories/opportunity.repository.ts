import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import type { Locale } from "@/lib/i18n/locales";
import { opportunityPageSchema, type OpportunityFilters, type OpportunityInput, type opportunityStatuses } from "@/lib/validation/opportunity";

export class OpportunityRepository {
  constructor(private readonly client: DatabaseClient) {}
  async list(locale: Locale, filters: OpportunityFilters, page = 1, manage = false, id: string | null = null, slug: string | null = null) {
    const { data, error } = await this.client.rpc("list_opportunities", { p_locale: locale, p_page: page, p_id: id, p_slug: slug, p_manage: manage, p_filters: filters });
    if (error) throw error;
    return opportunityPageSchema.parse(data);
  }
  async save(input: OpportunityInput) {
    const { data, error } = await this.client.rpc("save_opportunity", { p_input: input });
    if (error) throw error;
    if (!data) throw new Error("Missing database result");
    return data;
  }
  async changeStatus(id: string, version: number, status: typeof opportunityStatuses[number]) {
    const { error } = await this.client.rpc("change_opportunity_status", { p_id: id, p_version: version, p_status: status });
    if (error) throw error;
  }
}
