import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { SearchRepository } from "@/server/repositories/search.repository";
import { emptySearchPage, orderBySearch } from "@/lib/search";
import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { canManageResearchProgram } from "@/lib/permissions/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { ResearchProgramApplicationInput, ResearchProgramFilters, ResearchProgramInput } from "@/lib/validation/research-program";
import { ResearchProgramRepository } from "@/server/repositories/research-program.repository";
import type { AccessContext } from "@/types/domain/auth";
import type { ApplicationStatus, ResearchProgramStatus } from "@/types/domain/research-program";
import type { ScientistLocale } from "@/types/domain/scientist";
export class ResearchProgramServiceError extends Error {
  constructor() { super("Недостаточно прав."); }
}
export class ResearchProgramService {
  private assertAccess(access: AccessContext) {
    if (!canManageResearchProgram(access)) throw new ResearchProgramServiceError();
  }
  async list(access: AccessContext, status: ResearchProgramStatus | "all") {
    this.assertAccess(access); return new ResearchProgramRepository(await createServerSupabaseClient()).list(status);
  }
  async getById(access: AccessContext, id: string) {
    this.assertAccess(access); return new ResearchProgramRepository(await createServerSupabaseClient()).getById(id);
  }
  async options(access: AccessContext) {
    this.assertAccess(access); return new ResearchProgramRepository(await createServerSupabaseClient()).options();
  }
  async applications(access: AccessContext, programId?: string, status: ApplicationStatus | "all" = "all", applicationId?: string) {
    this.assertAccess(access); return new ResearchProgramRepository(await createServerSupabaseClient()).applications(programId, status, applicationId);
  }
  async save(access: AccessContext, input: ResearchProgramInput, id: string | null) {
    this.assertAccess(access); return new ResearchProgramRepository(createServiceRoleSupabaseClient()).save(access.userId, input, id);
  }
  async changeState(access: AccessContext, id: string, status: ResearchProgramStatus | null, remove = false) {
    this.assertAccess(access); return new ResearchProgramRepository(createServiceRoleSupabaseClient()).changeState(access.userId, id, status, remove);
  }
  async updateApplication(access: AccessContext, id: string, status: ApplicationStatus, note: string) {
    this.assertAccess(access); return new ResearchProgramRepository(createServiceRoleSupabaseClient()).updateApplication(access.userId, id, status, note);
  }
}
export class PublicResearchProgramService {
  async listPage(filters: ResearchProgramFilters, page = 1) {
    if (!isSupabaseConfigured()) return { programs: [], taxonomy: { organizations: [], fields: [] }, pagination: emptySearchPage(page) };
    const client = createPublicSupabaseClient();
    const { locale, query, ...attributes } = filters;
    const pagination = await new SearchRepository(client).publicPage(locale, query, "research-program", attributes, page);
    const result = await new ResearchProgramRepository(client).listPublic({ ...filters, query: "" }, pagination.items.map(item => item.id));
    return { ...result, programs: orderBySearch(result.programs, pagination), pagination };
  }

  async list(filters: ResearchProgramFilters) {
    if (!isSupabaseConfigured()) return { programs: [], taxonomy: { organizations: [], fields: [] } };
    return new ResearchProgramRepository(createPublicSupabaseClient()).listPublic(filters);
  }
  async getBySlug(locale: ScientistLocale, slug: string) {
    if (!isSupabaseConfigured()) return null;
    return new ResearchProgramRepository(createPublicSupabaseClient()).getPublicBySlug(locale, slug);
  }
  async submit(input: ResearchProgramApplicationInput) {
    return new ResearchProgramRepository(createServiceRoleSupabaseClient()).submit(input);
  }
}
export const getPublicResearchProgram = cache((locale: ScientistLocale, slug: string) => new PublicResearchProgramService().getBySlug(locale, slug));
