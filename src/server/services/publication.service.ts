import { SearchRepository } from "@/server/repositories/search.repository";
import { emptySearchPage, orderBySearch } from "@/lib/search";
import { isSupabaseConfigured } from "@/lib/env";
import "server-only";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { hasPermission } from "@/lib/permissions/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { databaseErrorCode } from "@/lib/security/database-error";
import { PublicationRepository } from "@/server/repositories/publication.repository";
import { ArticleServiceError } from "./article.service";
import type { AccessContext } from "@/types/domain/auth";
import type { ArticleLocale } from "@/types/domain/article";
import type { PublicationInput } from "@/lib/validation/publication";
export class PublicationService {
  async listPublicPage(locale: ArticleLocale, query: string, page = 1) {
    if (!isSupabaseConfigured()) return { publications: [], pagination: emptySearchPage(page) };
    const client = createPublicSupabaseClient();
    const pagination = await new SearchRepository(client).publicPage(locale, query, "publications", {}, page);
    if (!pagination.items.length) return { publications: [], pagination };
    const repository = new PublicationRepository(client);
    if (pagination.items.length === 1) {
      const publications = await repository.listPublic(locale, pagination.items[0].id);
      return { publications: orderBySearch(publications, pagination), pagination };
    }
    if (pagination.total <= 100) {
      const batch = await repository.listPublic(locale, null, null);
      const byId = new Map(batch.map(item => [item.id, item]));
      const missing = pagination.items.filter(item => !byId.has(item.id));
      if (!missing.length) {
        return { publications: orderBySearch(batch, pagination), pagination };
      }
      const extra = (await Promise.all(missing.map(item => repository.listPublic(locale, item.id)))).flat();
      return { publications: orderBySearch([...batch, ...extra], pagination), pagination };
    }
    const publications = (await Promise.all(pagination.items.map(item => repository.listPublic(locale, item.id)))).flat();
    return { publications: orderBySearch(publications, pagination), pagination };
  }

  private assertManager(access: AccessContext) {
    if (!hasPermission(access, "admin.access") || !hasPermission(access, "publications.manage")) throw new ArticleServiceError("forbidden", "Недостаточно прав.");
  }
  async list(access: AccessContext) {
    this.assertManager(access);
    return new PublicationRepository(await createServerSupabaseClient()).list();
  }
  async getById(access: AccessContext, id: string) {
    this.assertManager(access);
    return new PublicationRepository(await createServerSupabaseClient()).getById(id);
  }
  async save(access: AccessContext, id: string | null, input: PublicationInput) {
    this.assertManager(access);
    if (id && !input.expectedUpdatedAt) throw new ArticleServiceError("stale_version", "Обновите страницу.");
    try { return await new PublicationRepository(await createServerSupabaseClient()).save(id, input); }
    catch (error) {
      const code = databaseErrorCode(error);
      if (code) throw new ArticleServiceError(code as ArticleServiceError["code"], "Операция не выполнена.");
      throw error;
    }
  }
  async listPublicByWork(locale: ArticleLocale, workId: string) {
    if (!isSupabaseConfigured()) return [];
    return new PublicationRepository(createPublicSupabaseClient()).listPublicByWork(locale, workId);
  }
  async listPublic(locale: ArticleLocale, id: string | null = null, scientistId: string | null = null) {
    if (!isSupabaseConfigured()) return [];
    return new PublicationRepository(createPublicSupabaseClient()).listPublic(locale, id, scientistId);
  }
}
