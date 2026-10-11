import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "@/lib/supabase/database";
import { researchOutputInputSchema, publicResearchOutputSchema, type ResearchOutputInput } from "@/lib/validation/research-output";
import type { ArticleLocale } from "@/types/domain/article";

export class ResearchOutputRepository {
  constructor(private readonly client: DatabaseClient) {}
  async list() {
    const { data, error } = await this.client.from("research_outputs")
      .select("id,owner_id,status,version,kind,updated_at,research_output_versions(version,snapshot,created_at)")
      .order("updated_at", { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []).map(row => {
      const snapshot = row.research_output_versions.find(v => v.version === row.version)?.snapshot;
      return { id: row.id, ownerId: row.owner_id, version: row.version, input: researchOutputInputSchema.parse({
        ...(snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : {}), status: row.status, expectedVersion: row.version,
      }) };
    });
  }
  async get(id: string) {
    const { data, error } = await this.client.from("research_outputs")
      .select("id,owner_id,status,version,research_output_versions(version,snapshot,created_at)").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, ownerId: data.owner_id, version: data.version, versions: data.research_output_versions
      .sort((a, b) => b.version - a.version).map(v => ({ version: v.version, createdAt: v.created_at,
        input: researchOutputInputSchema.parse({ ...(v.snapshot as Record<string, unknown>), status: data.status, expectedVersion: data.version }) })) };
  }
  async save(id: string | null, input: ResearchOutputInput) {
    const { data, error } = await this.client.rpc("save_research_output", { p_id: id, p_input: input });
    if (error) throw error;
    if (!data) throw new Error("Missing database result");
    return data;
  }
  async uploads(actor: string, selectedIds: string[] = []) {
    const own = await this.client.from("research_output_uploads").select("id,file_name,file_size,mime_type")
      .eq("uploaded_by", actor).eq("ready", true).order("created_at", { ascending: false }).limit(100);
    if (own.error) throw own.error;
    if (!selectedIds.length) return own.data ?? [];
    const selected = await this.client.from("research_output_uploads").select("id,file_name,file_size,mime_type").in("id", selectedIds);
    if (selected.error) throw selected.error;
    return [...new Map([...(own.data ?? []), ...(selected.data ?? [])].map(f => [f.id, f])).values()];
  }
  async workOptions(query = "", ids: string[] | null = null) {
    const { data, error } = await this.client.rpc("research_output_work_options", { p_query: query, p_ids: ids });
    if (error) throw error;
    return z.array(z.object({ id: z.uuid(), title: z.string(), kind: z.enum(["research", "project"]), status: z.enum(["draft", "published", "archived"]) })).parse(data ?? []);
  }
  async publicByWork(locale: ArticleLocale, workId: string) {
    const { data, error } = await this.client.rpc("list_public_research_outputs", { p_locale: locale, p_work_id: workId });
    if (error) throw error;
    return z.array(publicResearchOutputSchema).parse(data ?? []);
  }
  async resolveFile(id: string, version: number, fileId: string) {
    const { data, error } = await this.client.rpc("resolve_research_output_file", { p_output_id: id, p_version: version, p_upload_id: fileId });
    if (error) throw error;
    return data ? z.object({ path: z.string(), name: z.string() }).parse(data) : null;
  }
}
