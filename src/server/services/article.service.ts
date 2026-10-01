import "server-only";

import {
  canCreateArticle,
  canDeleteArticle,
  canEditArticle,
  canPublishArticle,
  canReviewArticle,
} from "@/lib/permissions/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type {
  ArticleInput,
  ArticleListFilters,
  TaxonomyInput,
} from "@/lib/validation/article";
import { ArticleRepository } from "@/server/repositories/article.repository";
import { AuditRepository } from "@/server/repositories/audit.repository";
import type { AccessContext } from "@/types/domain/auth";
import type { ArticleStatus } from "@/types/domain/article";

type ArticleServiceErrorCode =
  | "forbidden"
  | "not_found"
  | "invalid_transition"
  | "invalid_reference";

export class ArticleServiceError extends Error {
  constructor(
    public readonly code: ArticleServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ArticleServiceError";
  }
}

function assertAllowed(allowed: boolean) {
  if (!allowed) throw new ArticleServiceError("forbidden", "Недостаточно прав.");
}

export class ArticleService {
  async list(_access: AccessContext, filters: ArticleListFilters) {
    const client = await createServerSupabaseClient();
    return new ArticleRepository(client).list(filters);
  }

  async getById(access: AccessContext, id: string) {
    const client = await createServerSupabaseClient();
    const article = await new ArticleRepository(client).getById(id);
    if (!article) return null;

    const maySee =
      article.status === "published" ||
      canEditArticle(access, article.authorId) ||
      canReviewArticle(access) ||
      canPublishArticle(access);
    return maySee ? article : null;
  }

  async listTaxonomy(access: AccessContext, includeInactive = false) {
    assertAllowed(
      canCreateArticle(access) ||
        canEditArticle(access) ||
        canReviewArticle(access) ||
        canPublishArticle(access),
    );
    const client = await createServerSupabaseClient();
    return new ArticleRepository(client).listTaxonomy(includeInactive);
  }

  async create(access: AccessContext, input: ArticleInput) {
    assertAllowed(canCreateArticle(access));
    const client = createServiceRoleSupabaseClient();
    const repository = new ArticleRepository(client);
    await this.assertReferences(repository, input);
    const articleId = await repository.create(access.userId, input);

    await new AuditRepository(client).create({
      userId: access.userId,
      entityType: "article",
      entityId: articleId,
      action: "article.create",
      newData: this.auditInput(input),
    });
    return articleId;
  }

  async update(access: AccessContext, id: string, input: ArticleInput) {
    const client = createServiceRoleSupabaseClient();
    const repository = new ArticleRepository(client);
    const article = await repository.getById(id);
    if (!article || article.deletedAt) {
      throw new ArticleServiceError("not_found", "Статья не найдена.");
    }
    assertAllowed(canEditArticle(access, article.authorId));
    if (article.status !== "draft" && !canPublishArticle(access)) {
      throw new ArticleServiceError(
        "forbidden",
        "Перед редактированием верните статью в черновики.",
      );
    }

    await this.assertReferences(repository, input);
    await repository.update(id, input);
    await new AuditRepository(client).create({
      userId: access.userId,
      entityType: "article",
      entityId: id,
      action: "article.update",
      oldData: {
        contentType: article.contentType,
        categoryId: article.categoryId,
        coverMediaId: article.coverMediaId,
      },
      newData: this.auditInput(input),
    });
  }

  async changeStatus(
    access: AccessContext,
    id: string,
    nextStatus: ArticleStatus,
  ) {
    const client = createServiceRoleSupabaseClient();
    const repository = new ArticleRepository(client);
    const article = await repository.getById(id);
    if (!article || article.deletedAt) {
      throw new ArticleServiceError("not_found", "Статья не найдена.");
    }

    const allowed = this.canTransition(
      access,
      article.authorId,
      article.status,
      nextStatus,
    );
    if (!allowed) {
      throw new ArticleServiceError(
        "invalid_transition",
        "Недоступный переход редакционного статуса.",
      );
    }

    await repository.changeStatus(id, nextStatus);
    await new AuditRepository(client).create({
      userId: access.userId,
      entityType: "article",
      entityId: id,
      action: "article.status.change",
      oldData: { status: article.status },
      newData: { status: nextStatus },
    });
  }

  async softDelete(access: AccessContext, id: string) {
    assertAllowed(canDeleteArticle(access));
    const client = createServiceRoleSupabaseClient();
    const repository = new ArticleRepository(client);
    const article = await repository.getById(id);
    if (!article || article.deletedAt) {
      throw new ArticleServiceError("not_found", "Статья не найдена.");
    }
    await repository.softDelete(id);
    await new AuditRepository(client).create({
      userId: access.userId,
      entityType: "article",
      entityId: id,
      action: "article.soft_delete",
      oldData: { status: article.status },
      newData: { deletedAt: new Date().toISOString() },
    });
  }

  async createTaxonomyItem(access: AccessContext, input: TaxonomyInput) {
    assertAllowed(canEditArticle(access));
    const client = createServiceRoleSupabaseClient();
    const entityId = await new ArticleRepository(client).createTaxonomyItem(input);
    await new AuditRepository(client).create({
      userId: access.userId,
      entityType: `article_${input.kind}`,
      entityId,
      action: `article.${input.kind}.create`,
      newData: {
        slug: input.slug,
        nameRu: input.nameRu,
        nameKk: input.nameKk,
      },
    });
  }

  private async assertReferences(
    repository: ArticleRepository,
    input: ArticleInput,
  ) {
    const [taxonomy, coverIsUsable] = await Promise.all([
      repository.listTaxonomy(),
      input.coverMediaId
        ? repository.isUsableCover(input.coverMediaId)
        : Promise.resolve(true),
    ]);
    if (
      (input.categoryId &&
        !taxonomy.categories.some((item) => item.id === input.categoryId)) ||
      input.tagIds.some((tagId) =>
        !taxonomy.tags.some((item) => item.id === tagId)
      ) ||
      !coverIsUsable
    ) {
      throw new ArticleServiceError(
        "invalid_reference",
        "Категория или тег недоступны.",
      );
    }
  }

  private canTransition(
    access: AccessContext,
    authorId: string,
    current: ArticleStatus,
    next: ArticleStatus,
  ) {
    if (current === next) return true;
    if (current === "draft" && next === "in_review") {
      return canEditArticle(access, authorId);
    }
    if (current === "in_review" && next === "draft") {
      return canReviewArticle(access) || canEditArticle(access, authorId);
    }
    if (current === "in_review" && next === "approved") {
      return canReviewArticle(access);
    }
    if (current === "approved" && next === "draft") {
      return canReviewArticle(access) || canPublishArticle(access);
    }
    if (current === "approved" && next === "published") {
      return canPublishArticle(access);
    }
    if (current === "published" && next === "archived") {
      return canPublishArticle(access);
    }
    if (current === "archived" && next === "draft") {
      return canPublishArticle(access);
    }
    return false;
  }

  private auditInput(input: ArticleInput) {
    return {
      contentType: input.contentType,
      categoryId: input.categoryId,
      coverMediaId: input.coverMediaId,
      tagIds: input.tagIds,
      translations: {
        ru: { title: input.ru.title, slug: input.ru.slug },
        kk: { title: input.kk.title, slug: input.kk.slug },
      },
    };
  }
}
