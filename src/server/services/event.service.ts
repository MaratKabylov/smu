import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { SearchRepository } from "@/server/repositories/search.repository";
import { emptySearchPage, orderBySearch } from "@/lib/search";
import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { canManageEvents } from "@/lib/events";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { EventInput, EventListFilters, PublicEventFilters } from "@/lib/validation/event";
import { EventRepository } from "@/server/repositories/event.repository";
import type { AccessContext } from "@/types/domain/auth";
import type { EventStatus } from "@/types/domain/event";
import type { ScientistLocale } from "@/types/domain/scientist";

export class EventServiceError extends Error {
  constructor(public readonly code: "forbidden") { super("Недостаточно прав."); }
}
export class EventService {
  private assertAccess(access: AccessContext) {
    if (!canManageEvents(access)) throw new EventServiceError("forbidden");
  }
  async list(access: AccessContext, filters: EventListFilters) {
    this.assertAccess(access);
    return new EventRepository(await createServerSupabaseClient()).list(filters);
  }
  async getById(access: AccessContext, id: string) {
    this.assertAccess(access);
    return new EventRepository(await createServerSupabaseClient()).getById(id);
  }
  async save(access: AccessContext, input: EventInput, id: string | null = null) {
    this.assertAccess(access);
    return new EventRepository(createServiceRoleSupabaseClient()).save(access.userId, input, id);
  }
  async changeStatus(access: AccessContext, id: string, status: EventStatus) {
    this.assertAccess(access);
    await new EventRepository(createServiceRoleSupabaseClient()).changeState(access.userId, id, status);
  }
  async softDelete(access: AccessContext, id: string) {
    this.assertAccess(access);
    await new EventRepository(createServiceRoleSupabaseClient()).changeState(access.userId, id, null, true);
  }
}
export class PublicEventService {
  async listPage(filters: PublicEventFilters, page = 1) {
    if (!isSupabaseConfigured()) return { events: [], pagination: emptySearchPage(page) };
    const client = createPublicSupabaseClient();
    const { locale, query, ...attributes } = filters;
    const pagination = await new SearchRepository(client).publicPage(locale, query, "events", attributes, page);
    const events = await new EventRepository(client).listPublic({ ...filters, query: "" }, "now", pagination.items.map(item => item.id));
    return { events: orderBySearch(events, pagination), pagination };
  }

  async list(filters: PublicEventFilters) {
    if (!isSupabaseConfigured()) return [];
    return new EventRepository(createPublicSupabaseClient()).listPublic(filters);
  }
  async getBySlug(locale: ScientistLocale, slug: string) {
    if (!isSupabaseConfigured()) return null;
    return new EventRepository(createPublicSupabaseClient()).getPublicBySlug(locale, slug);
  }
}
export const getPublicEvent = cache((locale: ScientistLocale, slug: string) => new PublicEventService().getBySlug(locale, slug));
