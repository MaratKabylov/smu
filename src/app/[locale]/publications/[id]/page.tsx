import { cache } from "react";
import { SeoService } from "@/server/services/seo.service";
import { absoluteUrl } from "@/lib/seo/site";
import { openGraphLocale } from "@/lib/seo/metadata";
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
const publicationByLocale = cache(async (locale: ArticleLocale, id: string) => {
  const [publication] = await new PublicationService().listPublic(locale, id);
  const paths = await new SeoService().paths("publications", id);
  return { publication, paths };
});
async function detail(params: Props["params"]) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(id).success) notFound();
  const { publication, paths } = await publicationByLocale(locale, id);
  if (!publication) notFound();
  return { publication, paths, locale: locale as ArticleLocale };
}
export async function generateMetadata({ params }: Props) {
  const { publication, paths, locale } = await detail(params);
  const canonical = absoluteUrl(`/${locale}/publications/${publication.id}`);
  return { title: publication.title, description: `${publication.journal}, ${publication.year}`, alternates: { canonical, languages: Object.fromEntries(Object.entries(paths).map(([l, path]) => [l, absoluteUrl(path)])), types: { "application/rss+xml": absoluteUrl(`/${locale}/feed.xml`) } }, openGraph: { title: publication.title, url: canonical, locale: openGraphLocale[locale] } };
}
export default async function Page({ params }: Props) {
  const { publication: item, locale, paths } = await detail(params);
  return <><PublicHeader locale={locale} section="publications" paths={paths} /><main className="public-article-page"><div className="public-article-shell">
    <nav className="public-breadcrumbs"><Link href={`/${locale}/publications`}>{locale === "ru" ? "Научные публикации" : "Ғылыми жарияланымдар"}</Link></nav>
    <header className="public-article-header"><small>{publicationTypeLabels[locale][item.publicationType]}</small><h1>{item.title}</h1><p>{item.journal} · {item.year}</p><Link href={item.scientistHref}>{item.scientistName}</Link></header>
    <div className="preview-links">{item.doi ? <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noreferrer">DOI: {item.doi}</a> : null}{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{locale === "ru" ? "Открыть публикацию" : "Жарияланымды ашу"}</a> : null}</div>
    <RelatedArticles kind="publication" id={item.id} locale={locale} />
  </div></main></>;
}
