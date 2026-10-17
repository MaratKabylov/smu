import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import type { Locale } from "@/lib/i18n/locales";
import { legacyOwnerPageSchema, legacyPublicPageSchema, type LegacyInput } from "@/lib/validation/scientific-legacy";
import { z } from "zod";

export class ScientificLegacyRepository {
  constructor(private readonly client: DatabaseClient) {}
  private async read(locale: Locale, page: number, id: string | null, own: boolean, kind = "all") {
    const { data, error } = await this.client.rpc("list_scientific_legacy", { p_locale: locale, p_page: page, p_id: id, p_own: own, p_kind: kind });
    if (error) throw error;
    return data;
  }
  async own(locale: Locale, page: number, id: string | null = null) { return legacyOwnerPageSchema.parse(await this.read(locale, page, id, true)); }
  async public(locale: Locale, page: number, id: string | null = null, kind = "all") { return legacyPublicPageSchema.parse(await this.read(locale, page, id, false, kind)); }
  async save(input: LegacyInput) {
    const { data, error } = await this.client.rpc("save_scientific_legacy", { p_input: input });
    if (error) throw error;
    return z.uuid().parse(data);
  }
  async consent(id: string, version: number, granted: boolean) {
    const { error } = await this.client.rpc("set_scientific_legacy_consent", { p_id: id, p_version: version, p_granted: granted });
    if (error) throw error;
  }
}
