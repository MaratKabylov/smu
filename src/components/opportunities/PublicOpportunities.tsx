import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, Building2, CalendarClock, Compass, Globe, Search } from "lucide-react";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { Pagination } from "@/components/search/Pagination";
import { eventDate } from "@/lib/events";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { PublicQuery } from "@/lib/i18n/locales";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { opportunityCopy, opportunityTypeLabels } from "@/lib/i18n/opportunity";
import { readPage } from "@/lib/search";
import { opportunityAccepting } from "@/lib/opportunities";
import { catalogMetadata, openGraphLocale, pageAlternates } from "@/lib/seo/metadata";
import { opportunityFiltersSchema, opportunitySlug, opportunityTypes, type OpportunityPage } from "@/lib/validation/opportunity";
import { getPublicOpportunity, PublicOpportunityService } from "@/server/services/opportunity.service";

export type OpportunityCatalogProps = { params: LocaleParams; searchParams: Promise<PublicQuery> };
export type OpportunityDetailProps = { params: Promise<{ locale: string; slug: string }> };

export async function opportunityCatalogMetadata({ params, searchParams }: OpportunityCatalogProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const copy = opportunityCopy[locale];
  return catalogMetadata(locale, "opportunities", copy.title, copy.intro, await searchParams);
}

