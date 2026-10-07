import type { Metadata } from "next";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { publicSections, type PublicQuery } from "@/lib/i18n/locales";
import { readPage, readSearch, searchCopy, searchSectionLabels } from "@/lib/search";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { Pagination } from "@/components/search/Pagination";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchService } from "@/server/services/search.service";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  return { title: searchCopy[requireLocale((await params).locale)].title, robots: { index: false, follow: true } };
}
export default async function Page({ params, searchParams }: { params: LocaleParams; searchParams: Promise<PublicQuery> }) {
  const locale = requireLocale((await params).locale);
  const state = await searchParams;
  const query = readSearch(state.q);
  const sections = [...publicSections, "organizations"] as const;
  const section = sections.find(item => item === state.section) ?? "";
  const result = await new SearchService().publicPage(locale, query, section, readPage(state.page));
  const text = searchCopy[locale];
  const path = `/${locale}/search`;
  return <><PublicHeader locale={locale} section="journal" paths={{ ru: "/ru/search", kk: "/kk/search", en: "/en/search" }} />
    <main className="public-article-shell platform-search"><h1>{text.title}</h1>
      <form action={path} className="science-filters">
        <label><span className="visually-hidden">{text.input}</span><input type="search" name="q" defaultValue={query} maxLength={120} placeholder={text.input} /></label>
        <select name="section" defaultValue={section} aria-label={getDictionary(locale).common.navigation}>
          <option value="">{text.all}</option>{sections.map(item => <option key={item} value={item}>{searchSectionLabels[locale][item]}</option>)}
        </select><button type="submit">{text.find}</button>
      </form>
      <SearchResults result={result} locale={locale} query={query} />
      <Pagination {...result} locale={locale} path={path} query={state} />
    </main></>;
}
