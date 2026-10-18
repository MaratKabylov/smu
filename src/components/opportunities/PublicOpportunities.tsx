import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { Pagination } from "@/components/search/Pagination";
import { eventDate } from "@/lib/events";
import type { PublicQuery } from "@/lib/i18n/locales";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { opportunityCopy, opportunityTypeLabels } from "@/lib/i18n/opportunity";
import { readPage } from "@/lib/search";
import { opportunityAccepting } from "@/lib/opportunities";
import { catalogMetadata, pageAlternates } from "@/lib/seo/metadata";
import { opportunityFiltersSchema, opportunitySlug, opportunityTypes, type OpportunityPage } from "@/lib/validation/opportunity";
import { getPublicOpportunity, PublicOpportunityService } from "@/server/services/opportunity.service";

export type OpportunityCatalogProps = { params: LocaleParams; searchParams: Promise<PublicQuery> };
export type OpportunityDetailProps = { params: Promise<{ locale: string; slug: string }> };
export async function opportunityCatalogMetadata({ params, searchParams }: OpportunityCatalogProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale), copy = opportunityCopy[locale];
  return catalogMetadata(locale, "opportunities", copy.title, copy.intro, await searchParams);
}
export async function PublicOpportunityCatalog({ params, searchParams }: OpportunityCatalogProps) {
  const locale = requireLocale((await params).locale), state = await searchParams, copy = opportunityCopy[locale];
  const parsed = opportunityFiltersSchema.safeParse({ q: state.q ?? "", type: state.type ?? "all", country: state.country ?? "", availability: state.availability ?? "open" });
  const filters = parsed.success ? parsed.data : opportunityFiltersSchema.parse({});
  let data: OpportunityPage = { total: 0, page: readPage(state.page), pageSize: 12, items: [] }, unavailable = false;
  try { data = await new PublicOpportunityService().list(locale, filters, data.page); }
  catch { unavailable = true; }
  return <><PublicHeader locale={locale} section="opportunities" /><main>
    <section className="journal-hero"><div className="journal-hero-inner"><p className="journal-eyebrow">СМУ</p><h1>{copy.title}</h1><p>{copy.intro}</p></div></section>
    <section className="journal-catalog"><form action={`/${locale}/opportunities`} className="science-filters">
      <input name="q" type="search" aria-label={copy.search} placeholder={copy.search} defaultValue={filters.q} maxLength={120} />
      <select name="type" aria-label={copy.types} defaultValue={filters.type}><option value="all">{copy.types}</option>{opportunityTypes.map(type => <option key={type} value={type}>{opportunityTypeLabels[locale][type]}</option>)}</select>
      <input name="country" aria-label={copy.country} placeholder={copy.country} defaultValue={filters.country} pattern="[A-Za-z]{2}" maxLength={2} />
      <select name="availability" aria-label={copy.availability} defaultValue={filters.availability}>{(["open", "closed", "all"] as const).map(value => <option key={value} value={value}>{copy[value]}</option>)}</select><button type="submit">{copy.find}</button>
    </form>
    {unavailable ? <p role="alert" className="notice error-notice">{copy.unavailable}</p> : <><p className="science-count">{data.total}</p>{data.items.length ? <div className="public-article-grid">{data.items.map(item => {
      const t = item.translations.find(t => t.locale === locale)!;
      const href = `/${locale}/opportunities/${t.slug}`;
      return <article className="public-article-card science-card" key={item.id}><div className="public-card-content"><div className="public-card-meta"><span>{opportunityTypeLabels[locale][item.type]}</span><span>{item.country}</span></div><h2><Link href={href}>{t.title}</Link></h2><p>{t.summary}</p><p>{t.organization}</p><p>{item.deadline ? <time dateTime={item.deadline}>{eventDate(item.deadline, locale)}</time> : copy.noDeadline}</p><p>{opportunityAccepting(item.deadline) ? copy.open : copy.closed}</p><Link className="public-card-link" href={href}>{copy.read} →</Link></div></article>;
    })}</div> : <div className="journal-empty"><h2>{copy.empty}</h2><Link href={`/${locale}/opportunities`}>{copy.reset}</Link></div>}
    <Pagination {...data} path={`/${locale}/opportunities`} query={state} locale={locale} /></>}
    </section></main></>;
}
async function detail({ params }: OpportunityDetailProps) {
  const { locale: rawLocale, slug } = await params, locale = requireLocale(rawLocale);
  if (!opportunitySlug.safeParse(slug).success) notFound();
  const item = await getPublicOpportunity(locale, slug), translation = item?.translations.find(t => t.locale === locale);
  if (!item || !translation) notFound();
  if (translation.slug !== slug) permanentRedirect(`/${locale}/opportunities/${translation.slug}`);
  return { item, translation, locale };
}
export async function opportunityDetailMetadata(props: OpportunityDetailProps): Promise<Metadata> {
  const { item, translation, locale } = await detail(props);
  return { title: translation.title, description: translation.summary, alternates: pageAlternates(locale, "opportunities", item.translations) };
}
export async function PublicOpportunityDetail(props: OpportunityDetailProps) {
  const { item, translation: t, locale } = await detail(props), copy = opportunityCopy[locale];
  const open = opportunityAccepting(item.deadline);
  return <><PublicHeader locale={locale} section="opportunities" translations={item.translations} />
    <main className="public-article-page"><div className="public-article-shell"><nav className="public-breadcrumbs" aria-label={copy.back}><Link href={`/${locale}/opportunities`}>← {copy.back}</Link></nav>
      <header className="public-article-header"><p className="public-article-kicker">{opportunityTypeLabels[locale][item.type]}</p><h1>{t.title}</h1><p className="public-article-lead">{t.summary}</p><p role="status">{open ? copy.open : copy.closed}</p></header>
      <div className="public-article-layout"><article className="science-work-body"><h2>{copy.description}</h2>{t.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</article>
        <aside className="public-article-aside science-work-aside"><div><small>{copy.organization}</small><span>{t.organization}</span></div><div><small>{copy.countries}</small><span>{item.country || copy.international}</span></div>
          <div><small>{copy.deadline}</small>{item.deadline ? <time dateTime={item.deadline}>{eventDate(item.deadline, locale)}</time> : <span>{copy.noDeadline}</span>}</div>
          {t.funding && <div><small>{copy.funding}</small><span>{t.funding}</span></div>}
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">{copy.source} ↗</a>
        </aside></div>
    </div></main></>;
}
