import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ApplicationForm } from "./ApplicationForm";
import { mentorshipFormatLabels } from "@/lib/mentorship";
import { mentorshipFiltersSchema } from "@/lib/validation/mentorship";
import { getPublicMentorship, PublicMentorshipService } from "@/server/services/mentorship.service";
import { mentorshipFormats, type MentorshipTranslation } from "@/types/domain/mentorship";
import type { ScientistLocale } from "@/types/domain/scientist";

export type MentorshipCatalogSearch = Promise<{ lang?: string; q?: string; field?: string; format?: string }>;
export type MentorshipDetailParams = Promise<{ locale: string; slug: string }>;
function localeFrom(value?: string): ScientistLocale { return value === "kk" ? "kk" : "ru"; }
function Header({ locale, translations }: { locale: ScientistLocale; translations?: MentorshipTranslation[] }) {
  const languageUrl = (language: ScientistLocale) => {
    const t = translations?.find(item => item.locale === language);
    return t ? "/mentorship/" + language + "/" + t.slug : "/mentorship?lang=" + language;
  };
  return <header className="journal-header"><div className="journal-header-inner"><Link className="journal-brand" href={"/mentorship?lang=" + locale}><span className="journal-brand-mark">СМУ</span><span><strong>{locale === "ru" ? "Наставничество" : "Тәлімгерлік"}</strong><small>{locale === "ru" ? "Актюбинская область" : "Ақтөбе облысы"}</small></span></Link>
    <nav className="journal-nav" aria-label={locale === "ru" ? "Основная навигация" : "Негізгі навигация"}><Link href={"/scientists?lang=" + locale}>{locale === "ru" ? "Учёные" : "Ғалымдар"}</Link><Link href={"/research?lang=" + locale}>{locale === "ru" ? "Исследования" : "Зерттеулер"}</Link><Link href={"/projects?lang=" + locale}>{locale === "ru" ? "Проекты" : "Жобалар"}</Link><Link href={"/mentorship?lang=" + locale} aria-current="page">{locale === "ru" ? "Наставничество" : "Тәлімгерлік"}</Link><Link href={"/research-program?lang=" + locale}>{locale === "ru" ? "Research Program" : "Зерттеу бағдарламасы"}</Link><Link href={"/journal?lang=" + locale}>Журнал</Link></nav>
    <div className="journal-language" aria-label={locale === "ru" ? "Выбор языка" : "Тілді таңдау"}><Link href={languageUrl("ru")} className={locale === "ru" ? "is-active" : ""}>RU</Link><Link href={languageUrl("kk")} className={locale === "kk" ? "is-active" : ""}>ҚАЗ</Link></div>
  </div></header>;
}
export async function mentorshipCatalogMetadata(searchParams: MentorshipCatalogSearch): Promise<Metadata> {
  const locale = localeFrom((await searchParams).lang);
  return { title: locale === "ru" ? "Наставничество — СМУ" : "Тәлімгерлік — СМУ", description: locale === "ru" ? "Наставники научного сообщества Актюбинской области. Выберите направление и подайте заявку на участие." : "Ақтөбе облысының ғылыми қауымдастық тәлімгерлері. Бағытты таңдап, қатысуға өтінім беріңіз." };
}
export async function PublicMentorshipCatalog({ searchParams }: { searchParams: MentorshipCatalogSearch }) {
  const state = await searchParams;
  const locale = localeFrom(state.lang);
  const parsed = mentorshipFiltersSchema.safeParse({ locale, query: state.q ?? "", field: state.field ?? "", format: state.format ?? "all" });
  const filters = parsed.success ? parsed.data : mentorshipFiltersSchema.parse({ locale });
  const { offers, taxonomy } = await new PublicMentorshipService().list(filters);
  return <><Header locale={locale} /><main lang={locale}><section className="journal-hero"><div className="journal-hero-inner"><p className="journal-eyebrow">{locale === "ru" ? "Научное сообщество · СМУ" : "Ғылыми қауымдастық · СМУ"}</p><h1>{locale === "ru" ? "Развивайтесь вместе с наставником" : "Тәлімгермен бірге дамыңыз"}</h1><p className="journal-hero-description">{locale === "ru" ? "Получите поддержку опытных учёных: от выбора темы до первых научных результатов." : "Тақырып таңдаудан алғашқы ғылыми нәтижелерге дейін тәжірибелі ғалымдардың қолдауын алыңыз."}</p></div></section>
    <section className="journal-catalog"><form className="science-filters mentorship-filters" action="/mentorship"><input type="hidden" name="lang" value={locale} /><label><span className="visually-hidden">{locale === "ru" ? "Поиск по названию" : "Атауы бойынша іздеу"}</span><input type="search" name="q" defaultValue={filters.query} maxLength={120} placeholder={locale === "ru" ? "Поиск по названию" : "Атауы бойынша іздеу"} /></label>
      <select name="field" defaultValue={filters.field} aria-label={locale === "ru" ? "Направление" : "Бағыт"}><option value="">{locale === "ru" ? "Все направления" : "Барлық бағыттар"}</option>{taxonomy.fields.map(item => <option key={item.id} value={item.slug}>{locale === "ru" ? item.nameRu : item.nameKk}</option>)}</select>
      <select name="format" defaultValue={filters.format} aria-label={locale === "ru" ? "Формат" : "Формат"}><option value="all">{locale === "ru" ? "Все форматы" : "Барлық форматтар"}</option>{mentorshipFormats.map(format => <option key={format} value={format}>{mentorshipFormatLabels[locale][format]}</option>)}</select><button>{locale === "ru" ? "Найти" : "Іздеу"}</button>
    </form><p className="science-count">{locale === "ru" ? `${offers.length} предложений · до 100 последних` : `${offers.length} ұсыныс · соңғы 100-ге дейін`}</p>
      {offers.length ? <div className="public-article-grid">{offers.map(offer => {
        const t = offer.translations.find(item => item.locale === locale)!;
        const mentor = offer.mentor.find(item => item.locale === locale)!;
        return <article className="public-article-card mentorship-card" key={offer.id}><div className="public-card-content"><p className="science-card-field">{locale === "ru" ? offer.field?.nameRu : offer.field?.nameKk} · {mentorshipFormatLabels[locale][offer.format]}</p><h2><Link href={"/mentorship/" + locale + "/" + t.slug}>{t.title}</Link></h2><p>{t.summary}</p><p className="mentorship-mentor"><Link href={"/scientists/" + locale + "/" + mentor.slug}>{mentor.fullName}</Link></p><Link className="mentorship-card-link" href={"/mentorship/" + locale + "/" + t.slug}>{locale === "ru" ? "Условия и заявка →" : "Шарттар мен өтінім →"}</Link></div></article>;
      })}</div> : <div className="journal-empty"><h2>{locale === "ru" ? "Предложения не найдены" : "Ұсыныстар табылмады"}</h2><p>{locale === "ru" ? "Попробуйте изменить фильтры. Новые предложения появятся после публикации координатором." : "Сүзгілерді өзгертіп көріңіз. Жаңа ұсыныстар үйлестіруші жариялағаннан кейін пайда болады."}</p><Link href={"/mentorship?lang=" + locale}>{locale === "ru" ? "Сбросить фильтры" : "Сүзгілерді қалпына келтіру"}</Link></div>}
    </section></main></>;
}
async function detail(params: MentorshipDetailParams) {
  const value = await params;
  const locale = z.enum(["ru", "kk"]).safeParse(value.locale);
  if (!locale.success || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) || value.slug.length > 160) notFound();
  const offer = await getPublicMentorship(locale.data, value.slug);
  const translation = offer?.translations.find(item => item.locale === locale.data);
  if (!offer || !translation) notFound();
  return { locale: locale.data, offer, translation };
}
export async function mentorshipDetailMetadata(params: MentorshipDetailParams): Promise<Metadata> {
  const { locale, offer, translation } = await detail(params);
  const canonical = "/mentorship/" + locale + "/" + translation.slug;
  return { title: translation.title + " — СМУ", description: translation.summary,
    alternates: { canonical, languages: Object.fromEntries(offer.translations.map(t => [t.locale, "/mentorship/" + t.locale + "/" + t.slug])) },
    openGraph: { type: "website", title: translation.title, description: translation.summary, url: canonical, locale: locale === "ru" ? "ru_RU" : "kk_KZ" } };
}
export async function PublicMentorshipDetail({ params }: { params: MentorshipDetailParams }) {
  const { locale, offer, translation } = await detail(params);
  const mentor = offer.mentor.find(item => item.locale === locale)!;
  return <><Header locale={locale} translations={offer.translations} /><main className="public-article-shell" lang={locale}>
    <nav className="public-breadcrumbs" aria-label={locale === "ru" ? "Хлебные крошки" : "Навигация"}><Link href={"/mentorship?lang=" + locale}>{locale === "ru" ? "Наставничество" : "Тәлімгерлік"}</Link><span>/</span><span>{translation.title}</span></nav>
    <header className="public-article-header"><p className="science-card-field">{locale === "ru" ? offer.field?.nameRu : offer.field?.nameKk}</p><h1>{translation.title}</h1><p className="public-article-lead">{translation.summary}</p></header>
    <div className="public-article-layout"><div className="science-work-body"><h2>{locale === "ru" ? "О наставничестве" : "Тәлімгерлік туралы"}</h2><p>{translation.description}</p><ApplicationForm offerId={offer.id} locale={locale} /></div>
      <aside className="public-article-aside science-work-aside"><section><h2>{locale === "ru" ? "Наставник" : "Тәлімгер"}</h2><Link href={"/scientists/" + locale + "/" + mentor.slug}>{mentor.fullName}</Link></section><section><h2>{locale === "ru" ? "Формат" : "Формат"}</h2><p>{mentorshipFormatLabels[locale][offer.format]}</p></section><section><h2>{locale === "ru" ? "Участие" : "Қатысу"}</h2><p>{locale === "ru" ? `До ${offer.capacity} участников одновременно. Заявка проходит рассмотрение; отправка не гарантирует место.` : `Бір уақытта ${offer.capacity} қатысушыға дейін. Өтінім қарастырылады; жіберу орынға кепілдік бермейді.`}</p></section></aside>
    </div><div className="science-return"><Link href={"/mentorship?lang=" + locale}>{locale === "ru" ? "← Все предложения" : "← Барлық ұсыныстар"}</Link></div>
  </main></>;
}
