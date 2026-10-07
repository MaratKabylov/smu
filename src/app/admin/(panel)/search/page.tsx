import type { Metadata } from "next";
import { getAdminAccess } from "@/server/services/access.service";
import { SearchService } from "@/server/services/search.service";
import { Pagination } from "@/components/search/Pagination";
import { SearchResults } from "@/components/search/SearchResults";
import { readPage, readSearch, searchSections, searchSectionLabels } from "@/lib/search";
import type { PublicQuery } from "@/lib/i18n/locales";

export const metadata: Metadata = { title: "Поиск — SMU Admin", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<PublicQuery> }) {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return null;
  const state = await searchParams;
  const query = readSearch(state.q);
  const section = searchSections.find(item => item === state.section) ?? "";
  const result = await new SearchService().adminPage(access.access, query, section, readPage(state.page));
  return <div className="content-page platform-search"><h1>Поиск по платформе</h1>
    <form action="/admin/search" className="science-filters">
      <label><span className="visually-hidden">Поиск</span><input name="q" type="search" defaultValue={query} maxLength={120} placeholder="Имя, название или текст" /></label>
      <select name="section" defaultValue={section} aria-label="Раздел"><option value="">Все разделы</option>
        {searchSections.map(item => <option key={item} value={item}>{searchSectionLabels.ru[item]}</option>)}
      </select><button type="submit">Найти</button>
    </form><SearchResults result={result} locale="ru" query={query} />
    <Pagination {...result} locale="ru" path="/admin/search" query={state} />
  </div>;
}
