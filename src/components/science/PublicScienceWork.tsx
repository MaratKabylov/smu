import { catalogMetadata, pageAlternates, openGraphLocale, noIndex } from "@/lib/seo/metadata";
import type { PublicQuery } from "@/lib/i18n/locales";
import { Pagination } from "@/components/search/Pagination";
import { readPage } from "@/lib/search";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { localizedPath } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/dictionaries";
/* eslint-disable @next/next/no-img-element -- Supabase public URLs are configured at runtime. */
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, FlaskConical, Search } from "lucide-react";
import { WorkPublications } from "./PublicPublications";
import Link from "next/link";
import { RelatedArticles } from "@/components/articles/PublicArticleRelations";
import { notFound } from "next/navigation";
import { ScienceHeader } from "./ScienceHeader";
import { scienceWorkPath, scienceWorkStageLabels, scienceWorkTitles } from "@/lib/science-work";
import { publicScienceWorkFiltersSchema } from "@/lib/validation/science-work";
import { getPublicScienceWork, PublicScienceWorkService } from "@/server/services/science-work.service";
import { scienceWorkStages, type ScienceWorkKind } from "@/types/domain/science-work";
import type { ScientistLocale } from "@/types/domain/scientist";
import { scientistTaxonomyName } from "@/lib/i18n/scientist-taxonomy";

type SearchParams = Promise<{ page?: string; lang?: string; q?: string; organization?: string; field?: string; stage?: string }>;
export type ScienceDetailParams = Promise<{ locale: string; slug: string }>;

