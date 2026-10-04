import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { articleRelationKinds, type ArticleRelationKind, type ArticleRelationLink, type ArticleRelationOption, type PublicRelation, type RelatedArticle } from "@/types/domain/article-relations";
import type { ArticleLocale } from "@/types/domain/article";

const tables = {
  scientist: ["article_scientists", "scientist_id"], project: ["article_projects", "project_id"],
  research: ["article_research", "research_id"], event: ["article_events", "event_id"], publication: ["article_publications", "publication_id"],
} as const;
export class ArticleRelationsRepository {
  constructor(private readonly client: SupabaseClient) {}
  async loadLinks(ids: string[]) {
    const result = new Map(ids.map(id => [id, [] as ArticleRelationLink[]]));
    if (!ids.length) return result;
    const groups = await Promise.all(articleRelationKinds.map(async kind => {
      const [table, column] = tables[kind];
      const { data, error } = await this.client.from(table).select(`article_id, ${column}, relation_type, sort_order`).in("article_id", ids);
      if (error) throw error;
      return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(row => ({ articleId: String(row.article_id), order: Number(row.sort_order), link: {
        kind, entityId: String(row[column]), relationType: row.relation_type as ArticleRelationLink["relationType"],
      } }));
    }));
    for (const row of groups.flat().sort((a, b) => a.order - b.order)) result.get(row.articleId)?.push(row.link);
    return result;
  }
  async search(kind: ArticleRelationKind, query = "", ids: string[] | null = null): Promise<ArticleRelationOption[]> {
    const { data, error } = await this.client.rpc("search_article_relation_targets", { p_kind: kind, p_query: query, p_ids: ids });
    if (error) throw error;
    return (data ?? []).map((row: { kind: ArticleRelationKind; entity_id: string; title_ru: string; title_kk: string }) => ({
      kind: row.kind, entityId: row.entity_id, titleRu: row.title_ru, titleKk: row.title_kk,
    }));
  }
  async publicRelations(id: string, locale: ArticleLocale): Promise<PublicRelation[]> {
    const { data, error } = await this.client.rpc("public_article_relations", { p_article: id, p_locale: locale });
    if (error) throw error;
    return (data ?? []).map((row: { kind: ArticleRelationKind; entity_id: string; title: string; href: string; relation_type: PublicRelation["relationType"] }) => ({
      kind: row.kind, entityId: row.entity_id, title: row.title, href: row.href, relationType: row.relation_type,
    }));
  }
  async relatedArticles(kind: ArticleRelationKind, id: string, locale: ArticleLocale): Promise<RelatedArticle[]> {
    const { data, error } = await this.client.rpc("public_related_articles", { p_kind: kind, p_entity: id, p_locale: locale });
    if (error) throw error;
    return (data ?? []).map((row: { id: string; title: string; href: string; excerpt: string; relation_type: RelatedArticle["relationType"] }) => ({
      id: row.id, title: row.title, href: row.href, excerpt: row.excerpt, relationType: row.relation_type,
    }));
  }
}
