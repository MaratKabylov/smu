import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicScienceWorkFilters, ScienceWorkInput, ScienceWorkListFilters } from "@/lib/validation/science-work";
import { ScientistRepository } from "@/server/repositories/scientist.repository";
import type { ScienceWork, ScienceWorkKind, ScienceWorkMember, ScienceWorkOptions, ScienceWorkStage, ScienceWorkStatus, ScienceWorkTranslation } from "@/types/domain/science-work";
import type { ScientistLocale } from "@/types/domain/scientist";

type WorkRow = {
  id: string; kind: ScienceWorkKind; status: ScienceWorkStatus; stage: ScienceWorkStage;
  organization_id: string | null; field_id: string; cover_media_id: string | null;
  start_date: string | null; end_date: string | null; external_url: string | null; doi: string | null;
  updated_at: string; deleted_at: string | null;
};
type TranslationRow = ScienceWorkTranslation & { work_id: string };
type MemberRow = { work_id: string; scientist_id: string; role: "lead" | "member" };
type ScientistTranslationRow = { scientist_profile_id: string; locale: ScientistLocale; full_name: string; slug: string };

export class ScienceWorkRepository {
  constructor(private readonly client: SupabaseClient) {}

  async options(): Promise<ScienceWorkOptions> {
    const [taxonomy, profiles] = await Promise.all([
      new ScientistRepository(this.client).listTaxonomy(),
      this.client.from("scientist_profiles").select("id").eq("status", "verified").is("deleted_at", null).order("id"),
    ]);
    if (profiles.error) throw profiles.error;
    const ids = (profiles.data ?? []).map(item => item.id as string);
    if (!ids.length) return { ...taxonomy, scientists: [] };
    const translations = await this.client.from("scientist_profile_translations").select("scientist_profile_id, full_name").eq("locale", "ru").in("scientist_profile_id", ids).order("full_name");
    if (translations.error) throw translations.error;
    return { ...taxonomy, scientists: (translations.data ?? []).map(item => ({ id: item.scientist_profile_id as string, name: item.full_name as string })) };
  }

  async list(kind: ScienceWorkKind, filters: ScienceWorkListFilters) {
    let query = this.client.from("science_works").select("*").eq("kind", kind).is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
    if (filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.query) {
      const ids = await this.matchingIds(filters.query);
      if (!ids.length) return [];
      query = query.in("id", ids);
    }
    const { data, error } = await query;
    if (error) throw error;
    return this.hydrate((data ?? []) as WorkRow[]);
  }

  async getById(kind: ScienceWorkKind, id: string) {
    const { data, error } = await this.client.from("science_works").select("*").eq("id", id).eq("kind", kind).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    return data ? (await this.hydrate([data as WorkRow]))[0] ?? null : null;
  }

  async listPublic(kind: ScienceWorkKind, filters: PublicScienceWorkFilters) {
    const taxonomy = await new ScientistRepository(this.client).listTaxonomy();
    let query = this.client.from("science_works").select("*").eq("kind", kind).eq("status", "published").is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
    if (filters.stage !== "all") query = query.eq("stage", filters.stage);
    if (filters.field) {
      const field = taxonomy.fields.find(item => item.slug === filters.field);
      if (!field) return { works: [], taxonomy };
      query = query.eq("field_id", field.id);
    }
    if (filters.organization) {
      const organization = taxonomy.organizations.find(item => item.slug === filters.organization);
      if (!organization) return { works: [], taxonomy };
      query = query.eq("organization_id", organization.id);
    }
    if (filters.query) {
      const ids = await this.matchingIds(filters.query, filters.locale);
      if (!ids.length) return { works: [], taxonomy };
      query = query.in("id", ids);
    }
    const { data, error } = await query;
    if (error) throw error;
    const works = (await this.hydrate((data ?? []) as WorkRow[], true)).filter(work => work.translations.some(item => item.locale === filters.locale));
    return { works, taxonomy };
  }

  async getPublicBySlug(kind: ScienceWorkKind, locale: ScientistLocale, slug: string) {
    const translation = await this.client.from("science_work_translations").select("work_id").eq("locale", locale).eq("slug", slug).maybeSingle();
    if (translation.error) throw translation.error;
    if (!translation.data) return null;
    // Session RLS can include drafts for managers. Always enforce public state here.
    const { data, error } = await this.client.from("science_works").select("*").eq("id", translation.data.work_id).eq("kind", kind).eq("status", "published").is("deleted_at", null).maybeSingle();
    if (error) throw error;
    return data ? (await this.hydrate([data as WorkRow], true))[0] ?? null : null;
  }