function validLocale(locale: string): ScientistLocale {
  return requireLocale(locale);
}
export async function scienceCatalogMetadata(kind: ScienceWorkKind, params: LocaleParams, searchParams: Promise<PublicQuery> = Promise.resolve({})): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  return catalogMetadata(locale, kind === "project" ? "projects" : "research", scienceWorkTitles[locale][kind], getDictionary(locale).science.intro, await searchParams);
}
export async function PublicScienceWorkCatalog({ kind, searchParams, params }: { kind: ScienceWorkKind; searchParams: SearchParams; params: LocaleParams }) {
  const state = await searchParams;
  const locale = requireLocale((await params).locale);
  const parsed = publicScienceWorkFiltersSchema.safeParse({ locale, query: state.q ?? "", organization: state.organization ?? "", field: state.field ?? "", stage: state.stage ?? "all" });
  const filters = parsed.success ? parsed.data : publicScienceWorkFiltersSchema.parse({ locale });
  const { works, taxonomy, pagination } = await new PublicScienceWorkService().listPage(kind, filters, readPage(state.page));
  const text = getDictionary(filters.locale).science;
  const base = localizedPath(locale, scienceWorkPath(kind));
  return <>
    <ScienceHeader kind={kind} locale={filters.locale} />
    <main><section className="journal-hero"><div className="journal-hero-inner"><p className="journal-eyebrow">{text.eyebrow}</p><h1>{scienceWorkTitles[filters.locale][kind]}</h1><p>{text.intro}</p></div></section>
      <section className="journal-catalog"><form action={base} className="science-filters">
        <label><Search aria-hidden="true" /><span className="visually-hidden">{text.search}</span><input type="search" name="q" defaultValue={filters.query} placeholder={text.search} maxLength={120} /></label>
        <select name="organization" defaultValue={filters.organization} aria-label={text.organization}><option value="">{text.organizations}</option>{taxonomy.organizations.map(item => <option key={item.id} value={item.slug}>{scientistTaxonomyName(item, filters.locale)}</option>)}</select>
        <select name="field" defaultValue={filters.field} aria-label={text.fields}><option value="">{text.fields}</option>{taxonomy.fields.map(item => <option key={item.id} value={item.slug}>{scientistTaxonomyName(item, filters.locale)}</option>)}</select>
        <select name="stage" defaultValue={filters.stage} aria-label={text.stages}><option value="all">{text.stages}</option>{scienceWorkStages.map(stage => <option key={stage} value={stage}>{scienceWorkStageLabels[filters.locale][stage]}</option>)}</select><button type="submit">{text.find}</button>
      </form><p className="science-count" aria-live="polite">{pagination.total} {text.count}</p>
      {works.length ? <div className="public-article-grid">{works.map(work => {
        const translation = work.translations.find(item => item.locale === filters.locale)!;
        const href = base + "/" + translation.slug;
        return <article className="public-article-card science-card" key={work.id}><Link className="public-card-cover" href={href} aria-label={translation.title}>{work.coverUrl ? <img src={work.coverUrl} alt="" loading="lazy" /> : <FlaskConical aria-hidden="true" />}</Link><div className="public-card-content"><div className="public-card-meta"><span>{scienceWorkStageLabels[filters.locale][work.stage]}</span></div><h2><Link href={href}>{translation.title}</Link></h2><p>{translation.summary}</p>{work.field ? <small className="science-card-field">{scientistTaxonomyName(work.field, filters.locale)}</small> : null}<Link className="public-card-link" href={href}>{text.read}<ArrowUpRight aria-hidden="true" /></Link></div></article>;
      })}</div> : <div className="journal-empty"><FlaskConical aria-hidden="true" /><h2>{text.empty}</h2><p>{text.hint}</p>{filters.query || filters.field || filters.organization || filters.stage !== "all" ? <Link href={base}>{text.reset}</Link> : null}</div>}
      <Pagination {...pagination} path={base} query={state} locale={locale} />
      </section>
    </main><footer className="journal-footer"><span>© {new Date().getFullYear()} {text.footer}</span><Link href={"/" + filters.locale + "/scientists"}>{filters.locale === "ru" ? "Научное сообщество" : "Ғылыми қауымдастық"}</Link></footer>
  </>;
}
export async function scienceDetailMetadata(kind: ScienceWorkKind, params: ScienceDetailParams): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = validLocale(rawLocale);
  const work = await getPublicScienceWork(kind, locale, slug);
  const translation = work?.translations.find(item => item.locale === locale);
  if (!work || !translation) return { title: getDictionary(locale).science.notFound, robots: noIndex };
  const section = kind === "project" ? "projects" : "research";
  return {
    title: translation.title, description: translation.summary,
    alternates: pageAlternates(locale, section, work.translations),
    openGraph: { title: translation.title, description: translation.summary, type: "article", url: pageAlternates(locale, section, work.translations).canonical, locale: openGraphLocale[locale], images: work.coverUrl ? [{ url: work.coverUrl }] : undefined },
  };
}
export async function PublicScienceWorkDetail({ kind, params }: { kind: ScienceWorkKind; params: ScienceDetailParams }) {
  const { locale: rawLocale, slug } = await params;
  const locale = validLocale(rawLocale);
  const work = await getPublicScienceWork(kind, locale, slug);
  const translation = work?.translations.find(item => item.locale === locale);
  if (!work || !translation) notFound();
  const text = getDictionary(locale).science;
  const base = localizedPath(locale, scienceWorkPath(kind));
  const date = (value: string) => new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
  return <>
    <ScienceHeader kind={kind} locale={locale} translations={work.translations} />
    <main className="public-article-page"><div className="public-article-shell">
      <nav className="public-breadcrumbs" aria-label={text.catalog}><Link href={base}><ArrowLeft aria-hidden="true" />{scienceWorkTitles[locale][kind]}</Link></nav>
      <header className="public-article-header"><div className="public-article-kicker">{work.field ? <Link href={base + "?field=" + work.field.slug}>{scientistTaxonomyName(work.field, locale)}</Link> : null}<span>{scienceWorkStageLabels[locale][work.stage]}</span></div><h1>{translation.title}</h1><p className="public-article-lead">{translation.summary}</p></header>
      {work.coverUrl ? <figure className="public-article-cover"><img src={work.coverUrl} alt={translation.title} /></figure> : null}
      <div className="public-article-layout"><article className="science-work-body"><h2>{text.description}</h2>{translation.description.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}{translation.results ? <><h2>{text.results}</h2>{translation.results.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</> : null}</article>
        <aside className="public-article-aside science-work-aside">
          {work.organization ? <div><small>{text.organization}</small><Link href={base + "?organization=" + work.organization.slug}>{scientistTaxonomyName(work.organization, locale)}</Link></div> : null}
          {work.startDate || work.endDate ? <div><small>{text.dates}</small>{work.startDate ? <span>{text.from}: <time dateTime={work.startDate}>{date(work.startDate)}</time></span> : null}{work.endDate ? <span>{text.to}: <time dateTime={work.endDate}>{date(work.endDate)}</time></span> : null}</div> : null}
          <div><small>{text.team}</small>{work.members.length ? work.members.map(member => {
            const person = member.translations.find(item => item.locale === locale);
            return person ? <div key={member.id} className="science-team-member"><Link href={"/" + locale + "/scientists/" + person.slug}>{person.fullName}</Link>{member.role === "lead" ? <span>{text.lead}</span> : null}</div> : null;
          }) : <span>{text.noTeam}</span>}</div>
          {work.doi ? <a href={"https://doi.org/" + work.doi} target="_blank" rel="noreferrer">DOI: {work.doi}<ArrowUpRight aria-hidden="true" /></a> : null}
          {work.externalUrl ? <a href={work.externalUrl} target="_blank" rel="noreferrer">{text.external}<ArrowUpRight aria-hidden="true" /></a> : null}
        </aside>
      </div><WorkPublications id={work.id} locale={locale} /><RelatedArticles kind={kind} id={work.id} locale={locale} /><div className="science-return"><Link href={base}>{text.catalog}</Link></div>
    </div></main><footer className="journal-footer"><span>© {new Date().getFullYear()} {text.footer}</span><Link href={base}>{scienceWorkTitles[locale][kind]}</Link></footer>
  </>;
}
