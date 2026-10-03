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
  async list(filters: PublicEventFilters) {
    if (!isSupabaseConfigured()) return [];
    return new EventRepository(await createServerSupabaseClient()).listPublic(filters);
  }
  async getBySlug(locale: ScientistLocale, slug: string) {
    if (!isSupabaseConfigured()) return null;
    return new EventRepository(await createServerSupabaseClient()).getPublicBySlug(locale, slug);
  }
}
export const getPublicEvent = cache((locale: ScientistLocale, slug: string) => new PublicEventService().getBySlug(locale, slug));
