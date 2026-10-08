import "server-only";
import { z } from "zod";
import { locales, publicSections, type Locale, type PublicSection } from "@/lib/i18n/locales";
import type { DatabaseClient } from "@/lib/supabase/database";

const translationSchema = z.object({ locale: z.enum(locales), href: z.string().startsWith("/").refine(value => !value.startsWith("//") && !value.includes("\\")) });
export const seoPageSchema = z.object({
  total: z.number().int().nonnegative(),
  items: z.array(z.object({ id: z.uuid(), section: z.enum(publicSections), updatedAt: z.iso.datetime({ offset: true }), translations: z.array(translationSchema).min(1).max(3) })),
});
export const feedSchema = z.array(z.object({ id: z.uuid(), title: z.string(), summary: z.string(), href: z.string().startsWith("/").refine(value => !value.startsWith("//") && !value.includes("\\")), publishedAt: z.iso.datetime({ offset: true }) }));
export type SeoPage = z.infer<typeof seoPageSchema>;
export type FeedItems = z.infer<typeof feedSchema>;

export class SeoRepository {
  constructor(private readonly client: DatabaseClient) {}
  async page(page = 1, size = 1000, section: PublicSection | "" = "", id: string | null = null) {
    const { data, error } = await this.client.rpc("seo_public_page", { p_page: page, p_page_size: size, p_section: section, p_id: id });
    if (error) throw error;
    return seoPageSchema.parse(data);
  }
  async feed(locale: Locale) {
    const { data, error } = await this.client.rpc("seo_public_feed", { p_locale: locale, p_limit: 50 });
    if (error) throw error;
    return feedSchema.parse(data);
  }
}
