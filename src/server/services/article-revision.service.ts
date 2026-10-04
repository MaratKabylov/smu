import "server-only";
import { canEditArticle, canPublishArticle, canReviewArticle, hasPermission } from "@/lib/permissions/permissions";
import { databaseErrorCode } from "@/lib/security/database-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ArticleRepository } from "@/server/repositories/article.repository";
import { ArticleRevisionRepository } from "@/server/repositories/article-revision.repository";
import { ArticleServiceError } from "@/server/services/article.service";
import type { Article } from "@/types/domain/article";
import type { AccessContext } from "@/types/domain/auth";

export function canManageArticleRevisions(access: AccessContext, article: Article) {
  return hasPermission(access, "admin.access") && !article.deletedAt && canEditArticle(access, article.authorId) &&
    (article.status === "draft" || hasPermission(access, "articles.edit_any")) &&
    (article.status !== "archived" || canPublishArticle(access));
}
export function canReadArticleRevisions(access: AccessContext, article: Article) {
  return hasPermission(access, "admin.access") && !article.deletedAt &&
    (canEditArticle(access, article.authorId) || canPublishArticle(access) || canReviewArticle(access, article.scientificReviewerId));
}

export class ArticleRevisionService {
  private async withArticle<T>(access: AccessContext, id: string, write: boolean,
    operation: (repository: ArticleRevisionRepository, article: Article) => Promise<T>) {
    if (!hasPermission(access, "admin.access")) throw new ArticleServiceError("forbidden", "Недостаточно прав.");
    const client = await createServerSupabaseClient();
    try {
      const article = await new ArticleRepository(client).getById(id);
      if (!article || article.deletedAt) throw new ArticleServiceError("not_found", "Статья не найдена.");
      if (!(write ? canManageArticleRevisions(access, article) : canReadArticleRevisions(access, article))) {
        throw new ArticleServiceError("forbidden", "Недостаточно прав.");
      }
      return await operation(new ArticleRevisionRepository(client), article);
    } catch (error) {
      const code = databaseErrorCode(error);
      if (code) throw new ArticleServiceError(code as ArticleServiceError["code"], "Операция с версией не выполнена.");
      throw error;
    }
  }

  async list(access: AccessContext, id: string, page = 1) {
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new ArticleServiceError("invalid_input", "Некорректная страница.");
    return this.withArticle(access, id, false, repository => repository.list(id, page));
  }

  async get(access: AccessContext, id: string, revisionId: string) {
    return this.withArticle(access, id, false, repository => repository.get(id, revisionId));
  }

  async create(access: AccessContext, id: string, expectedVersion: number) {
    return this.withArticle(access, id, true, (repository, article) => {
      this.assertVersion(article, expectedVersion);
      return repository.create(id, expectedVersion);
    });
  }

  async restore(access: AccessContext, id: string, revisionId: string, expectedVersion: number) {
    return this.withArticle(access, id, true, (repository, article) => {
      this.assertVersion(article, expectedVersion);
      return repository.restore(id, revisionId, expectedVersion);
    });
  }

  private assertVersion(article: Article, expectedVersion: number) {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== article.contentVersion) {
      throw new ArticleServiceError("stale_version", "Материал изменился. Обновите страницу перед действием с версией.");
    }
  }
}
