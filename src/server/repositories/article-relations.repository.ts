import { canonicalPublicHref } from "@/lib/i18n/locales";
import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import { requiredFields } from "@/lib/supabase/database";
import { z } from "zod";
import { articleRelationKinds, articleRelationTypes, type ArticleRelationKind, type ArticleRelationLink, type ArticleRelationOption, type PublicRelation, type RelatedArticle } from "@/types/domain/article-relations";
import type { ArticleLocale } from "@/types/domain/article";

const tables = {
  scientist: "article_scientists", project: "article_projects",
  research: "article_research", event: "article_events", publication: "article_publications",
} as const;
export class ArticleRelationsRepository {
  constructor(private readonly client: DatabaseClient) {}
  async loadLinks(ids: string[]) {
    const result = new Map(ids.map(id => [id, [] as ArticleRelationLink[]]));
    if (!ids.length) return result;
    const groups = await Promise.all(articleRelationKinds.map(async kind => {
      const { data, error } = await this.client.from(tables[kind]).select("*").in("article_id", ids);
      if (error) throw error;
      return (data ?? []).map(row => ({ articleId: row.article_id, order: row.sort_order, link: {
        kind, entityId: "scientist_id" in row ? row.scientist_id : "project_id" in row ? row.project_id : "research_id" in row ? row.research_id : "event_id" in row ? row.event_id : row.publication_id, relationType: row.relation_type,
      } }));
    }));
    for (const row of groups.flat().sort((a, b) => a.order - b.order)) result.get(row.articleId)?.push(row.link);
    return result;
  }
  async search(kind: ArticleRelationKind, query = "", ids: string[] | null = null): Promise<ArticleRelationOption[]> {
    const { data, error } = await this.client.rpc("search_article_relation_targets", { p_kind: kind, p_query: query, p_ids: ids });
    if (error) throw error;
    return (data ?? []).map(value => {
      const row = requiredFields(value, "entity_id", "title_ru", "title_kk");
      return { kind: z.enum(articleRelationKinds).parse(row.kind), entityId: row.entity_id, titleRu: row.title_ru, titleKk: row.title_kk };
    });
  }
  async publicRelations(id: string, locale: ArticleLocale): Promise<PublicRelation[]> {
    const { data, error } = await this.client.rpc("public_article_relations", { p_article: id, p_locale: locale });
    if (error) throw error;
    return (data ?? []).map(value => {
      const row = requiredFields(value, "entity_id", "title", "href");
      return { kind: z.enum(articleRelationKinds).parse(row.kind), entityId: row.entity_id, title: row.title, href: canonicalPublicHref(row.href), relationType: z.enum(articleRelationTypes).parse(row.relation_type) };
    });
  }
  async relatedArticles(kind: ArticleRelationKind, id: string, locale: ArticleLocale): Promise<RelatedArticle[]> {
    const { data, error } = await this.client.rpc("public_related_articles", { p_kind: kind, p_entity: id, p_locale: locale });
    if (error) throw error;
    return (data ?? []).map(value => {
      const row = requiredFields(value, "id", "title", "href", "excerpt");
      return { id: row.id, title: row.title, href: canonicalPublicHref(row.href), excerpt: row.excerpt, relationType: z.enum(articleRelationTypes).parse(row.relation_type) };
    });
  }
}
