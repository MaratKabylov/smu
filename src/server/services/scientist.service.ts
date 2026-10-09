import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { SearchRepository } from "@/server/repositories/search.repository";
import { emptySearchPage, orderBySearch } from "@/lib/search";
import "server-only";

import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { canAccessAdmin, canEditScientist, canVerifyScientist, canManageUsers, hasPermission } from "@/lib/permissions/permissions";
import { deletionTimestampSchema } from "@/lib/validation/deleted-records";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { databaseErrorCode } from "@/lib/security/database-error";
import type {
  PublicScientistFilters,
  ScientistInput,
  ScientistListFilters,
  ScientistTaxonomyInput,
} from "@/lib/validation/scientist";
import { PublicScientistRepository, ScientistRepository } from "@/server/repositories/scientist.repository";
import { getPublicSlugRedirect } from "@/server/repositories/slug.repository";
import { scientistAccountSchema, scientistMergeSchema, scientistVerificationSchema } from "@/lib/validation/scientist";
import type { z } from "zod";
import type { AccessContext } from "@/types/domain/auth";
import type { ScientistLocale, ScientistStatus, ScientistTaxonomy } from "@/types/domain/scientist";

type ScientistServiceErrorCode = "forbidden" | "not_found" | "invalid_reference" | "invalid_transition" | "invalid_input" | "slug_conflict" | "slug_reserved" | "stale_version";

export class ScientistServiceError extends Error {
  constructor(public readonly code: ScientistServiceErrorCode, message: string) {
    super(message);
    this.name = "ScientistServiceError";
  }
}

function assertAllowed(allowed: boolean) {
  if (!allowed) throw new ScientistServiceError("forbidden", "Недостаточно прав.");
}

export class ScientistService {
  async list(access: AccessContext, filters: ScientistListFilters) {
    assertAllowed(canEditScientist(access));
    const client = await createServerSupabaseClient();
    return new ScientistRepository(client).list(filters);
  }

  async getById(access: AccessContext, id: string) {
    assertAllowed(canEditScientist(access));
    const client = await createServerSupabaseClient();
    return new ScientistRepository(client).getById(id);
  }

  async listTaxonomy(access: AccessContext, includeInactive = false) {
    assertAllowed(canEditScientist(access));
    const client = await createServerSupabaseClient();
    return new ScientistRepository(client).listTaxonomy(includeInactive);
  }

  private async repository<T>(operation: (repository: ScientistRepository) => Promise<T>): Promise<T> {
    const repository = new ScientistRepository(await createServerSupabaseClient());
    try { return await operation(repository); }
    catch (error) {
      const code = databaseErrorCode(error);
      if (code) throw new ScientistServiceError(code as ScientistServiceErrorCode, "Операция не выполнена.");
      throw error;
    }
  }

  async create(access: AccessContext, input: ScientistInput) {
    assertAllowed(canEditScientist(access));
    return this.repository((repository) => repository.create(input));
  }

  async update(access: AccessContext, id: string, input: ScientistInput) {
    assertAllowed(canEditScientist(access));
    // Resetting verification belongs to the same transaction as the edit.
    return this.repository((repository) => repository.update(id, input));
  }

  async changeStatus(access: AccessContext, id: string, nextStatus: ScientistStatus) {
    assertAllowed(canVerifyScientist(access));
    return this.repository(async (repository) => {
      const current = await repository.getById(id);
      if (!current || current.deletedAt) throw new ScientistServiceError("not_found", "Профиль не найден.");
      if (current.status === nextStatus) throw new ScientistServiceError("invalid_transition", "Статус уже установлен.");
      await repository.changeStatus(id, nextStatus);
    });
  }

  async changeVerification(access: AccessContext, id: string, input: z.infer<typeof scientistVerificationSchema>) {
    assertAllowed(canVerifyScientist(access));
    if (!scientistVerificationSchema.safeParse(input).success) throw new ScientistServiceError("invalid_input", "Проверьте решение и причину.");
    return this.repository(repository => repository.changeVerification(id, input.status, input.expectedVersion, input.note));
  }

