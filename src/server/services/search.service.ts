import "server-only";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/permissions";
import { emptySearchPage } from "@/lib/search";
import type { Locale } from "@/lib/i18n/locales";
import type { AccessContext } from "@/types/domain/auth";
import { SearchRepository } from "@/server/repositories/search.repository";

export class SearchService {
  async publicPage(locale: Locale, query: string, section = "", page = 1) {
    if (!isSupabaseConfigured() || !query) return emptySearchPage(page);
    return new SearchRepository(createPublicSupabaseClient()).publicPage(locale, query, section, {}, page);
  }
  async adminPage(access: AccessContext, query: string, section = "", page = 1) {
    if (!hasPermission(access, "admin.access")) throw new Error("forbidden");
    if (!query) return emptySearchPage(page, 20);
    return new SearchRepository(await createServerSupabaseClient()).adminPage(query, section, page);
  }
}
