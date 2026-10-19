import "server-only";
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { saveSiteContentSchema, type SaveSiteContent, type PublicSiteContent } from "@/lib/validation/site-content";
import type { Locale } from "@/lib/i18n/locales";
import { SiteContentRepository } from "@/server/repositories/site-content.repository";
import type { AccessContext } from "@/types/domain/auth";

export function canManageSiteContent(access: AccessContext, settings = false) {
  return access.permissions.has("admin.access") && access.permissions.has(settings ? "settings.manage" : "content.manage");
}
export class SiteContentService {
  async list(access: AccessContext) {
    if (!canManageSiteContent(access) && !canManageSiteContent(access, true)) throw new Error("forbidden");
    return new SiteContentRepository(await createServerSupabaseClient()).list();
  }
  async save(access: AccessContext, value: SaveSiteContent) {
    if (!canManageSiteContent(access, value.kind === "setting")) throw new Error("forbidden");
    const input = saveSiteContentSchema.parse(value);
    return new SiteContentRepository(await createServerSupabaseClient()).save(input);
  }
}
export const getPublicSiteContent = cache(async (locale: Locale, key = ""): Promise<PublicSiteContent> => {
  if (!isSupabaseConfigured()) return { page: null, sections: [], settings: { site_name: "СМУ", contact_email: "", social_links: [] } };
  return new SiteContentRepository(createPublicSupabaseClient()).publicContent(locale, key);
});

export async function getPublicContentPaths() {
  if (!isSupabaseConfigured()) return [];
  return new SiteContentRepository(createPublicSupabaseClient()).publicPaths();
}
