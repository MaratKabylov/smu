import "server-only";

import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { canEditScientist, canVerifyScientist } from "@/lib/permissions/permissions";
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
import type { AccessContext } from "@/types/domain/auth";
import type { ScientistLocale, ScientistStatus, ScientistTaxonomy } from "@/types/domain/scientist";

type ScientistServiceErrorCode = "forbidden" | "not_found" | "invalid_reference" | "invalid_transition" | "invalid_input" | "slug_conflict" | "slug_reserved";

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

  async softDelete(access: AccessContext, id: string) {
    assertAllowed(canEditScientist(access));
    return this.repository((repository) => repository.softDelete(id));
  }

  async createTaxonomyItem(access: AccessContext, input: ScientistTaxonomyInput) {
    assertAllowed(canEditScientist(access));
    return this.repository((repository) => repository.createTaxonomyItem(input));
  }

}

const emptyTaxonomy: ScientistTaxonomy = { organizations: [], fields: [] };

export class PublicScientistService {
  async getSlugRedirect(locale: ScientistLocale, slug: string) {
    if (!isSupabaseConfigured()) return null;
    return getPublicSlugRedirect(await createServerSupabaseClient(), "scientist", locale, slug);
  }
  async list(filters: PublicScientistFilters) {
    if (!isSupabaseConfigured()) return { scientists: [], taxonomy: emptyTaxonomy };
    const client = await createServerSupabaseClient();
    const repository = new PublicScientistRepository(client);
    const taxonomy = await repository.listTaxonomy();
    return { scientists: await repository.list(filters, taxonomy), taxonomy };
  }

  async getBySlug(locale: ScientistLocale, slug: string) {
    if (!isSupabaseConfigured()) return null;
    const client = await createServerSupabaseClient();
    return new PublicScientistRepository(client).getBySlug(locale, slug);
  }
}

export const getPublicScientistBySlug = cache((locale: ScientistLocale, slug: string) =>
  new PublicScientistService().getBySlug(locale, slug),
);