  async linkedAccount(access: AccessContext, id: string) {
    assertAllowed(canEditScientist(access) && canManageUsers(access));
    return this.repository(repository => repository.linkedAccount(id));
  }

  async linkAccount(access: AccessContext, id: string, input: z.infer<typeof scientistAccountSchema>) {
    assertAllowed(canEditScientist(access) && canManageUsers(access));
    if (!scientistAccountSchema.safeParse(input).success) throw new ScientistServiceError("invalid_input", "Проверьте email аккаунта.");
    return this.repository(repository => repository.linkAccount(id, input.email, input.expectedVersion));
  }

  async merge(access: AccessContext, input: z.infer<typeof scientistMergeSchema>) {
    assertAllowed(canEditScientist(access) && hasPermission(access, "scientists.merge"));
    if (!scientistMergeSchema.safeParse(input).success) throw new ScientistServiceError("invalid_input", "Проверьте выбранные профили и причину.");
    return this.repository(repository => repository.merge(input.sourceId, input.targetId, input.sourceVersion, input.targetVersion, input.reason));
  }

  async softDelete(access: AccessContext, id: string) {
    assertAllowed(canEditScientist(access));
    return this.repository((repository) => repository.softDelete(id));
  }

  async restoreDeleted(access: AccessContext, id: string, expectedDeletedAt: string) {
    assertAllowed(canAccessAdmin(access) && canEditScientist(access));
    if (!deletionTimestampSchema.safeParse(expectedDeletedAt).success) {
      throw new ScientistServiceError("invalid_input", "Некорректное время удаления.");
    }
    return this.repository(repository => repository.restoreDeleted(id, expectedDeletedAt));
  }

  async createTaxonomyItem(access: AccessContext, input: ScientistTaxonomyInput) {
    assertAllowed(canEditScientist(access));
    return this.repository((repository) => repository.createTaxonomyItem(input));
  }

  async updateTaxonomyItem(access: AccessContext, id: string, input: ScientistTaxonomyInput) {
    assertAllowed(canEditScientist(access));
    if (!input.expectedUpdatedAt) {
      throw new ScientistServiceError("invalid_input", "Проверьте запись и версию справочника.");
    }
    return this.repository((repository) => repository.saveTaxonomyItem(id, input));
  }

}

const emptyTaxonomy: ScientistTaxonomy = { organizations: [], fields: [] };

export class PublicScientistService {
  async listPage(filters: PublicScientistFilters, page = 1) {
    if (!isSupabaseConfigured()) return { scientists: [], taxonomy: emptyTaxonomy, pagination: emptySearchPage(page) };
    const client = createPublicSupabaseClient();
    const pagination = await new SearchRepository(client).publicPage(filters.locale, filters.query, "scientists", { organization: filters.organization, field: filters.field }, page);
    const repository = new PublicScientistRepository(client);
    const taxonomy = await repository.listTaxonomy();
    const scientists = await repository.list({ ...filters, query: "", organization: "", field: "" }, taxonomy, pagination.items.map(item => item.id));
    return { scientists: orderBySearch(scientists, pagination), taxonomy, pagination };
  }

  async getSlugRedirect(locale: ScientistLocale, slug: string) {
    if (!isSupabaseConfigured()) return null;
    return getPublicSlugRedirect(createPublicSupabaseClient(), "scientist", locale, slug);
  }

  async list(filters: PublicScientistFilters) {
    if (!isSupabaseConfigured()) return { scientists: [], taxonomy: emptyTaxonomy };
    const client = createPublicSupabaseClient();
    const repository = new PublicScientistRepository(client);
    const taxonomy = await repository.listTaxonomy();
    return { scientists: await repository.list(filters, taxonomy), taxonomy };
  }

  async getBySlug(locale: ScientistLocale, slug: string) {
    if (!isSupabaseConfigured()) return null;
    const client = createPublicSupabaseClient();
    return new PublicScientistRepository(client).getBySlug(locale, slug);
  }
}

export const getPublicScientistBySlug = cache((locale: ScientistLocale, slug: string) =>
  new PublicScientistService().getBySlug(locale, slug),
);
