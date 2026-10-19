import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import type { Json } from "@/types/database.types";
import { publicContentPathsSchema, publicSiteContentSchema, siteContentCatalogSchema, type SaveSiteContent } from "@/lib/validation/site-content";
import type { Locale } from "@/lib/i18n/locales";

export class SiteContentRepository {
  constructor(private readonly client: DatabaseClient) {}
  async list() {
    const { data, error } = await this.client.rpc("list_site_content");
    if (error) throw error;
    return siteContentCatalogSchema.parse(data);
  }
  async save(input: SaveSiteContent) {
    const { data, error } = await this.client.rpc("save_site_content", {
      p_kind: input.kind, p_key: input.key, p_expected_version: input.version, p_data: input.data as Json,
    });
    if (error) throw error;
    if (typeof data !== "number") throw new Error("invalid_response");
    return data;
  }
  async publicContent(locale: Locale, key = "") {
    const { data, error } = await this.client.rpc("read_public_site_content", { p_locale: locale, p_page_key: key });
    if (error) throw error;
    return publicSiteContentSchema.parse(data);
  }
  async publicPaths() {
    const { data, error } = await this.client.rpc("list_public_content_paths");
    if (error) throw error;
    return publicContentPathsSchema.parse(data);
  }
}
