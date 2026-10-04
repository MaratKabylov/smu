import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/permissions";
import { ArticleServiceError } from "./article.service";
import { ArticleRelationsRepository } from "@/server/repositories/article-relations.repository";
import type { AccessContext, PermissionCode } from "@/types/domain/auth";
import type { ArticleRelationKind } from "@/types/domain/article-relations";
import type { ArticleLocale } from "@/types/domain/article";

export class ArticleRelationsService {
  async search(access: AccessContext, kind: ArticleRelationKind, query = "", ids: string[] | null = null) {
    const permissions: PermissionCode[] = ["articles.create", "articles.edit_own", "articles.edit_any", "articles.review", "articles.publish", "publications.manage"];
    if (!hasPermission(access, "admin.access") || !permissions.some(p => hasPermission(access, p))) {
      throw new ArticleServiceError("forbidden", "Недостаточно прав.");
    }
    return new ArticleRelationsRepository(await createServerSupabaseClient()).search(kind, query, ids);
  }
  async publicRelations(id: string, locale: ArticleLocale) {
    return new ArticleRelationsRepository(await createServerSupabaseClient()).publicRelations(id, locale);
  }
  async relatedArticles(kind: ArticleRelationKind, id: string, locale: ArticleLocale) {
    return new ArticleRelationsRepository(await createServerSupabaseClient()).relatedArticles(kind, id, locale);
  }
}
