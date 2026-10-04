import Link from "next/link";
import { ArticleRelationsService } from "@/server/services/article-relations.service";
import type { ArticleLocale } from "@/types/domain/article";
import { relationKindLabels, relationTypeLabels, type ArticleRelationKind } from "@/types/domain/article-relations";

export async function PublicArticleRelations({ id, locale }: { id: string; locale: ArticleLocale }) {
  const links = await new ArticleRelationsService().publicRelations(id, locale);
  if (!links.length) return null;
  return <section className="public-relations"><h2>{locale === "ru" ? "Связанные научные объекты" : "Байланысты ғылыми нысандар"}</h2>
    <ul>{links.map(link => <li key={`${link.kind}:${link.entityId}`}><small>{relationKindLabels[locale][link.kind]} · {relationTypeLabels[locale][link.relationType]}</small><Link href={link.href}>{link.title}</Link></li>)}</ul>
  </section>;
}
export async function RelatedArticles({ kind, id, locale }: { kind: ArticleRelationKind; id: string; locale: ArticleLocale }) {
  const articles = await new ArticleRelationsService().relatedArticles(kind, id, locale);
  if (!articles.length) return null;
  return <section className="public-relations"><h2>{locale === "ru" ? "Материалы журнала" : "Журнал материалдары"}</h2>
    <ul>{articles.map(article => <li key={article.id}><small>{relationTypeLabels[locale][article.relationType]}</small><Link href={article.href}>{article.title}</Link><p>{article.excerpt}</p></li>)}</ul>
  </section>;
}
