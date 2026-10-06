import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArticleRevision, ArticleRevisionSummary, ArticleSnapshot } from "@/types/domain/article";

type RevisionRow = {
  id: string;
  article_id: string;
  revision_number: number;
  content_version: number;
  reason: ArticleRevisionSummary["reason"];
  title_ru: string;
  title_kk: string;
  created_by: string | null;
  is_system: boolean;
  creator: { display_name: string | null } | Array<{ display_name: string | null }> | null;
  created_at: string;
};
const summaryColumns = "id, article_id, revision_number, content_version, reason, title_ru, title_kk, created_by, is_system, created_at, creator:profiles!article_revisions_created_by_fkey(display_name)";
function summary(row: RevisionRow): ArticleRevisionSummary {
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  return {
    id: row.id, articleId: row.article_id, revisionNumber: row.revision_number,
    contentVersion: row.content_version, reason: row.reason, titleRu: row.title_ru,
    titleKk: row.title_kk, createdBy: row.created_by, createdByName: creator?.display_name ?? null, createdAt: row.created_at,
    isSystem: row.is_system,
  };
}

export class ArticleRevisionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(articleId: string, page: number): Promise<{ revisions: ArticleRevisionSummary[]; total: number }> {
    const pageSize = 20;
    const { data, error, count } = await this.client.from("article_revisions")
      .select(summaryColumns, { count: "exact" }).eq("article_id", articleId)
      .order("revision_number", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw error;
    return { revisions: ((data ?? []) as RevisionRow[]).map(summary), total: count ?? 0 };
  }

  async get(articleId: string, revisionId: string): Promise<ArticleRevision | null> {
    const { data, error } = await this.client.from("article_revisions")
      .select(`${summaryColumns}, snapshot`).eq("article_id", articleId).eq("id", revisionId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as RevisionRow & { snapshot: ArticleSnapshot };
    return { ...summary(row), snapshot: row.snapshot };
  }

  async create(articleId: string, expectedVersion: number): Promise<string> {
    const { data, error } = await this.client.rpc("create_article_revision", { p_id: articleId, p_expected_version: expectedVersion });
    if (error) throw error;
    return data as string;
  }

  async restore(articleId: string, revisionId: string, expectedVersion: number): Promise<number> {
    const { data, error } = await this.client.rpc("restore_article_revision", {
      p_id: articleId, p_revision: revisionId, p_expected_version: expectedVersion,
    });
    if (error) throw error;
    return data as number;
  }
}