  async save(kind: ScienceWorkKind, actor: string, input: ScienceWorkInput, id: string | null = null) {
    const { data, error } = await this.client.rpc("save_science_work", { p_id: id, p_kind: kind, p_actor: actor, p_input: input });
    if (error) throw error;
    return data as string;
  }

  async changeState(kind: ScienceWorkKind, actor: string, id: string, status: ScienceWorkStatus | null, remove = false) {
    const { error } = await this.client.rpc("change_science_work_state", { p_id: id, p_kind: kind, p_actor: actor, p_status: status, p_delete: remove });
    if (error) throw error;
  }

  private async matchingIds(text: string, locale?: ScientistLocale) {
    let query = this.client.from("science_work_translations").select("work_id").ilike("title", '%' + text.replace(/[\\%_]/g, character => '\\' + character) + '%');
    if (locale) query = query.eq("locale", locale);
    const { data, error } = await query;
    if (error) throw error;
    return [...new Set((data ?? []).map(item => item.work_id as string))];
  }

  private async hydrate(rows: WorkRow[], publicOnly = false): Promise<ScienceWork[]> {
    if (!rows.length) return [];
    const ids = rows.map(row => row.id);
    const coverIds = rows.flatMap(row => row.cover_media_id ? [row.cover_media_id] : []);
    const [translations, members, taxonomy, covers] = await Promise.all([
      this.client.from("science_work_translations").select("*").in("work_id", ids),
      this.client.from("science_work_members").select("*").in("work_id", ids),
      new ScientistRepository(this.client).listTaxonomy(),
      coverIds.length ? this.client.from("media_assets").select("id, storage_bucket, storage_path").in("id", coverIds).eq("storage_bucket", "article-media").eq("status", "ready").like("mime_type", "image/%").is("deleted_at", null) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [translations, members, covers]) if (result.error) throw result.error;
    const memberRows = (members.data ?? []) as MemberRow[];
    const scientistIds = [...new Set(memberRows.map(row => row.scientist_id))];
    let scientistTranslations: ScientistTranslationRow[] = [];
    let visibleScientistIds = new Set(scientistIds);
    if (scientistIds.length) {
      if (publicOnly) {
        const scientists = await this.client.from("scientist_profiles").select("id").in("id", scientistIds).eq("status", "verified").is("deleted_at", null);
        if (scientists.error) throw scientists.error;
        visibleScientistIds = new Set((scientists.data ?? []).map(item => item.id as string));
      }
      if (visibleScientistIds.size) {
        const result = await this.client.from("scientist_profile_translations").select("scientist_profile_id, locale, full_name, slug").in("scientist_profile_id", [...visibleScientistIds]);
        if (result.error) throw result.error;
        scientistTranslations = (result.data ?? []) as ScientistTranslationRow[];
      }
    }
    return rows.map(row => {
      const cover = covers.data?.find(item => item.id === row.cover_media_id);
      const team: ScienceWorkMember[] = memberRows.filter(item => item.work_id === row.id && visibleScientistIds.has(item.scientist_id)).map(item => ({
        id: item.scientist_id, role: item.role,
        translations: scientistTranslations.filter(translation => translation.scientist_profile_id === item.scientist_id).map(translation => ({ locale: translation.locale, fullName: translation.full_name, slug: translation.slug })),
      }));
      return {
        id: row.id, kind: row.kind, status: row.status, stage: row.stage,
        organizationId: row.organization_id, fieldId: row.field_id, coverMediaId: row.cover_media_id,
        coverUrl: cover ? this.client.storage.from(cover.storage_bucket).getPublicUrl(cover.storage_path).data.publicUrl : null,
        startDate: row.start_date, endDate: row.end_date, externalUrl: row.external_url, doi: row.doi,
        updatedAt: row.updated_at, deletedAt: row.deleted_at,
        translations: ((translations.data ?? []) as TranslationRow[]).filter(item => item.work_id === row.id).map(item => ({ locale: item.locale, title: item.title, slug: item.slug, summary: item.summary, description: item.description, results: item.results })),
        members: team, organization: taxonomy.organizations.find(item => item.id === row.organization_id) ?? null,
        field: taxonomy.fields.find(item => item.id === row.field_id) ?? null,
      };
    });
  }
}
