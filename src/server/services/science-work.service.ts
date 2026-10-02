import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { canManageScienceWork } from "@/lib/science-work";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { PublicScienceWorkFilters, ScienceWorkInput, ScienceWorkListFilters } from "@/lib/validation/science-work";
import { ScienceWorkRepository } from "@/server/repositories/science-work.repository";
import type { AccessContext } from "@/types/domain/auth";
import type { ScienceWorkKind, ScienceWorkStatus } from "@/types/domain/science-work";
import type { ScientistLocale } from "@/types/domain/scientist";

export class ScienceWorkServiceError extends Error {
  constructor(public readonly code: "forbidden") { super("Недостаточно прав."); }
}
export class ScienceWorkService {
  private assertAccess(access: AccessContext, kind: ScienceWorkKind) {
    if (!canManageScienceWork(access, kind)) throw new ScienceWorkServiceError("forbidden");
  }
  async list(access: AccessContext, kind: ScienceWorkKind, filters: ScienceWorkListFilters) {
    this.assertAccess(access, kind);
    return new ScienceWorkRepository(await createServerSupabaseClient()).list(kind, filters);
  }
  async getById(access: AccessContext, kind: ScienceWorkKind, id: string) {
    this.assertAccess(access, kind);
    return new ScienceWorkRepository(await createServerSupabaseClient()).getById(kind, id);
  }
  async options(access: AccessContext, kind: ScienceWorkKind) {
    this.assertAccess(access, kind);
    return new ScienceWorkRepository(await createServerSupabaseClient()).options();
  }
  async save(access: AccessContext, kind: ScienceWorkKind, input: ScienceWorkInput, id: string | null = null) {
    this.assertAccess(access, kind);
    return new ScienceWorkRepository(createServiceRoleSupabaseClient()).save(kind, access.userId, input, id);
  }
  async changeStatus(access: AccessContext, kind: ScienceWorkKind, id: string, status: ScienceWorkStatus) {
    this.assertAccess(access, kind);
    await new ScienceWorkRepository(createServiceRoleSupabaseClient()).changeState(kind, access.userId, id, status);
  }
  async softDelete(access: AccessContext, kind: ScienceWorkKind, id: string) {
    this.assertAccess(access, kind);
    await new ScienceWorkRepository(createServiceRoleSupabaseClient()).changeState(kind, access.userId, id, null, true);
  }
}
export class PublicScienceWorkService {
  async list(kind: ScienceWorkKind, filters: PublicScienceWorkFilters) {
    if (!isSupabaseConfigured()) return { works: [], taxonomy: { organizations: [], fields: [] } };
    return new ScienceWorkRepository(await createServerSupabaseClient()).listPublic(kind, filters);
  }
  async getBySlug(kind: ScienceWorkKind, locale: ScientistLocale, slug: string) {
    if (!isSupabaseConfigured()) return null;
    return new ScienceWorkRepository(await createServerSupabaseClient()).getPublicBySlug(kind, locale, slug);
  }
}
export const getPublicScienceWork = cache((kind: ScienceWorkKind, locale: ScientistLocale, slug: string) => new PublicScienceWorkService().getBySlug(kind, locale, slug));
