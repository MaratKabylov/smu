import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import type { Locale } from "@/lib/i18n/locales";
import { searchPageSchema } from "@/lib/search";

export class SearchRepository {
  constructor(private readonly client: DatabaseClient) {}
  async publicPage(locale: Locale, query = "", section = "", filters: Record<string, string> = {}, page = 1) {
    const { data, error } = await this.client.rpc("search_public", {
      p_locale: locale, p_query: query, p_section: section, p_filters: filters, p_page: page, p_page_size: 12,
    });
    if (error) throw error;
    return searchPageSchema.parse(data);
  }
  async adminPage(query: string, section = "", page = 1) {
    const { data, error } = await this.client.rpc("search_admin", { p_query: query, p_section: section, p_page: page, p_page_size: 20 });
    if (error) throw error;
    return searchPageSchema.parse(data);
  }
}
