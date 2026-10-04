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
const copy = {
  ru: {
    title: "События", eyebrow: "Календарь научного сообщества",
    intro: "Конференции, семинары и встречи учёных Актюбинской области. Выберите событие и присоединяйтесь.",
    search: "Поиск по названию", kinds: "Все типы", formats: "Все форматы", period: "Период",
    upcoming: "Предстоящие и текущие", past: "Прошедшие", all: "Все события", find: "Найти",
    empty: "События не найдены", hint: "Попробуйте изменить фильтры. Новые события появятся после публикации.",
    reset: "Сбросить фильтры", read: "Подробнее", cancelled: "Событие отменено",
    cancelHint: "Мероприятие не состоится. Регистрация закрыта.",
    description: "О событии и программа", organizer: "Организатор", location: "Место проведения",
    dates: "Дата и время", start: "Начало", end: "Окончание", zone: "Время по Актобе · UTC+05:00",
    register: "Зарегистрироваться", deadline: "Дедлайн регистрации", closed: "Регистрация закрыта",
    external: "Сайт события / трансляция", catalog: "Вернуться в каталог", notFound: "Событие не найдено",
    count: "событий · до 100 записей", footer: "Совет молодых учёных",
  },
  kk: {
    title: "Іс-шаралар", eyebrow: "Ғылыми қауымдастық күнтізбесі",
    intro: "Ақтөбе облысы ғалымдарының конференциялары, семинарлары және кездесулері. Іс-шараны таңдап, қатысыңыз.",
    search: "Атауы бойынша іздеу", kinds: "Барлық түрлер", formats: "Барлық форматтар", period: "Кезең",
    upcoming: "Алдағы және ағымдағы", past: "Өткен", all: "Барлық іс-шаралар", find: "Іздеу",
    empty: "Іс-шаралар табылмады", hint: "Сүзгілерді өзгертіп көріңіз. Жаңа іс-шаралар жарияланғаннан кейін пайда болады.",
    reset: "Сүзгілерді қалпына келтіру", read: "Толығырақ", cancelled: "Іс-шара тоқтатылды",
    cancelHint: "Іс-шара өткізілмейді. Тіркелу жабық.",
    description: "Іс-шара туралы және бағдарлама", organizer: "Ұйымдастырушы", location: "Өткізу орны",
    dates: "Күні мен уақыты", start: "Басталуы", end: "Аяқталуы", zone: "Ақтөбе уақыты · UTC+05:00",
    register: "Тіркелу", deadline: "Тіркелу мерзімі", closed: "Тіркелу жабық",
    external: "Іс-шара сайты / трансляция", catalog: "Каталогқа оралу", notFound: "Іс-шара табылмады",
    count: "іс-шара · 100 жазбаға дейін", footer: "Жас ғалымдар кеңесі",
  },
} as const;

