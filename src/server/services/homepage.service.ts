import "server-only";
import { cache } from "react";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { getPublicSiteContent } from "@/server/services/site-content.service";
import { SearchRepository } from "@/server/repositories/search.repository";
import { HomepageRepository } from "@/server/repositories/homepage.repository";
import { homeCatalogs, type Homepage, type HomeCard } from "@/lib/homepage";
import type { Locale } from "@/lib/i18n/locales";
import { isSupabaseConfigured } from "@/lib/env";

export const getPublicHomepage = cache(async (locale: Locale): Promise<Homepage> => {
  const content = await getPublicSiteContent(locale);
  if (!isSupabaseConfigured()) return { settings: content.settings, sections: [], stats: { scientists: 0, researchProjects: 0, partners: 0 } };
  const client = createPublicSupabaseClient();
  const homepageRepository = new HomepageRepository(client);
  const [stats, sections] = await Promise.all([homepageRepository.metrics(), Promise.all(content.sections.map(async section => {
    const catalog = homeCatalogs[section.key];
    let items: HomeCard[] = [];
    if (section.key === "events") {
      items = await homepageRepository.events(locale, section.display_limit);
    } else if (catalog) {
      const filters: Record<string, string> = section.key === "opportunities" ? { availability: "open" } : {};
      const page = await new SearchRepository(client).publicPage(locale, "", catalog, filters);
      items = page.items.flatMap(item => item.href ? [{ id: item.id, title: item.title, summary: item.summary, href: item.href }] : []).slice(0, section.display_limit);
    } else if (section.key === "results") {
      items = await homepageRepository.results(locale, section.display_limit);
    } else if (section.key === "partners") {
      const { page } = await getPublicSiteContent(locale, "partners");
      if (page) items = [{ id: "partners", title: page.title, summary: page.summary, href: `/${locale}/pages/partners` }];
    }
    return { ...section, items };
  }))]);
  return { settings: content.settings, sections, stats };
});
