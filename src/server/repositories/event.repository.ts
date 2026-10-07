import type { Tables } from "@/types/database.types";
import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import type { EventInput, EventListFilters, PublicEventFilters } from "@/lib/validation/event";
import type { EventStatus, ScienceEvent } from "@/types/domain/event";
import type { ScientistLocale } from "@/types/domain/scientist";

type EventRow = Pick<Tables<"events">, "id" | "status" | "kind" | "format" | "starts_at" | "ends_at" | "registration_deadline" | "registration_url" | "external_url" | "cover_media_id" | "updated_at">;

export class EventRepository {
  constructor(private readonly client: DatabaseClient) {}

  async list(filters: EventListFilters) {
    let query = this.client.from("events").select("*").is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
    if (filters.status !== "all") query = query.eq("status", filters.status);
    if (filters.query) {
      const ids = await this.matchingIds(filters.query);
      if (!ids.length) return [];
      query = query.in("id", ids);
    }
    const { data, error } = await query;
    if (error) throw error;
    return this.hydrate((data ?? []));
  }
  async getById(id: string) {
    const { data, error } = await this.client.from("events").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    return data ? (await this.hydrate([data]))[0] ?? null : null;
  }
  async listPublic(filters: PublicEventFilters, now = new Date()) {
    // Manager sessions can see drafts through RLS, so public queries enforce state explicitly.
    let query = this.client.from("events").select("*").in("status", ["published", "cancelled"])
      .is("deleted_at", null).order("starts_at", { ascending: filters.period !== "past" }).limit(100);
    if (filters.period === "upcoming") query = query.gt("ends_at", now.toISOString());
    if (filters.period === "past") query = query.lte("ends_at", now.toISOString());
    if (filters.kind !== "all") query = query.eq("kind", filters.kind);
    if (filters.format !== "all") query = query.eq("format", filters.format);
    if (filters.query) {
      const ids = await this.matchingIds(filters.query, filters.locale);
      if (!ids.length) return [];
      query = query.in("id", ids);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (await this.hydrate((data ?? []))).filter(event => event.translations.some(item => item.locale === filters.locale));
  }
  async getPublicBySlug(locale: ScientistLocale, slug: string) {
    const translation = await this.client.from("event_translations").select("event_id").eq("locale", locale).eq("slug", slug).maybeSingle();
    if (translation.error) throw translation.error;
    if (!translation.data) return null;
    const { data, error } = await this.client.from("events").select("*").eq("id", translation.data.event_id)
      .in("status", ["published", "cancelled"]).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    return data ? (await this.hydrate([data]))[0] ?? null : null;
  }
  async save(actor: string, input: EventInput, id: string | null = null) {
    const { data, error } = await this.client.rpc("save_event", { p_id: id, p_actor: actor, p_input: input });
    if (error) throw error;
    if (data === null) throw new Error("Missing database result");
    return data;
  }
  async changeState(actor: string, id: string, status: EventStatus | null, remove = false) {
    const { error } = await this.client.rpc("change_event_state", { p_id: id, p_actor: actor, p_status: status, p_delete: remove });
    if (error) throw error;
  }
  private async matchingIds(text: string, locale?: ScientistLocale) {
    let query = this.client.from("event_translations").select("event_id")
      .ilike("title", "%" + text.replace(/[\\%_]/g, character => "\\" + character) + "%");
    if (locale) query = query.eq("locale", locale);
    const { data, error } = await query;
    if (error) throw error;
    return [...new Set((data ?? []).map(item => item.event_id))];
  }
  private async hydrate(rows: EventRow[]): Promise<ScienceEvent[]> {
    if (!rows.length) return [];
    const coverIds = rows.flatMap(row => row.cover_media_id ? [row.cover_media_id] : []);
    const [translations, covers] = await Promise.all([
      this.client.from("event_translations").select("*").in("event_id", rows.map(row => row.id)),
      coverIds.length ? this.client.from("media_assets").select("id, storage_bucket, storage_path")
        .in("id", coverIds).in("storage_bucket", ["article-media", "event-media"]).eq("status", "ready")
        .like("mime_type", "image/%").is("deleted_at", null) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [translations, covers]) if (result.error) throw result.error;
    return rows.map(row => {
      const cover = covers.data?.find(item => item.id === row.cover_media_id);
      return {
        id: row.id, status: row.status, kind: row.kind, format: row.format,
        startsAt: row.starts_at, endsAt: row.ends_at, registrationDeadline: row.registration_deadline,
        registrationUrl: row.registration_url, externalUrl: row.external_url, coverMediaId: row.cover_media_id,
        coverUrl: cover ? this.client.storage.from(cover.storage_bucket).getPublicUrl(cover.storage_path).data.publicUrl : null,
        updatedAt: row.updated_at,
        translations: (translations.data ?? []).filter(item => item.event_id === row.id)
          .map(item => ({ locale: item.locale, title: item.title, slug: item.slug, summary: item.summary,
            description: item.description, organizer: item.organizer, location: item.location })),
      };
    });
  }
}
