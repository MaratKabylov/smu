import { catalogMetadata } from "@/lib/seo/metadata";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { PublicationAuthors } from "@/components/science/PublicPublications";
import Link from "next/link";
import { PublicationService } from "@/server/services/publication.service";
import { Pagination } from "@/components/search/Pagination";
import { readPage, readSearch, searchCopy } from "@/lib/search";
import type { PublicQuery } from "@/lib/i18n/locales";
export async function generateMetadata({ params, searchParams }: { params: LocaleParams; searchParams: Promise<PublicQuery> }) {
  const locale = requireLocale((await params).locale);
  return catalogMetadata(locale, "publications", getDictionary(locale).common.brands.publications, getDictionary(locale).science.intro, await searchParams);
}
export default async function Page({ params, searchParams }: { params: LocaleParams; searchParams: Promise<PublicQuery> }) {
  const locale = requireLocale((await params).locale);
  const state = await searchParams;
  const query = readSearch(state.q);
  const { publications, pagination } = await new PublicationService().listPublicPage(locale, query, readPage(state.page));
  const text = searchCopy[locale];
  return <><PublicHeader locale={locale} section="publications" /><main className="public-article-page"><div className="public-article-shell"><h1>{locale === "ru" ? "Научные публикации" : locale === "en" ? "Scientific publications" : "Ғылыми жарияланымдар"}</h1>
    <form action={`/${locale}/publications`} className="science-filters"><label><span className="visually-hidden">{text.input}</span><input name="q" type="search" defaultValue={query} maxLength={120} placeholder={text.input} /></label><button type="submit">{text.find}</button></form>
    <p>{text.results}: {pagination.total}</p>
    <section className="public-relations"><ul>{publications.map(item => <li key={item.id}><Link href={`/${locale}/publications/${item.id}`}>{item.title}</Link><p>{item.year} · {item.journal}</p><PublicationAuthors item={item} /></li>)}</ul>{!publications.length ? <p>{locale === "ru" ? "Публикаций пока нет." : locale === "en" ? "No publications yet." : "Жарияланымдар әзірге жоқ."}</p> : null}</section>
    <Pagination {...pagination} locale={locale} path={`/${locale}/publications`} query={state} />
  </div></main></>;
}
