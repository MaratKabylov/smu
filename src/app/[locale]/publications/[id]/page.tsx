import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PublicationService } from "@/server/services/publication.service";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { RelatedArticles } from "@/components/articles/PublicArticleRelations";
import { publicationTypeLabels } from "@/types/domain/publication";
import type { ArticleLocale } from "@/types/domain/article";
import { isLocale } from "@/lib/i18n/locales";
type Props = { params: Promise<{ locale: string; id: string }> };
async function detail(params: Props["params"]) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(id).success) notFound();
  const [publication] = await new PublicationService().listPublic(locale, id);
  if (!publication) notFound();
  return { publication, locale: locale as ArticleLocale };
}
export async function generateMetadata({ params }: Props) {
  const { publication } = await detail(params);
  return { title: publication.title, description: `${publication.journal}, ${publication.year}` };
}
export default async function Page({ params }: Props) {
  const { publication: item, locale } = await detail(params);
  return <><PublicHeader locale={locale} section="publications" paths={{ ru: `/ru/publications/${item.id}`, kk: `/kk/publications/${item.id}`, en: `/en/publications/${item.id}` }} /><main className="public-article-page"><div className="public-article-shell">
    <nav className="public-breadcrumbs"><Link href={`/${locale}/publications`}>{locale === "ru" ? "Научные публикации" : "Ғылыми жарияланымдар"}</Link><Link href={`/${locale === "ru" ? "kk" : "ru"}/publications/${item.id}`}>{locale === "ru" ? "Қазақша" : "Русский"}</Link></nav>
    <header className="public-article-header"><small>{publicationTypeLabels[locale][item.publicationType]}</small><h1>{item.title}</h1><p>{item.journal} · {item.year}</p><Link href={item.scientistHref}>{item.scientistName}</Link></header>
    <div className="preview-links">{item.doi ? <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noreferrer">DOI: {item.doi}</a> : null}{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{locale === "ru" ? "Открыть публикацию" : "Жарияланымды ашу"}</a> : null}</div>
    <RelatedArticles kind="publication" id={item.id} locale={locale} />
  </div></main></>;
}
