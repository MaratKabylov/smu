import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "@/lib/supabase/database";
import type { Locale } from "@/lib/i18n/locales";
import { homeCardSchema } from "@/lib/homepage";
export class HomepageRepository {
  constructor(private readonly client: DatabaseClient) {}
  async events(locale: Locale, limit: number) {
    const { data, error } = await this.client.rpc("list_homepage_events", { p_locale: locale, p_limit: limit });
    if (error) throw error;
    return z.array(homeCardSchema).max(12).parse(data);
  }
  async results(locale: Locale, limit: number) {
    const { data, error } = await this.client.rpc("list_homepage_results", { p_locale: locale, p_limit: limit });
    if (error) throw error;
    return z.array(homeCardSchema).max(12).parse(data);
  }
}
