import type { Tables } from "@/types/database.types";
import { canonicalPublicHref } from "@/lib/i18n/locales";
import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import { requiredFields } from "@/lib/supabase/database";
import { z } from "zod";
import type { ArticleLocale } from "@/types/domain/article";
import { publicationTypes, type Publication, type PublicPublication } from "@/types/domain/publication";
import type { PublicationInput } from "@/lib/validation/publication";
const publicAuthorsSchema = z.array(z.object({ scientistId: z.uuid().nullable(), name: z.string(), affiliation: z.string(), href: z.string().nullable() }));
const publicWorksSchema = z.array(z.object({ id: z.uuid(), kind: z.enum(["research", "project"]), title: z.string(), href: z.string() }));
type PublicationRow = Pick<Tables<"publications">, "id" | "scientist_id" | "title" | "year" | "journal" | "doi" | "url" | "publication_type" | "status" | "updated_at"> & {
  publication_coauthors: Pick<Tables<"publication_coauthors">, "scientist_id" | "name" | "affiliation" | "sort_order">[];
  publication_works: Pick<Tables<"publication_works">, "work_id">[];
};
// Embed child rows in the same database snapshot. Separate bulk reads could
// truncate 100 publications × 30 authors at the API default row limit.
const columns = "id, scientist_id, title, year, journal, doi, url, publication_type, status, updated_at, publication_coauthors(scientist_id, name, affiliation, sort_order), publication_works(work_id)";
function mapPublication(row: PublicationRow): Publication {
  return { id: row.id, scientistId: row.scientist_id, title: row.title, year: row.year,
    journal: row.journal, doi: row.doi, url: row.url, publicationType: row.publication_type,
    status: row.status, updatedAt: row.updated_at, coauthors: [...row.publication_coauthors].sort((a, b) => a.sort_order - b.sort_order).map(a => ({ scientistId: a.scientist_id, name: a.name ?? "", affiliation: a.affiliation })),
    workIds: row.publication_works.map(w => w.work_id).sort() };
}
export class PublicationRepository {
  constructor(private readonly client: DatabaseClient) {}
  async list(): Promise<Publication[]> {
    const { data, error } = await this.client.from("publications").select(columns).is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []).map(mapPublication);
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
    return this.mapPublic(data ?? []);
  }
  async listPublicByWork(locale: ArticleLocale, workId: string): Promise<PublicPublication[]> {
    const { data, error } = await this.client.rpc("list_public_work_publications", { p_locale: locale, p_work: workId });
    if (error) throw error;
    return this.mapPublic(data ?? []);
  }
  private mapPublic(data: import("@/types/database.types").Database["public"]["Functions"]["list_public_publications"]["Returns"]): PublicPublication[] {
    return data.map(value => {
      const row = requiredFields(value, "id", "scientist_id", "title", "year", "journal", "scientist_name", "scientist_href");
      return {
        id: row.id, scientistId: row.scientist_id, title: row.title, year: row.year, journal: row.journal,
        doi: row.doi, url: row.url, publicationType: z.enum(publicationTypes).parse(row.publication_type), scientistName: row.scientist_name, scientistHref: canonicalPublicHref(row.scientist_href),
        authors: publicAuthorsSchema.parse(row.authors ?? []).map(a => ({ ...a, href: a.href ? canonicalPublicHref(a.href) : null })),
        works: publicWorksSchema.parse(row.works ?? []).map(w => ({ ...w, href: canonicalPublicHref(w.href) })),
      };
    });
  }
}