function Header({ locale, translations }: { locale: ScientistLocale; translations?: EventTranslation[] }) {
  const languageUrl = (language: ScientistLocale) => {
    const translation = translations?.find(item => item.locale === language);
    return translation ? "/events/" + language + "/" + translation.slug : "/events?lang=" + language;
  };
  return <header className="journal-header"><div className="journal-header-inner">
    <Link className="journal-brand" href={"/events?lang=" + locale}><span className="journal-brand-mark">СМУ</span><span><strong>{copy[locale].title}</strong><small>{locale === "ru" ? "Актюбинская область" : "Ақтөбе облысы"}</small></span></Link>
    <nav className="journal-nav" aria-label={locale === "ru" ? "Основная навигация" : "Негізгі навигация"}>
      <Link href={"/scientists?lang=" + locale}>{locale === "ru" ? "Учёные" : "Ғалымдар"}</Link>
      <Link href={"/research?lang=" + locale}>{locale === "ru" ? "Исследования" : "Зерттеулер"}</Link>
      <Link href={"/projects?lang=" + locale}>{locale === "ru" ? "Проекты" : "Жобалар"}</Link>
      <Link href={"/mentorship?lang=" + locale}>{locale === "ru" ? "Наставничество" : "Тәлімгерлік"}</Link>
      <Link href={"/research-program?lang=" + locale}>{locale === "ru" ? "Research Program" : "Зерттеу бағдарламасы"}</Link>
      <Link href={"/events?lang=" + locale} aria-current="page">{copy[locale].title}</Link>
      <Link href={"/journal?lang=" + locale}>Журнал</Link>
    </nav>
    <div className="journal-language" aria-label={locale === "ru" ? "Выбор языка" : "Тілді таңдау"}>{(["ru", "kk"] as const).map(language => <Link key={language} href={languageUrl(language)} className={locale === language ? "is-active" : ""} hrefLang={language}>{language === "ru" ? "RU" : "ҚАЗ"}</Link>)}</div>
  </div></header>;
}
export async function eventCatalogMetadata(searchParams: EventCatalogSearch): Promise<Metadata> {
  const state = await searchParams;
  const locale = state.lang === "kk" ? "kk" : "ru";
  return { title: copy[locale].title, description: copy[locale].intro };
}
export async function PublicEventCatalog({ searchParams }: { searchParams: EventCatalogSearch }) {
  const state = await searchParams;
  const locale = state.lang === "kk" ? "kk" : "ru";
  const parsed = publicEventFiltersSchema.safeParse({ locale, query: state.q ?? "", kind: state.kind ?? "all", format: state.format ?? "all", period: state.period ?? "upcoming" });
  const filters = parsed.success ? parsed.data : publicEventFiltersSchema.parse({ locale });
  const events = await new PublicEventService().list(filters);
  const text = copy[locale];
  return <>
    <Header locale={locale} />
    <main><section className="journal-hero"><div className="journal-hero-inner"><p className="journal-eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p>{text.intro}</p></div></section>
      <section className="journal-catalog"><form action="/events" className="science-filters">
        <input type="hidden" name="lang" value={locale} />
        <label><Search aria-hidden="true" /><span className="visually-hidden">{text.search}</span><input type="search" name="q" defaultValue={filters.query} placeholder={text.search} maxLength={120} /></label>
        <select name="kind" defaultValue={filters.kind} aria-label={text.kinds}><option value="all">{text.kinds}</option>{eventKinds.map(kind => <option key={kind} value={kind}>{eventKindLabels[locale][kind]}</option>)}</select>
        <select name="format" defaultValue={filters.format} aria-label={text.formats}><option value="all">{text.formats}</option>{eventFormats.map(format => <option key={format} value={format}>{eventFormatLabels[locale][format]}</option>)}</select>
        <select name="period" defaultValue={filters.period} aria-label={text.period}>{(["upcoming", "past", "all"] as const).map(period => <option key={period} value={period}>{text[period]}</option>)}</select><button type="submit">{text.find}</button>
      </form><p className="science-count" aria-live="polite">{events.length} {text.count} · {text.zone}</p>
      {events.length ? <div className="public-article-grid">{events.map(event => {
        const translation = event.translations.find(item => item.locale === locale)!;
        const href = "/events/" + locale + "/" + translation.slug;
        return <article className="public-article-card science-card" key={event.id}><Link className="public-card-cover" href={href} aria-label={translation.title}>{event.coverUrl ? <img src={event.coverUrl} alt="" loading="lazy" /> : <CalendarDays aria-hidden="true" />}</Link><div className="public-card-content"><div className="public-card-meta"><span>{eventKindLabels[locale][event.kind]}</span><span>{eventFormatLabels[locale][event.format]}</span></div>{event.status === "cancelled" ? <p className="event-cancelled">{text.cancelled}</p> : null}<h2><Link href={href}>{translation.title}</Link></h2><p>{translation.summary}</p><p className="event-card-date"><time dateTime={event.startsAt}>{eventDate(event.startsAt, locale)}</time></p>{translation.location ? <small className="science-card-field">{translation.location}</small> : null}<Link className="public-card-link" href={href}>{text.read}<ArrowUpRight aria-hidden="true" /></Link></div></article>;
      })}</div> : <div className="journal-empty"><CalendarDays aria-hidden="true" /><h2>{text.empty}</h2><p>{text.hint}</p><Link href={"/events?lang=" + locale}>{text.reset}</Link></div>}
      </section>
    </main><footer className="journal-footer"><span>© {new Date().getFullYear()} {text.footer}</span><Link href={"/scientists?lang=" + locale}>{locale === "ru" ? "Научное сообщество" : "Ғылыми қауымдастық"}</Link></footer>
  </>;
}
async function detail(params: EventDetailParams) {
  const { locale: rawLocale, slug } = await params;
  if (rawLocale !== "ru" && rawLocale !== "kk") notFound();
  const locale: ScientistLocale = rawLocale;
  const event = await getPublicEvent(locale, slug);
  const translation = event?.translations.find(item => item.locale === locale);
  if (!event || !translation) notFound();
  return { event, translation, locale };
}
export async function eventDetailMetadata(params: EventDetailParams): Promise<Metadata> {
  const { event, translation, locale } = await detail(params);
  const path = "/events/" + locale + "/" + translation.slug;
  return {
    title: translation.title, description: translation.summary,
    alternates: { canonical: path, languages: Object.fromEntries(event.translations.map(item => [item.locale, "/events/" + item.locale + "/" + item.slug])) },
    openGraph: { title: translation.title, description: translation.summary, url: path, type: "website",
      locale: locale === "ru" ? "ru_RU" : "kk_KZ", images: event.coverUrl ? [{ url: event.coverUrl }] : undefined },
  };
}
export async function PublicEventDetail({ params }: { params: EventDetailParams }) {
  const { event, translation, locale } = await detail(params);
  const text = copy[locale];
  return <>
    <Header locale={locale} translations={event.translations} />
    <main className="public-article-page"><div className="public-article-shell">
      <nav className="public-breadcrumbs" aria-label={text.catalog}><Link href={"/events?lang=" + locale}><ArrowLeft aria-hidden="true" />{text.title}</Link></nav>
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
      </div><RelatedArticles kind={"event"} id={event.id} locale={locale} /><div className="science-return"><Link href={"/events?lang=" + locale}>{text.catalog}</Link></div>
    </div></main><footer className="journal-footer"><span>© {new Date().getFullYear()} {text.footer}</span><Link href={"/events?lang=" + locale}>{text.title}</Link></footer>
  </>;
}
