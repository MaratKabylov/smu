import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { SearchRepository } from "@/server/repositories/search.repository";
import { emptySearchPage, orderBySearch } from "@/lib/search";
import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { canManageMentorship } from "@/lib/permissions/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { MentorshipApplicationInput, MentorshipFilters, MentorshipInput } from "@/lib/validation/mentorship";
import { MentorshipRepository } from "@/server/repositories/mentorship.repository";
import type { AccessContext } from "@/types/domain/auth";
import type { ApplicationStatus, MentorshipStatus } from "@/types/domain/mentorship";
import type { ScientistLocale } from "@/types/domain/scientist";
export class MentorshipServiceError extends Error {
  constructor() { super("Недостаточно прав."); }
}
export class MentorshipService {
  private assertAccess(access: AccessContext) {
    if (!canManageMentorship(access)) throw new MentorshipServiceError();
  }
  async list(access: AccessContext, status: MentorshipStatus | "all") {
    this.assertAccess(access); return new MentorshipRepository(await createServerSupabaseClient()).list(status);
  }
  async getById(access: AccessContext, id: string) {
    this.assertAccess(access); return new MentorshipRepository(await createServerSupabaseClient()).getById(id);
  }
  async options(access: AccessContext) {
    this.assertAccess(access); return new MentorshipRepository(await createServerSupabaseClient()).options();
  }
  async applications(access: AccessContext, offerId?: string, status: ApplicationStatus | "all" = "all", applicationId?: string) {
    this.assertAccess(access); return new MentorshipRepository(await createServerSupabaseClient()).applications(offerId, status, applicationId);
  }
  async save(access: AccessContext, input: MentorshipInput, id: string | null) {
    this.assertAccess(access); return new MentorshipRepository(createServiceRoleSupabaseClient()).save(access.userId, input, id);
  }
  async changeState(access: AccessContext, id: string, status: MentorshipStatus | null, remove = false) {
    this.assertAccess(access); return new MentorshipRepository(createServiceRoleSupabaseClient()).changeState(access.userId, id, status, remove);
  }
  async updateApplication(access: AccessContext, id: string, status: ApplicationStatus, note: string) {
    this.assertAccess(access); return new MentorshipRepository(createServiceRoleSupabaseClient()).updateApplication(access.userId, id, status, note);
  }
}
export class PublicMentorshipService {
  async listPage(filters: MentorshipFilters, page = 1) {
    if (!isSupabaseConfigured()) return { offers: [], taxonomy: { organizations: [], fields: [] }, pagination: emptySearchPage(page) };
    const client = createPublicSupabaseClient();
    const { locale, query, ...attributes } = filters;
    const pagination = await new SearchRepository(client).publicPage(locale, query, "mentorship", attributes, page);
    const result = await new MentorshipRepository(client).listPublic({ ...filters, query: "" }, pagination.items.map(item => item.id));
    return { ...result, offers: orderBySearch(result.offers, pagination), pagination };
  }

  async list(filters: MentorshipFilters) {
    if (!isSupabaseConfigured()) return { offers: [], taxonomy: { organizations: [], fields: [] } };
    return new MentorshipRepository(createPublicSupabaseClient()).listPublic(filters);
  }
  async getBySlug(locale: ScientistLocale, slug: string) {
    if (!isSupabaseConfigured()) return null;
    return new MentorshipRepository(createPublicSupabaseClient()).getPublicBySlug(locale, slug);
  }
  async submit(input: MentorshipApplicationInput) {
    return new MentorshipRepository(createServiceRoleSupabaseClient()).submit(input);
  }
}
export const getPublicMentorship = cache((locale: ScientistLocale, slug: string) => new PublicMentorshipService().getBySlug(locale, slug));
