import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import type { Locale, PublicSection } from "@/lib/i18n/locales";
import { SeoRepository, type SeoPage } from "@/server/repositories/seo.repository";

export const sitemapPageSize = 1000;
export class SeoService {
  async page(page = 1): Promise<SeoPage> {
    if (!isSupabaseConfigured()) return { total: 0, items: [] };
    return new SeoRepository(createPublicSupabaseClient()).page(page, sitemapPageSize);
  }
  async paths(section: PublicSection, id: string): Promise<Partial<Record<Locale, string>>> {
    if (!isSupabaseConfigured()) return {};
    const result = await new SeoRepository(createPublicSupabaseClient()).page(1, 1, section, id);
    return Object.fromEntries((result.items[0]?.translations ?? []).map(t => [t.locale, t.href]));
  }
  async feed(locale: Locale) {
    if (!isSupabaseConfigured()) return [];
    return new SeoRepository(createPublicSupabaseClient()).feed(locale);
  }
}
