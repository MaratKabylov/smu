import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { getDictionary } from "@/lib/i18n/dictionaries";
/* eslint-disable @next/next/no-img-element -- Supabase public URLs are configured at runtime. */
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, CalendarDays, Search } from "lucide-react";
import Link from "next/link";
import { RelatedArticles } from "@/components/articles/PublicArticleRelations";
import { notFound } from "next/navigation";
import { eventDate, eventFormatLabels, eventKindLabels, eventRegistrationOpen } from "@/lib/events";
import { publicEventFiltersSchema } from "@/lib/validation/event";
import { getPublicEvent, PublicEventService } from "@/server/services/event.service";
import { eventFormats, eventKinds, type EventTranslation } from "@/types/domain/event";
import type { ScientistLocale } from "@/types/domain/scientist";

export type EventCatalogSearch = Promise<{ lang?: string; q?: string; kind?: string; format?: string; period?: string }>;
export type EventDetailParams = Promise<{ locale: string; slug: string }>;

function Header({ locale, translations }: { locale: ScientistLocale; translations?: EventTranslation[] }) {
  return <PublicHeader locale={locale} section="events" translations={translations} />;
}

export async function eventCatalogMetadata(params: LocaleParams): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  return { title: getDictionary(locale).events.title, description: getDictionary(locale).events.intro };
}
export async function PublicEventCatalog({ searchParams, params }: { searchParams: EventCatalogSearch; params: LocaleParams }) {
  const state = await searchParams;
  const locale = requireLocale((await params).locale);
  const parsed = publicEventFiltersSchema.safeParse({ locale, query: state.q ?? "", kind: state.kind ?? "all", format: state.format ?? "all", period: state.period ?? "upcoming" });
  const filters = parsed.success ? parsed.data : publicEventFiltersSchema.parse({ locale });
  const events = await new PublicEventService().list(filters);
  const text = getDictionary(locale).events;
  return <>
    <Header locale={locale} />
    <main><section className="journal-hero"><div className="journal-hero-inner"><p className="journal-eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.intro}</p></div></section>
      <section className="journal-catalog"><form action={"/" + locale + "/events"} className="science-filters">
        <label><Search aria-hidden="true" /><span className="visually-hidden">{text.search}</span><input type="search" name="q" defaultValue={filters.query} placeholder={text.search} maxLength={120} /></label>
        <select name="kind" defaultValue={filters.kind} aria-label={text.kinds}><option value="all">{text.kinds}</option>{eventKinds.map(kind => <option key={kind} value={kind}>{eventKindLabels[locale][kind]}</option>)}</select>
        <select name="format" defaultValue={filters.format} aria-label={text.formats}><option value="all">{text.formats}</option>{eventFormats.map(format => <option key={format} value={format}>{eventFormatLabels[locale][format]}</option>)}</select>
        <select name="period" defaultValue={filters.period} aria-label={text.period}>{(["upcoming", "past", "all"] as const).map(period => <option key={period} value={period}>{text[period]}</option>)}</select><button type="submit">{text.find}</button>
      </form><p className="science-count" aria-live="polite">{events.length} {text.count} · {text.zone}</p>
      {events.length ? <div className="public-article-grid">{events.map(event => {
        const translation = event.translations.find(item => item.locale === locale)!;
        const href = "/" + locale + "/events/" + translation.slug;
        return <article className="public-article-card science-card" key={event.id}><Link className="public-card-cover" href={href} aria-label={translation.title}>{event.coverUrl ? <img src={event.coverUrl} alt="" loading="lazy" /> : <CalendarDays aria-hidden="true" />}</Link><div className="public-card-content"><div className="public-card-meta"><span>{eventKindLabels[locale][event.kind]}</span><span>{eventFormatLabels[locale][event.format]}</span></div>{event.status === "cancelled" ? <p className="event-cancelled">{text.cancelled}</p> : null}<h2><Link href={href}>{translation.title}</Link></h2><p>{translation.summary}</p><p className="event-card-date"><time dateTime={event.startsAt}>{eventDate(event.startsAt, locale)}</time></p>{translation.location ? <small className="science-card-field">{translation.location}</small> : null}<Link className="public-card-link" href={href}>{text.read}<ArrowUpRight aria-hidden="true" /></Link></div></article>;
      })}</div> : <div className="journal-empty"><CalendarDays aria-hidden="true" /><h2>{text.empty}</h2><p>{text.hint}</p><Link href={"/" + locale + "/events"}>{text.reset}</Link></div>}
      </section>
    </main><footer className="journal-footer"><span>© {new Date().getFullYear()} {text.footer}</span><Link href={"/" + locale + "/scientists"}>{locale === "ru" ? "Научное сообщество" : "Ғылыми қауымдастық"}</Link></footer>
  </>;
}
async function detail(params: EventDetailParams) {
  const { locale: rawLocale, slug } = await params;
  const locale = requireLocale(rawLocale);
  const event = await getPublicEvent(locale, slug);
  const translation = event?.translations.find(item => item.locale === locale);
  if (!event || !translation) notFound();
  return { event, translation, locale };
}
export async function eventDetailMetadata(params: EventDetailParams): Promise<Metadata> {
  const { event, translation, locale } = await detail(params);
  const path = "/" + locale + "/events/" + translation.slug;
  return {
    title: translation.title, description: translation.summary,
    alternates: { canonical: path, languages: Object.fromEntries(event.translations.map(item => [item.locale, "/" + item.locale + "/events/" + item.slug])) },
    openGraph: { title: translation.title, description: translation.summary, url: path, type: "website",
      locale: locale === "ru" ? "ru_RU" : "kk_KZ", images: event.coverUrl ? [{ url: event.coverUrl }] : undefined },
  };
}
export async function PublicEventDetail({ params }: { params: EventDetailParams }) {
  const { event, translation, locale } = await detail(params);
  const text = getDictionary(locale).events;
  return <>
    <Header locale={locale} translations={event.translations} />
    <main className="public-article-page"><div className="public-article-shell">
      <nav className="public-breadcrumbs" aria-label={text.catalog}><Link href={"/" + locale + "/events"}><ArrowLeft aria-hidden="true" />{text.title}</Link></nav>
      <header className="public-article-header"><div className="public-article-kicker"><span>{eventKindLabels[locale][event.kind]}</span><span>{eventFormatLabels[locale][event.format]}</span></div><h1>{translation.title}</h1><p className="public-article-lead">{translation.summary}</p></header>
      {event.status === "cancelled" ? <div className="event-cancellation" role="status"><strong>{text.cancelled}</strong><p>{text.cancelHint}</p></div> : null}
      {event.coverUrl ? <figure className="public-article-cover"><img src={event.coverUrl} alt={translation.title} /></figure> : null}
      <div className="public-article-layout"><article className="science-work-body"><h2>{text.description}</h2>{translation.description.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</article>
        <aside className="public-article-aside science-work-aside">
          <div><small>{text.dates}</small><span>{text.start}: <time dateTime={event.startsAt}>{eventDate(event.startsAt, locale)}</time></span><span>{text.end}: <time dateTime={event.endsAt}>{eventDate(event.endsAt, locale)}</time></span><span>{text.zone}</span></div>
          <div><small>{text.organizer}</small><span>{translation.organizer}</span></div>
          {translation.location ? <div><small>{text.location}</small><span>{translation.location}</span></div> : null}
          {event.registrationDeadline ? <div><small>{text.deadline}</small><time dateTime={event.registrationDeadline}>{eventDate(event.registrationDeadline, locale)}</time></div> : null}
          {eventRegistrationOpen(event) ? <a className="event-register" href={event.registrationUrl!} target="_blank" rel="noreferrer">{text.register}<ArrowUpRight aria-hidden="true" /></a> : event.registrationUrl && event.status !== "cancelled" ? <p>{text.closed}</p> : null}
          {event.externalUrl && event.status !== "cancelled" ? <a href={event.externalUrl} target="_blank" rel="noreferrer">{text.external}<ArrowUpRight aria-hidden="true" /></a> : null}
        </aside>
      </div><RelatedArticles kind={"event"} id={event.id} locale={locale} /><div className="science-return"><Link href={"/" + locale + "/events"}>{text.catalog}</Link></div>
    </div></main><footer className="journal-footer"><span>© {new Date().getFullYear()} {text.footer}</span><Link href={"/" + locale + "/events"}>{text.title}</Link></footer>
  </>;
}
