import "server-only";

import {
  canCreateArticle, canDeleteArticle, canEditArticle, canPublishArticle,
  canReviewArticle, hasPermission,
} from "@/lib/permissions/permissions";
import { databaseErrorCode } from "@/lib/security/database-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ArticleInput, ArticleListFilters, TaxonomyInput } from "@/lib/validation/article";
import { ArticleRepository } from "@/server/repositories/article.repository";
import type { AccessContext } from "@/types/domain/auth";
import type { ArticleStatus } from "@/types/domain/article";

type ArticleServiceErrorCode = "forbidden" | "not_found" | "invalid_transition" |
  "invalid_reference" | "invalid_input" | "slug_conflict" | "slug_reserved" | "stale_version";
export class ArticleServiceError extends Error {
  constructor(public readonly code: ArticleServiceErrorCode, message: string) {
    super(message); this.name = "ArticleServiceError";
  }
}
function assertAllowed(allowed: boolean) {
  if (!allowed) throw new ArticleServiceError("forbidden", "Недостаточно прав.");
}
const canAssignReviewer = (access: AccessContext) =>
  hasPermission(access, "articles.edit_any") || canPublishArticle(access);

export class ArticleService {
  private async repository<T>(operation: (repository: ArticleRepository) => Promise<T>): Promise<T> {
    const repository = new ArticleRepository(await createServerSupabaseClient());
    try { return await operation(repository); }
    catch (error) {
      const code = databaseErrorCode(error);
      if (code) throw new ArticleServiceError(code as ArticleServiceErrorCode, "Операция не выполнена.");
      throw error;
    }
  }

  async list(_access: AccessContext, filters: ArticleListFilters) {
    return this.repository((repository) => repository.list(filters));
  }

  async getById(access: AccessContext, id: string) {
    return this.repository(async (repository) => {
      const article = await repository.getById(id);
      if (!article || article.deletedAt) return null;
      return article.status === "published" || canEditArticle(access, article.authorId) ||
        canReviewArticle(access, article.scientificReviewerId) || canPublishArticle(access) ? article : null;
    });
  }

  async listTaxonomy(access: AccessContext, includeInactive = false) {
    assertAllowed(canCreateArticle(access) || canEditArticle(access) ||
      hasPermission(access, "articles.review") || canPublishArticle(access));
    return this.repository((repository) => repository.listTaxonomy(includeInactive));
  }

  async create(access: AccessContext, input: ArticleInput) {
    assertAllowed(canCreateArticle(access));
    return this.repository((repository) => repository.create(input));
  }

  async update(access: AccessContext, id: string, input: ArticleInput) {
    return this.repository(async (repository) => {
      const article = await repository.getById(id);
      if (!article || article.deletedAt) throw new ArticleServiceError("not_found", "Статья не найдена.");
      assertAllowed(canEditArticle(access, article.authorId));
      assertAllowed(article.status === "draft" || hasPermission(access, "articles.edit_any"));
      assertAllowed(article.status !== "archived" || canPublishArticle(access));
      if (!input.expectedVersion || input.expectedVersion !== article.contentVersion) {
        throw new ArticleServiceError("stale_version", "Материал изменился. Ваши правки сохранены в редакторе; откройте актуальную версию отдельно.");
      }
      // SQL rechecks current ownership/permissions under a lock and resets approval
      // together with content, translations, relations and the audit entry.
      await repository.update(id, input);
      return input.expectedVersion + 1;
    });
  }

  async getPreview(access: AccessContext, id: string) {
    const article = await this.getById(access, id);
    if (!article || !(canEditArticle(access, article.authorId) ||
      canReviewArticle(access, article.scientificReviewerId) || canPublishArticle(access))) return null;
    return article;
  }

  async changeStatus(access: AccessContext, id: string, nextStatus: ArticleStatus, expectedVersion?: number) {
    return this.repository(async (repository) => {
      const article = await repository.getById(id);
      if (!article || article.deletedAt) throw new ArticleServiceError("not_found", "Статья не найдена.");
      if (!this.canTransition(access, article.authorId, article.scientificReviewerId, article.status, nextStatus)) {
        throw new ArticleServiceError("invalid_transition", "Недоступный переход редакционного статуса.");
      }
      if (expectedVersion !== undefined && expectedVersion !== article.contentVersion) {
        throw new ArticleServiceError("stale_version", "Материал изменился. Обновите страницу перед проверкой.");
      }
      await repository.changeStatus(id, nextStatus, expectedVersion ?? article.contentVersion);
    });
  }

  async softDelete(access: AccessContext, id: string) {
    assertAllowed(canDeleteArticle(access));
    return this.repository((repository) => repository.softDelete(id));
  }

  async createTaxonomyItem(access: AccessContext, input: TaxonomyInput) {
    assertAllowed(hasPermission(access, "articles.edit_any"));
    return this.repository((repository) => repository.createTaxonomyItem(input));
  }

  async listReviewers(access: AccessContext) {
    assertAllowed(canAssignReviewer(access));
    return this.repository((repository) => repository.listReviewers());
  }

  async assignReviewer(access: AccessContext, id: string, reviewerId: string | null) {
    assertAllowed(canAssignReviewer(access));
    return this.repository((repository) => repository.assignReviewer(id, reviewerId));
  }

  private canTransition(access: AccessContext, authorId: string, reviewerId: string | null,
    current: ArticleStatus, next: ArticleStatus) {
    if (current === next) return false;
    const edit = canEditArticle(access, authorId);
    const review = canReviewArticle(access, reviewerId);
    const publish = canPublishArticle(access);
    if (current === "draft" && next === "in_review") return edit;
    if (current === "in_review" && next === "draft") return review || edit;
    if (current === "in_review" && next === "approved") return review;
    if (current === "approved" && next === "draft") return review || publish;
    if (current === "approved" && next === "published") return publish;
    if (current === "published" && (next === "archived" || next === "draft")) return publish;
    if (current === "archived" && next === "draft") return publish;
    return false;
  }
}
