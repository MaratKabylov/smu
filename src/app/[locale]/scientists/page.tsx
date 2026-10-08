import { catalogMetadata } from "@/lib/seo/metadata";
import type { PublicQuery } from "@/lib/i18n/locales";
import { Pagination } from "@/components/search/Pagination";
import { readPage } from "@/lib/search";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Metadata } from "next";
import { Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { CommunityHeader } from "@/components/scientists/CommunityHeader";
import { PublicScientistCard } from "@/components/scientists/PublicScientistCard";
import { publicScientistFiltersSchema } from "@/lib/validation/scientist";
import { PublicScientistService } from "@/server/services/scientist.service";
import { scientistTaxonomyName } from "@/lib/i18n/scientist-taxonomy";

export async function generateMetadata({ params, searchParams = Promise.resolve({}) }: { params: LocaleParams; searchParams?: Promise<PublicQuery> }): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const copy = getDictionary(locale);
  return catalogMetadata(locale, "scientists", copy.common.brands.scientists, copy.scientistCatalog.intro, await searchParams);
}

type Props = { params: LocaleParams; searchParams: Promise<{ page?: string; lang?: string; q?: string; organization?: string; field?: string }> };

export default async function ScientistsPage({ searchParams, params: routeParams }: Props) {
  const params = await searchParams;
  const locale = requireLocale((await routeParams).locale);
  const parsed = publicScientistFiltersSchema.safeParse({
    locale,
    query: params.q ?? "",
    organization: params.organization ?? "",
    field: params.field ?? "",
  });
  const filters = parsed.success ? parsed.data : { locale, query: "", organization: "", field: "" };
  const { scientists, taxonomy, pagination } = await new PublicScientistService().listPage(filters, readPage(params.page));
  const copy = getDictionary(filters.locale).scientistCatalog;
  return <>
    <CommunityHeader locale={filters.locale} />
    <main>
      <section className="scientists-hero"><div className="journal-hero-inner"><p className="journal-eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p><div className="scientists-stat"><strong>{pagination.total}</strong><span>{copy.profiles}</span></div></div></section>
      <section className="scientists-catalog">
        <form action={`/${locale}/scientists`} className="scientists-filters">
          <label className="scientists-search"><Search aria-hidden="true" /><span className="visually-hidden">{copy.search}</span><input type="search" name="q" defaultValue={filters.query} placeholder={copy.search} /></label>
          <select name="organization" defaultValue={filters.organization} aria-label={copy.organization}><option value="">{copy.allOrganizations}</option>{taxonomy.organizations.map((item) => <option value={item.slug} key={item.id}>{scientistTaxonomyName(item, filters.locale)}</option>)}</select>
          <select name="field" defaultValue={filters.field} aria-label={copy.field}><option value="">{copy.allFields}</option>{taxonomy.fields.map((item) => <option value={item.slug} key={item.id}>{scientistTaxonomyName(item, filters.locale)}</option>)}</select>
          <button type="submit">{copy.find}</button>
        </form>
        {scientists.length ? <div className="scientists-grid">{scientists.map((scientist) => <PublicScientistCard scientist={scientist} locale={filters.locale} key={scientist.id} />)}</div> : <div className="journal-empty"><UsersRound aria-hidden="true" /><h2>{copy.empty}</h2><p>{copy.emptyHint}</p>{filters.query || filters.organization || filters.field ? <Link href={`/${filters.locale}/scientists`}>{copy.reset}</Link> : null}</div>}
      <Pagination {...pagination} path={`/${locale}/scientists`} query={params} locale={locale} />
      </section>
    </main>
    <footer className="journal-footer"><span>© {new Date().getFullYear()} {getDictionary(locale).common.footer}</span><Link href={`/${filters.locale}/journal`}>{copy.journal}</Link></footer>
  </>;
}
