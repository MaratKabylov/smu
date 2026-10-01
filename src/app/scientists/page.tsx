import type { Metadata } from "next";
import { Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { CommunityHeader } from "@/components/scientists/CommunityHeader";
import { PublicScientistCard } from "@/components/scientists/PublicScientistCard";
import { publicScientistFiltersSchema } from "@/lib/validation/scientist";
import { PublicScientistService } from "@/server/services/scientist.service";
import type { ScientistLocale } from "@/types/domain/scientist";

export const metadata: Metadata = {
  title: "Научное сообщество",
  description: "Каталог молодых учёных и исследователей Актюбинской области.",
};

type Props = { searchParams: Promise<{ lang?: string; q?: string; organization?: string; field?: string }> };

export default async function ScientistsPage({ searchParams }: Props) {
  const params = await searchParams;
  const parsed = publicScientistFiltersSchema.safeParse({
    locale: params.lang ?? "ru",
    query: params.q ?? "",
    organization: params.organization ?? "",
    field: params.field ?? "",
  });
  const filters = parsed.success ? parsed.data : { locale: "ru" as const, query: "", organization: "", field: "" };
  const { scientists, taxonomy } = await new PublicScientistService().list(filters);
  const copy = catalogCopy[filters.locale];
  return <>
    <CommunityHeader locale={filters.locale} />
    <main>
      <section className="scientists-hero"><div className="journal-hero-inner"><p className="journal-eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p><div className="scientists-stat"><strong>{scientists.length}</strong><span>{copy.profiles}</span></div></div></section>
      <section className="scientists-catalog">
        <form action="/scientists" className="scientists-filters">
          <input type="hidden" name="lang" value={filters.locale} />
          <label className="scientists-search"><Search aria-hidden="true" /><span className="visually-hidden">{copy.search}</span><input type="search" name="q" defaultValue={filters.query} placeholder={copy.search} /></label>
          <select name="organization" defaultValue={filters.organization} aria-label={copy.organization}><option value="">{copy.allOrganizations}</option>{taxonomy.organizations.map((item) => <option value={item.slug} key={item.id}>{filters.locale === "ru" ? item.nameRu : item.nameKk}</option>)}</select>
          <select name="field" defaultValue={filters.field} aria-label={copy.field}><option value="">{copy.allFields}</option>{taxonomy.fields.map((item) => <option value={item.slug} key={item.id}>{filters.locale === "ru" ? item.nameRu : item.nameKk}</option>)}</select>
          <button type="submit">{copy.find}</button>
        </form>
        {scientists.length ? <div className="scientists-grid">{scientists.map((scientist) => <PublicScientistCard scientist={scientist} locale={filters.locale} key={scientist.id} />)}</div> : <div className="journal-empty"><UsersRound aria-hidden="true" /><h2>{copy.empty}</h2><p>{copy.emptyHint}</p>{filters.query || filters.organization || filters.field ? <Link href={`/scientists?lang=${filters.locale}`}>{copy.reset}</Link> : null}</div>}
      </section>
    </main>
    <footer className="journal-footer"><span>© {new Date().getFullYear()} Совет молодых учёных</span><Link href={`/journal?lang=${filters.locale}`}>{copy.journal}</Link></footer>
  </>;
}

const catalogCopy: Record<ScientistLocale, Record<string, string>> = {
  ru: { eyebrow: "Люди науки", title: "Исследователи, которые развивают регион", intro: "Найдите экспертов, коллег и партнёров среди учёных Актюбинской области.", profiles: "профилей в каталоге", search: "Поиск по имени", organization: "Организация", allOrganizations: "Все организации", field: "Направление", allFields: "Все направления", find: "Найти", empty: "Учёные не найдены", emptyHint: "Измените поисковый запрос или фильтры каталога.", reset: "Сбросить фильтры", journal: "Журнал СМУ" },
  kk: { eyebrow: "Ғылым адамдары", title: "Өңірді дамытатын зерттеушілер", intro: "Ақтөбе облысының ғалымдары арасынан сарапшыларды, әріптестерді және серіктестерді табыңыз.", profiles: "каталогтағы профиль", search: "Аты бойынша іздеу", organization: "Ұйым", allOrganizations: "Барлық ұйымдар", field: "Бағыт", allFields: "Барлық бағыттар", find: "Іздеу", empty: "Ғалымдар табылмады", emptyHint: "Іздеу сұрауын немесе каталог сүзгілерін өзгертіңіз.", reset: "Сүзгілерді қалпына келтіру", journal: "СМУ журналы" },
};