export async function PublicOpportunityCatalog({ params, searchParams }: OpportunityCatalogProps) {
  const locale = requireLocale((await params).locale);
  const state = await searchParams;
  const copy = opportunityCopy[locale];
  const common = getDictionary(locale).common;
  const parsed = opportunityFiltersSchema.safeParse({
    q: state.q ?? "",
    type: state.type ?? "all",
    country: state.country ?? "",
    availability: state.availability ?? "open",
  });
  const filters = parsed.success ? parsed.data : opportunityFiltersSchema.parse({});
  const hasFilters = Boolean(filters.q || filters.type !== "all" || filters.country || filters.availability !== "open");
  let data: OpportunityPage = { total: 0, page: readPage(state.page), pageSize: 12, items: [] };
  let unavailable = false;
  try {
    data = await new PublicOpportunityService().list(locale, filters, data.page);
  } catch {
    unavailable = true;
  }

  return (
    <>
      <PublicHeader locale={locale} section="opportunities" />
      <main>
        <section className="journal-hero">
          <div className="journal-hero-inner">
            <p className="journal-eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p>{copy.intro}</p>
          </div>
        </section>

        <section className="journal-catalog">
          <form action={`/${locale}/opportunities`} className="science-filters">
            <label>
              <Search aria-hidden="true" />
              <span className="visually-hidden">{copy.search}</span>
              <input
                name="q"
                type="search"
                placeholder={copy.search}
                defaultValue={filters.q}
                maxLength={120}
              />
            </label>
            <select name="type" aria-label={copy.types} defaultValue={filters.type}>
              <option value="all">{copy.types}</option>
              {opportunityTypes.map((type) => (
                <option key={type} value={type}>
                  {opportunityTypeLabels[locale][type]}
                </option>
              ))}
            </select>
            <label className="science-filter-compact">
              <Globe aria-hidden="true" />
              <span className="visually-hidden">{copy.country}</span>
              <input
                name="country"
                type="text"
                placeholder={copy.country}
                defaultValue={filters.country}
                pattern="[A-Za-z]{2}"
                maxLength={2}
              />
            </label>
            <select name="availability" aria-label={copy.availability} defaultValue={filters.availability}>
              {(["open", "closed", "all"] as const).map((value) => (
                <option key={value} value={value}>
                  {copy[value]}
                </option>
              ))}
            </select>
            <button type="submit">{copy.find}</button>
          </form>

          {unavailable ? (
            <p role="alert" className="notice error-notice">
              {copy.unavailable}
            </p>
          ) : (
            <>
              <p className="science-count" aria-live="polite">
                {data.total} {copy.count} · {copy.zone}
              </p>

              {data.items.length ? (
                <div className="public-article-grid">
                  {data.items.map((item) => {
                    const t = item.translations.find((translation) => translation.locale === locale);
                    if (!t) return null;
                    const href = `/${locale}/opportunities/${t.slug}`;
                    const open = opportunityAccepting(item.deadline);
                    return (
                      <article className="public-article-card science-card opportunity-card" key={item.id}>
                        <div className="public-card-content">
                          <div className="opportunity-card-top">
                            <div className="public-card-meta">
                              <span>{opportunityTypeLabels[locale][item.type]}</span>
                              {item.country ? <span>{item.country}</span> : null}
                            </div>
                            <span className={`opportunity-status-pill ${open ? "is-open" : "is-closed"}`}>
                              {open ? copy.open : copy.closed}
                            </span>
                          </div>
                          <h2>
                            <Link href={href}>{t.title}</Link>
                          </h2>
                          <p>{t.summary}</p>
                          <div className="opportunity-card-details">
                            <span className="opportunity-card-detail">
                              <Building2 aria-hidden="true" />
                              <span>{t.organization}</span>
                            </span>
                            <span className="opportunity-card-detail">
                              <CalendarClock aria-hidden="true" />
                              {item.deadline ? (
                                <time dateTime={item.deadline}>{eventDate(item.deadline, locale)}</time>
                              ) : (
                                <span>{copy.noDeadline}</span>
                              )}
                            </span>
                          </div>
                          <Link className="public-card-link" href={href}>
                            {copy.read}
                            <ArrowUpRight aria-hidden="true" />
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="journal-empty">
                  <Compass aria-hidden="true" />
                  <h2>{copy.empty}</h2>
                  <p>{copy.hint}</p>
                  {hasFilters ? <Link href={`/${locale}/opportunities`}>{copy.reset}</Link> : null}
                </div>
              )}

              <Pagination {...data} path={`/${locale}/opportunities`} query={state} locale={locale} />
            </>
          )}
        </section>
      </main>
      <footer className="journal-footer">
        <span>
          © {new Date().getFullYear()} {common.footer}
        </span>
        <Link href={`/${locale}/scientists`}>{common.brands.scientists}</Link>
      </footer>
    </>
  );
}

async function detail({ params }: OpportunityDetailProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = requireLocale(rawLocale);
  if (!opportunitySlug.safeParse(slug).success) notFound();
  const item = await getPublicOpportunity(locale, slug);
  const translation = item?.translations.find((t) => t.locale === locale);
  if (!item || !translation) notFound();
  if (translation.slug !== slug) permanentRedirect(`/${locale}/opportunities/${translation.slug}`);
  return { item, translation, locale };
}

export async function opportunityDetailMetadata(props: OpportunityDetailProps): Promise<Metadata> {
  const { item, translation, locale } = await detail(props);
  const alternates = pageAlternates(locale, "opportunities", item.translations);
  return {
    title: translation.title,
    description: translation.summary,
    alternates,
    openGraph: {
      title: translation.title,
      description: translation.summary,
      url: alternates.canonical,
      type: "website",
      locale: openGraphLocale[locale],
    },
  };
}

export async function PublicOpportunityDetail(props: OpportunityDetailProps) {
  const { item, translation: t, locale } = await detail(props);
  const copy = opportunityCopy[locale];
  const common = getDictionary(locale).common;
  const open = opportunityAccepting(item.deadline);

  return (
    <>
      <PublicHeader locale={locale} section="opportunities" translations={item.translations} />
      <main className="public-article-page">
        <div className="public-article-shell">
          <nav className="public-breadcrumbs" aria-label={copy.back}>
            <Link href={`/${locale}/opportunities`}>
              <ArrowLeft aria-hidden="true" />
              {copy.title}
            </Link>
          </nav>

          <header className="public-article-header">
            <div className="public-article-kicker">
              <Link href={`/${locale}/opportunities?type=${item.type}`}>
                {opportunityTypeLabels[locale][item.type]}
              </Link>
              <span>{item.country || copy.international}</span>
            </div>
            <h1>{t.title}</h1>
            <p className="public-article-lead">{t.summary}</p>
            <p className={`opportunity-status-pill opportunity-detail-status ${open ? "is-open" : "is-closed"}`} role="status">
              {open ? copy.open : copy.closed}
            </p>
          </header>

          <div className="public-article-layout">
            <article className="science-work-body">
              <h2>{copy.description}</h2>
              {t.description.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </article>

            <aside className="public-article-aside science-work-aside opportunity-aside">
              <div>
                <small>{copy.organization}</small>
                <span>{t.organization}</span>
              </div>
              <div>
                <small>{copy.countries}</small>
                <span>{item.country || copy.international}</span>
              </div>
              <div>
                <small>{copy.deadline}</small>
                {item.deadline ? (
                  <time dateTime={item.deadline}>{eventDate(item.deadline, locale)}</time>
                ) : (
                  <span>{copy.noDeadline}</span>
                )}
              </div>
              {t.funding ? (
                <div>
                  <small>{copy.funding}</small>
                  <span>{t.funding}</span>
                </div>
              ) : null}
              <a className="opportunity-source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
                {copy.source}
                <ArrowUpRight aria-hidden="true" />
              </a>
            </aside>
          </div>

          <div className="science-return">
            <Link href={`/${locale}/opportunities`}>{copy.back}</Link>
          </div>
        </div>
      </main>
      <footer className="journal-footer">
        <span>
          © {new Date().getFullYear()} {common.footer}
        </span>
        <Link href={`/${locale}/opportunities`}>{copy.title}</Link>
      </footer>
    </>
  );
}
