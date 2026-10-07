import type { Tables } from "@/types/database.types";
import { canonicalPublicHref } from "@/lib/i18n/locales";
import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import { requiredFields } from "@/lib/supabase/database";
import { z } from "zod";
import type { ArticleLocale } from "@/types/domain/article";
import { publicationTypes, type Publication, type PublicPublication } from "@/types/domain/publication";
import type { PublicationInput } from "@/lib/validation/publication";
type PublicationRow = Pick<Tables<"publications">, "id" | "scientist_id" | "title" | "year" | "journal" | "doi" | "url" | "publication_type" | "status" | "updated_at">;
const columns = "id, scientist_id, title, year, journal, doi, url, publication_type, status, updated_at";
function mapPublication(row: PublicationRow): Publication {
  return { id: row.id, scientistId: row.scientist_id, title: row.title, year: row.year,
    journal: row.journal, doi: row.doi, url: row.url, publicationType: row.publication_type,
    status: row.status, updatedAt: row.updated_at };
}
export class PublicationRepository {
  constructor(private readonly client: DatabaseClient) {}
  async list(): Promise<Publication[]> {
    const { data, error } = await this.client.from("publications").select(columns).is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
    if (error) throw error;
    return ((data ?? [])).map(mapPublication);
  }
  async getById(id: string): Promise<Publication | null> {
    const { data, error } = await this.client.from("publications").select(columns).eq("id", id).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    return data ? mapPublication(data) : null;
  }
  async save(id: string | null, input: PublicationInput): Promise<string> {
    const { data, error } = await this.client.rpc("save_publication", { p_id: id, p_input: input });
    if (error) throw error;
    if (data === null) throw new Error("Missing database result");
    return data;
  }
  async listPublic(locale: ArticleLocale, id: string | null = null, scientistId: string | null = null): Promise<PublicPublication[]> {
    const { data, error } = await this.client.rpc("list_public_publications", { p_locale: locale, p_id: id, p_scientist: scientistId });
    if (error) throw error;
    return (data ?? []).map(value => {
      const row = requiredFields(value, "id", "scientist_id", "title", "year", "journal", "scientist_name", "scientist_href");
      return {
        id: row.id, scientistId: row.scientist_id, title: row.title, year: row.year, journal: row.journal,
        doi: row.doi, url: row.url, publicationType: z.enum(publicationTypes).parse(row.publication_type), scientistName: row.scientist_name, scientistHref: canonicalPublicHref(row.scientist_href),
      };
    });
  }
}
