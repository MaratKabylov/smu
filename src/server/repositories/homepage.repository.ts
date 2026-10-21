import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "@/lib/supabase/database";
import type { Locale } from "@/lib/i18n/locales";
import { homeCardSchema, type HomepageStats } from "@/lib/homepage";
export class HomepageRepository {
  constructor(private readonly client: DatabaseClient) {}
  async metrics(): Promise<HomepageStats> {
    const [scientists, researchProjects, partners] = await Promise.all([
      this.client.from("scientist_profiles").select("id", { count: "exact", head: true })
        .eq("status", "verified").eq("is_public", true).is("deleted_at", null),
      this.client.from("science_works").select("id", { count: "exact", head: true })
        .eq("kind", "project").eq("status", "published").is("deleted_at", null),
      this.client.from("scientific_organizations").select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);
    for (const result of [scientists, researchProjects, partners]) if (result.error) throw result.error;
    return {
      scientists: scientists.count ?? 0,
      researchProjects: researchProjects.count ?? 0,
      partners: partners.count ?? 0,
    };
  }
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
