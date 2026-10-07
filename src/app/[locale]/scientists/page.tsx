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

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const copy = getDictionary(requireLocale((await params).locale));
  return { title: copy.common.brands.scientists, description: copy.scientistCatalog.intro };
}

type Props = { params: LocaleParams; searchParams: Promise<{ lang?: string; q?: string; organization?: string; field?: string }> };

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
  const { scientists, taxonomy } = await new PublicScientistService().list(filters);
  const copy = getDictionary(filters.locale).scientistCatalog;
  return <>
    <CommunityHeader locale={filters.locale} />
    <main>
      <section className="scientists-hero"><div className="journal-hero-inner"><p className="journal-eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.intro}</p><div className="scientists-stat"><strong>{scientists.length}</strong><span>{copy.profiles}</span></div></div></section>
      <section className="scientists-catalog">
        <form action={`/${locale}/scientists`} className="scientists-filters">
          <label className="scientists-search"><Search aria-hidden="true" /><span className="visually-hidden">{copy.search}</span><input type="search" name="q" defaultValue={filters.query} placeholder={copy.search} /></label>
          <select name="organization" defaultValue={filters.organization} aria-label={copy.organization}><option value="">{copy.allOrganizations}</option>{taxonomy.organizations.map((item) => <option value={item.slug} key={item.id}>{scientistTaxonomyName(item, filters.locale)}</option>)}</select>
          <select name="field" defaultValue={filters.field} aria-label={copy.field}><option value="">{copy.allFields}</option>{taxonomy.fields.map((item) => <option value={item.slug} key={item.id}>{scientistTaxonomyName(item, filters.locale)}</option>)}</select>
          <button type="submit">{copy.find}</button>
        </form>
        {scientists.length ? <div className="scientists-grid">{scientists.map((scientist) => <PublicScientistCard scientist={scientist} locale={filters.locale} key={scientist.id} />)}</div> : <div className="journal-empty"><UsersRound aria-hidden="true" /><h2>{copy.empty}</h2><p>{copy.emptyHint}</p>{filters.query || filters.organization || filters.field ? <Link href={`/${filters.locale}/scientists`}>{copy.reset}</Link> : null}</div>}
      </section>
    </main>
    <footer className="journal-footer"><span>© {new Date().getFullYear()} {getDictionary(locale).common.footer}</span><Link href={`/${filters.locale}/journal`}>{copy.journal}</Link></footer>
  </>;
}
