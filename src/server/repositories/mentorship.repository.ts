import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MentorshipApplicationInput, MentorshipFilters, MentorshipInput } from "@/lib/validation/mentorship";
import { ScientistRepository } from "./scientist.repository";
import { ScienceWorkRepository } from "./science-work.repository";
import type { ApplicationStatus, MentorshipApplication, MentorshipFormat, MentorshipOffer, MentorshipStatus, MentorshipTranslation } from "@/types/domain/mentorship";
import type { ScientistLocale } from "@/types/domain/scientist";

type OfferRow = { id: string; scientist_id: string; field_id: string; format: MentorshipFormat; capacity: number; status: MentorshipStatus; updated_at: string };
type TranslationRow = MentorshipTranslation & { offer_id: string };
type MentorRow = { scientist_profile_id: string; locale: ScientistLocale; full_name: string; slug: string };
type ApplicationRow = { id: string; offer_id: string; locale: ScientistLocale; full_name: string; email: string; motivation: string; status: ApplicationStatus; manager_note: string; created_at: string; consent_at: string };

export class MentorshipRepository {
  constructor(private readonly client: SupabaseClient) {}

  options() { return new ScienceWorkRepository(this.client).options(); }

  async list(status: MentorshipStatus | "all" = "all") {
    let query = this.client.from("mentorship_offers").select("*").is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
    if (status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return this.hydrate((data ?? []) as OfferRow[]);
  }
  async getById(id: string) {
    const { data, error } = await this.client.from("mentorship_offers").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    return data ? (await this.hydrate([data as OfferRow]))[0] ?? null : null;
  }
  async listPublic(filters: MentorshipFilters) {
    const taxonomy = await new ScientistRepository(this.client).listTaxonomy();
    let query = this.client.from("mentorship_offers").select("*").eq("status", "published").is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
    if (filters.format !== "all") query = query.eq("format", filters.format);
    if (filters.field) {
      const field = taxonomy.fields.find(item => item.slug === filters.field);
      if (!field) return { offers: [], taxonomy };
      query = query.eq("field_id", field.id);
    }
    if (filters.query) {
      const result = await this.client.from("mentorship_offer_translations").select("offer_id").eq("locale", filters.locale)
        .ilike("title", "%" + filters.query.replace(/[\\%_]/g, character => "\\" + character) + "%");
      if (result.error) throw result.error;
      const ids = (result.data ?? []).map(item => item.offer_id as string);
      if (!ids.length) return { offers: [], taxonomy };
      query = query.in("id", ids);
    }
    const { data, error } = await query;
    if (error) throw error;
    const offers = (await this.hydrate((data ?? []) as OfferRow[], true)).filter(item => item.translations.some(t => t.locale === filters.locale) && item.mentor.some(t => t.locale === filters.locale));
    return { offers, taxonomy };
  }
  async getPublicBySlug(locale: ScientistLocale, slug: string) {
    const translation = await this.client.from("mentorship_offer_translations").select("offer_id").eq("locale", locale).eq("slug", slug).maybeSingle();
    if (translation.error) throw translation.error;
    if (!translation.data) return null;
    // Explicit filtering also applies when a manager visits with an authenticated session.
    const result = await this.client.from("mentorship_offers").select("*").eq("id", translation.data.offer_id).eq("status", "published").is("deleted_at", null).maybeSingle();
    if (result.error) throw result.error;
    const offer = result.data ? (await this.hydrate([result.data as OfferRow], true))[0] : null;
    return offer?.mentor.some(item => item.locale === locale) ? offer : null;
  }
  async applications(offerId?: string, status: ApplicationStatus | "all" = "all"): Promise<MentorshipApplication[]> {
    let query = this.client.from("mentorship_applications").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
    if (offerId) query = query.eq("offer_id", offerId);
    if (status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as ApplicationRow[]).map(row => ({ id: row.id, offerId: row.offer_id, locale: row.locale, fullName: row.full_name,
      email: row.email, motivation: row.motivation, status: row.status, managerNote: row.manager_note, createdAt: row.created_at, consentAt: row.consent_at }));
  }
  async save(actor: string, input: MentorshipInput, id: string | null) {
    const { data, error } = await this.client.rpc("save_mentorship_offer", { p_id: id, p_actor: actor, p_input: input });
    if (error) throw error;
    return data as string;
  }
  async changeState(actor: string, id: string, status: MentorshipStatus | null, remove = false) {
    const { error } = await this.client.rpc("change_mentorship_offer_state", { p_id: id, p_actor: actor, p_status: status, p_delete: remove });
    if (error) throw error;
  }
  async submit(input: MentorshipApplicationInput) {
    const { error } = await this.client.rpc("submit_mentorship_application", { p_offer: input.offerId,
      p_input: { locale: input.locale, fullName: input.fullName, email: input.email, motivation: input.motivation, consent: input.consent } });
    if (error) throw error;
  }
  async updateApplication(actor: string, id: string, status: ApplicationStatus, note: string) {
    const { error } = await this.client.rpc("update_mentorship_application", { p_id: id, p_actor: actor, p_status: status, p_note: note });
    if (error) throw error;
  }
  private async hydrate(rows: OfferRow[], publicOnly = false): Promise<MentorshipOffer[]> {
    if (!rows.length) return [];
    let visibleRows = rows;
    if (publicOnly) {
      const scientists = await this.client.from("scientist_profiles").select("id").in("id", [...new Set(rows.map(row => row.scientist_id))]).eq("status", "verified").is("deleted_at", null);
      if (scientists.error) throw scientists.error;
      const ids = new Set((scientists.data ?? []).map(item => item.id as string));
      visibleRows = rows.filter(row => ids.has(row.scientist_id));
    }
    if (!visibleRows.length) return [];
    const [translations, mentors, taxonomy] = await Promise.all([
      this.client.from("mentorship_offer_translations").select("*").in("offer_id", visibleRows.map(row => row.id)),
      this.client.from("scientist_profile_translations").select("scientist_profile_id, locale, full_name, slug").in("scientist_profile_id", [...new Set(visibleRows.map(row => row.scientist_id))]),
      new ScientistRepository(this.client).listTaxonomy(),
    ]);
    if (translations.error) throw translations.error;
    if (mentors.error) throw mentors.error;
    return visibleRows.filter(row => !publicOnly || taxonomy.fields.some(field => field.id === row.field_id)).map(row => ({
      id: row.id, scientistId: row.scientist_id, fieldId: row.field_id, format: row.format, capacity: row.capacity, status: row.status, updatedAt: row.updated_at,
      translations: ((translations.data ?? []) as TranslationRow[]).filter(t => t.offer_id === row.id).map(t => ({ locale: t.locale, title: t.title, slug: t.slug, summary: t.summary, description: t.description })),
      mentor: ((mentors.data ?? []) as MentorRow[]).filter(t => t.scientist_profile_id === row.scientist_id).map(t => ({ locale: t.locale, fullName: t.full_name, slug: t.slug })),
      field: taxonomy.fields.find(field => field.id === row.field_id) ?? null,
    }));
  }
}
