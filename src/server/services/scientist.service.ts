import "server-only";

import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { canEditScientist, canVerifyScientist } from "@/lib/permissions/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type {
  PublicScientistFilters,
  ScientistInput,
  ScientistListFilters,
  ScientistTaxonomyInput,
} from "@/lib/validation/scientist";
import { AuditRepository } from "@/server/repositories/audit.repository";
import { PublicScientistRepository, ScientistRepository } from "@/server/repositories/scientist.repository";
import type { AccessContext } from "@/types/domain/auth";
import type { ScientistLocale, ScientistStatus, ScientistTaxonomy } from "@/types/domain/scientist";

type ScientistServiceErrorCode = "forbidden" | "not_found" | "invalid_reference" | "invalid_transition";

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

  async create(access: AccessContext, input: ScientistInput) {
    assertAllowed(canEditScientist(access));
    const client = createServiceRoleSupabaseClient();
    const repository = new ScientistRepository(client);
    await this.assertReferences(repository, input);
    const id = await repository.create(access.userId, input);
    await new AuditRepository(client).create({
      userId: access.userId,
      entityType: "scientist_profile",
      entityId: id,
      action: "scientist.create",
      newData: this.auditInput(input),
    });
    return id;
  }

  async update(access: AccessContext, id: string, input: ScientistInput) {
    assertAllowed(canEditScientist(access));
    const client = createServiceRoleSupabaseClient();
    const repository = new ScientistRepository(client);
    const current = await repository.getById(id);
    if (!current || current.deletedAt) throw new ScientistServiceError("not_found", "Профиль не найден.");
    await this.assertReferences(repository, input);
    await repository.update(id, input);
    if (current.status === "verified") {
      await repository.changeStatus(id, "draft", access.userId);
    }
    await new AuditRepository(client).create({
      userId: access.userId,
      entityType: "scientist_profile",
      entityId: id,
      action: "scientist.update",
      oldData: { organizationId: current.organizationId, avatarMediaId: current.avatarMediaId },
      newData: this.auditInput(input),
    });
  }

  async changeStatus(access: AccessContext, id: string, nextStatus: ScientistStatus) {
    assertAllowed(canVerifyScientist(access));
    const client = createServiceRoleSupabaseClient();
    const repository = new ScientistRepository(client);
    const current = await repository.getById(id);
    if (!current || current.deletedAt) throw new ScientistServiceError("not_found", "Профиль не найден.");
    const allowed =
      current.status === nextStatus ||
      (current.status === "draft" && nextStatus === "verified") ||
      (current.status === "verified" && nextStatus === "draft");
    if (!allowed) throw new ScientistServiceError("invalid_transition", "Недоступное изменение статуса.");
    await repository.changeStatus(id, nextStatus, access.userId);
    await new AuditRepository(client).create({
      userId: access.userId,
      entityType: "scientist_profile",
      entityId: id,
      action: "scientist.status.change",
      oldData: { status: current.status },
      newData: { status: nextStatus },
    });
  }

  async softDelete(access: AccessContext, id: string) {
    assertAllowed(canEditScientist(access));
    const client = createServiceRoleSupabaseClient();
    const repository = new ScientistRepository(client);
    const current = await repository.getById(id);
    if (!current || current.deletedAt) throw new ScientistServiceError("not_found", "Профиль не найден.");
    await repository.softDelete(id);
    await new AuditRepository(client).create({
      userId: access.userId,
      entityType: "scientist_profile",
      entityId: id,
      action: "scientist.soft_delete",
      oldData: { status: current.status },
      newData: { deletedAt: new Date().toISOString() },
    });
  }

  async createTaxonomyItem(access: AccessContext, input: ScientistTaxonomyInput) {
    assertAllowed(canEditScientist(access));
    const client = createServiceRoleSupabaseClient();
    const id = await new ScientistRepository(client).createTaxonomyItem(input);
    await new AuditRepository(client).create({
      userId: access.userId,
      entityType: input.kind === "field" ? "scientific_field" : "scientific_organization",
      entityId: id,
      action: `scientist.${input.kind}.create`,
      newData: input,
    });
  }

  private async assertReferences(repository: ScientistRepository, input: ScientistInput) {
    const [taxonomy, avatarIsUsable] = await Promise.all([
      repository.listTaxonomy(),
      input.avatarMediaId ? repository.isUsableAvatar(input.avatarMediaId) : Promise.resolve(true),
    ]);
    if (
      (input.organizationId && !taxonomy.organizations.some((item) => item.id === input.organizationId)) ||
      input.fieldIds.some((id) => !taxonomy.fields.some((item) => item.id === id)) ||
      !avatarIsUsable
    ) {
      throw new ScientistServiceError("invalid_reference", "Организация, направление или аватар недоступны.");
    }
  }

  private auditInput(input: ScientistInput) {
    return {
      organizationId: input.organizationId,
      avatarMediaId: input.avatarMediaId,
      fieldIds: input.fieldIds,
      publicEmail: input.publicEmail,
      orcid: input.orcid,
      translations: {
        ru: { fullName: input.ru.fullName, slug: input.ru.slug },
        kk: { fullName: input.kk.fullName, slug: input.kk.slug },
      },
    };
  }
}

const emptyTaxonomy: ScientistTaxonomy = { organizations: [], fields: [] };

export class PublicScientistService {
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
