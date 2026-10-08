import type { Tables } from "@/types/database.types";
import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import type { ResearchProgramApplicationInput, ResearchProgramFilters, ResearchProgramInput } from "@/lib/validation/research-program";
import { ScientistRepository } from "./scientist.repository";
import { ScienceWorkRepository } from "./science-work.repository";
import type { ApplicationStatus, ResearchProgramApplication, ResearchProgram, ResearchProgramStatus } from "@/types/domain/research-program";
import type { ScientistLocale } from "@/types/domain/scientist";

type ProgramRow = Pick<Tables<"research_programs">, "id" | "coordinator_id" | "field_id" | "format" | "capacity" | "status" | "updated_at" | "applications_open_on" | "application_deadline" | "starts_on" | "ends_on">;

export class ResearchProgramRepository {
  constructor(private readonly client: DatabaseClient) {}

  options() { return new ScienceWorkRepository(this.client).options(); }

  async list(status: ResearchProgramStatus | "all" = "all") {
    let query = this.client.from("research_programs").select("*").is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
    if (status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return this.hydrate((data ?? []));
  }
  async getById(id: string) {
    const { data, error } = await this.client.from("research_programs").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    return data ? (await this.hydrate([data]))[0] ?? null : null;
  }
  async listPublic(filters: ResearchProgramFilters, selectedIds?: string[]) {
    const taxonomy = await new ScientistRepository(this.client).listTaxonomy();
    let query = this.client.from("research_programs").select("*").eq("status", "published").is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
    if (selectedIds && !selectedIds.length) return { programs: [], taxonomy };
    if (selectedIds) query = query.in("id", selectedIds);
    if (filters.format !== "all") query = query.eq("format", filters.format);
    if (filters.field) {
      const field = taxonomy.fields.find(item => item.slug === filters.field);
      if (!field) return { programs: [], taxonomy };
      query = query.eq("field_id", field.id);
    }
    if (filters.query) {
      const result = await this.client.from("research_program_translations").select("program_id").eq("locale", filters.locale)
        .ilike("title", "%" + filters.query.replace(/[\\%_]/g, character => "\\" + character) + "%");
      if (result.error) throw result.error;
      const ids = (result.data ?? []).map(item => item.program_id);
      if (!ids.length) return { programs: [], taxonomy };
      query = query.in("id", ids);
    }
    const { data, error } = await query;
    if (error) throw error;
    const programs = (await this.hydrate((data ?? []), true)).filter(item => item.translations.some(t => t.locale === filters.locale) && item.coordinator.some(t => t.locale === filters.locale));
    return { programs, taxonomy };
  }
  async getPublicBySlug(locale: ScientistLocale, slug: string) {
    const translation = await this.client.from("research_program_translations").select("program_id").eq("locale", locale).eq("slug", slug).maybeSingle();
    if (translation.error) throw translation.error;
    if (!translation.data) return null;
    // Explicit filtering also applies when a manager visits with an authenticated session.
    const result = await this.client.from("research_programs").select("*").eq("id", translation.data.program_id).eq("status", "published").is("deleted_at", null).maybeSingle();
    if (result.error) throw result.error;
    const program = result.data ? (await this.hydrate([result.data], true))[0] : null;
    return program?.coordinator.some(item => item.locale === locale) ? program : null;
  }
  async applications(programId?: string, status: ApplicationStatus | "all" = "all", applicationId?: string): Promise<ResearchProgramApplication[]> {
    let query = this.client.from("research_program_applications").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
    if (programId) query = query.eq("program_id", programId);
    if (applicationId) query = query.eq("id", applicationId);
    if (status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? [])).map(row => ({ id: row.id, programId: row.program_id, locale: row.locale, fullName: row.full_name,
      email: row.email, motivation: row.motivation, status: row.status, managerNote: row.manager_note, createdAt: row.created_at, consentAt: row.consent_at }));
  }
  async save(actor: string, input: ResearchProgramInput, id: string | null) {
    const { data, error } = await this.client.rpc("save_research_program", { p_id: id, p_actor: actor, p_input: input });
    if (error) throw error;
    if (data === null) throw new Error("Missing database result");
    return data;
  }
  async changeState(actor: string, id: string, status: ResearchProgramStatus | null, remove = false) {
    const { error } = await this.client.rpc("change_research_program_state", { p_id: id, p_actor: actor, p_status: status, p_delete: remove });
    if (error) throw error;
  }
  async submit(input: ResearchProgramApplicationInput) {
    const { error } = await this.client.rpc("submit_research_program_application", { p_program: input.programId,
      p_input: { locale: input.locale, fullName: input.fullName, email: input.email, motivation: input.motivation, consent: input.consent } });
    if (error) throw error;
  }
  async updateApplication(actor: string, id: string, status: ApplicationStatus, note: string) {
    const { error } = await this.client.rpc("update_research_program_application", { p_id: id, p_actor: actor, p_status: status, p_note: note });
    if (error) throw error;
  }
  private async hydrate(rows: ProgramRow[], publicOnly = false): Promise<ResearchProgram[]> {
    if (!rows.length) return [];
    let visibleRows = rows;
    if (publicOnly) {
      const scientists = await this.client.from("scientist_profiles").select("id").in("id", [...new Set(rows.map(row => row.coordinator_id))]).eq("status", "verified").eq("is_public", true).is("deleted_at", null);
      if (scientists.error) throw scientists.error;
      const ids = new Set((scientists.data ?? []).map(item => item.id));
      visibleRows = rows.filter(row => ids.has(row.coordinator_id));
    }
    if (!visibleRows.length) return [];
    const [translations, coordinators, taxonomy] = await Promise.all([
      this.client.from("research_program_translations").select("*").in("program_id", visibleRows.map(row => row.id)),
      this.client.from("scientist_profile_translations").select("scientist_profile_id, locale, full_name, slug").in("scientist_profile_id", [...new Set(visibleRows.map(row => row.coordinator_id))]),
      new ScientistRepository(this.client).listTaxonomy(),
    ]);
    if (translations.error) throw translations.error;
    if (coordinators.error) throw coordinators.error;
    return visibleRows.filter(row => !publicOnly || taxonomy.fields.some(field => field.id === row.field_id)).map(row => ({
      id: row.id, coordinatorId: row.coordinator_id, fieldId: row.field_id, format: row.format, capacity: row.capacity, status: row.status, updatedAt: row.updated_at,
      applicationsOpenOn: row.applications_open_on, applicationDeadline: row.application_deadline, startsOn: row.starts_on, endsOn: row.ends_on,
      translations: (translations.data ?? []).filter(t => t.program_id === row.id).map(t => ({ locale: t.locale, title: t.title, slug: t.slug, summary: t.summary, description: t.description, curriculum: t.curriculum, eligibility: t.eligibility, outcomes: t.outcomes })),
      coordinator: (coordinators.data ?? []).filter(t => t.scientist_profile_id === row.coordinator_id).map(t => ({ locale: t.locale, fullName: t.full_name, slug: t.slug })),
      field: taxonomy.fields.find(field => field.id === row.field_id) ?? null,
    }));
  }
}
