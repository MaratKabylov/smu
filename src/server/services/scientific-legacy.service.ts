import "server-only";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { isLocale, type Locale } from "@/lib/i18n/locales";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { accountPageSchema } from "@/lib/validation/account-records";
import { legacyInputSchema, legacyKindSchema } from "@/lib/validation/scientific-legacy";
import { ScientificLegacyRepository } from "@/server/repositories/scientific-legacy.repository";

export class ScientificLegacyError extends Error {
  constructor(public readonly code: "invalid" | "session" | "setup") { super(code); }
}
export class ScientificLegacyService {
  private validate(locale: Locale, page: number, id: string | null) {
    if (!isLocale(locale) || !accountPageSchema.safeParse(page).success || (id !== null && !z.uuid().safeParse(id).success)) throw new ScientificLegacyError("invalid");
  }
  private async session() {
    if (!isSupabaseConfigured()) throw new ScientificLegacyError("setup");
    const client = await createServerSupabaseClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user?.email || !user.email_confirmed_at || user.is_anonymous) throw new ScientificLegacyError("session");
    return new ScientificLegacyRepository(client);
  }
  async own(locale: Locale, page = 1, id: string | null = null) {
    this.validate(locale, page, id);
    return (await this.session()).own(locale, page, id);
  }
  async public(locale: Locale, page = 1, id: string | null = null, kind = "all") {
    this.validate(locale, page, id);
    if (kind !== "all" && !legacyKindSchema.safeParse(kind).success) throw new ScientificLegacyError("invalid");
    if (!isSupabaseConfigured()) return { total: 0, page, pageSize: 20 as const, items: [] };
    // This RPC intentionally stays outside the shared Data Cache: consent is read fresh.
    return new ScientificLegacyRepository(createPublicSupabaseClient()).public(locale, page, id, kind);
  }
  async save(input: unknown) {
    const parsed = legacyInputSchema.safeParse(input);
    if (!parsed.success) throw new ScientificLegacyError("invalid");
    return (await this.session()).save(parsed.data);
  }
  async consent(id: string, version: number, granted: boolean) {
    if (!z.uuid().safeParse(id).success || !z.number().int().positive().safeParse(version).success || typeof granted !== "boolean") throw new ScientificLegacyError("invalid");
    return (await this.session()).consent(id, version, granted);
  }
}
