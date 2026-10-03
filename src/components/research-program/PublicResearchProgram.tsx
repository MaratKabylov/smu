import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ApplicationForm } from "./ApplicationForm";
import { programApplicationsOpen, programDate, researchProgramFormatLabels } from "@/lib/research-program";
import { researchProgramFiltersSchema } from "@/lib/validation/research-program";
import { getPublicResearchProgram, PublicResearchProgramService } from "@/server/services/research-program.service";
import { researchProgramFormats, type ResearchProgramTranslation } from "@/types/domain/research-program";
import type { ScientistLocale } from "@/types/domain/scientist";

export type ResearchProgramCatalogSearch = Promise<{ lang?: string; q?: string; field?: string; format?: string }>;
export type ResearchProgramDetailParams = Promise<{ locale: string; slug: string }>;
function localeFrom(value?: string): ScientistLocale { return value === "kk" ? "kk" : "ru"; }
function Header({ locale, translations }: { locale: ScientistLocale; translations?: ResearchProgramTranslation[] }) {
  const languageUrl = (language: ScientistLocale) => {
    const t = translations?.find(item => item.locale === language);
    return t ? "/research-program/" + language + "/" + t.slug : "/research-program?lang=" + language;
  };
  return <header className="journal-header"><div className="journal-header-inner"><Link className="journal-brand" href={"/research-program?lang=" + locale}><span className="journal-brand-mark">СМУ</span><span><strong>{locale === "ru" ? "Research Program" : "Зерттеу бағдарламасы"}</strong><small>{locale === "ru" ? "Актюбинская область" : "Ақтөбе облысы"}</small></span></Link>
    <nav className="journal-nav" aria-label={locale === "ru" ? "Основная навигация" : "Негізгі навигация"}><Link href={"/scientists?lang=" + locale}>{locale === "ru" ? "Учёные" : "Ғалымдар"}</Link><Link href={"/research?lang=" + locale}>{locale === "ru" ? "Исследования" : "Зерттеулер"}</Link><Link href={"/projects?lang=" + locale}>{locale === "ru" ? "Проекты" : "Жобалар"}</Link><Link href={"/mentorship?lang=" + locale}>{locale === "ru" ? "Наставничество" : "Тәлімгерлік"}</Link><Link href={"/research-program?lang=" + locale} aria-current="page">{locale === "ru" ? "Research Program" : "Зерттеу бағдарламасы"}</Link><Link href={"/journal?lang=" + locale}>Журнал</Link></nav>
    <div className="journal-language" aria-label={locale === "ru" ? "Выбор языка" : "Тілді таңдау"}><Link href={languageUrl("ru")} className={locale === "ru" ? "is-active" : ""}>RU</Link><Link href={languageUrl("kk")} className={locale === "kk" ? "is-active" : ""}>ҚАЗ</Link></div>
  </div></header>;
}
export async function researchProgramCatalogMetadata(searchParams: ResearchProgramCatalogSearch): Promise<Metadata> {
  const locale = localeFrom((await searchParams).lang);
  return { title: locale === "ru" ? "Research Program — СМУ" : "Зерттеу бағдарламасы — СМУ", description: locale === "ru" ? "Программы научного сообщества Актюбинской области. Выберите направление и подайте заявку на участие." : "Ақтөбе облысының ғылыми қауымдастық зерттеу бағдарламалары. Бағытты таңдап, қатысуға өтінім беріңіз." };
}
export async function PublicResearchProgramCatalog({ searchParams }: { searchParams: ResearchProgramCatalogSearch }) {
  const state = await searchParams;
  const locale = localeFrom(state.lang);
  const parsed = researchProgramFiltersSchema.safeParse({ locale, query: state.q ?? "", field: state.field ?? "", format: state.format ?? "all" });
  const filters = parsed.success ? parsed.data : researchProgramFiltersSchema.parse({ locale });
  const { programs, taxonomy } = await new PublicResearchProgramService().list(filters);
  return <><Header locale={locale} /><main lang={locale}><section className="journal-hero"><div className="journal-hero-inner"><p className="journal-eyebrow">{locale === "ru" ? "Научное сообщество · СМУ" : "Ғылыми қауымдастық · СМУ"}</p><h1>{locale === "ru" ? "От идеи к исследованию" : "Идеядан зерттеуге"}</h1><p className="journal-hero-description">{locale === "ru" ? "Исследовательские программы для молодых учёных: изучайте методы, работайте над проектом и представляйте результаты." : "Жас ғалымдарға арналған зерттеу бағдарламалары: әдістерді үйреніңіз, жобамен жұмыс істеңіз және нәтижелерді ұсыныңыз."}</p></div></section>
    <section className="journal-catalog"><form className="science-filters mentorship-filters" action="/research-program"><input type="hidden" name="lang" value={locale} /><label><span className="visually-hidden">{locale === "ru" ? "Поиск по названию" : "Атауы бойынша іздеу"}</span><input type="search" name="q" defaultValue={filters.query} maxLength={120} placeholder={locale === "ru" ? "Поиск по названию" : "Атауы бойынша іздеу"} /></label>
      <select name="field" defaultValue={filters.field} aria-label={locale === "ru" ? "Направление" : "Бағыт"}><option value="">{locale === "ru" ? "Все направления" : "Барлық бағыттар"}</option>{taxonomy.fields.map(item => <option key={item.id} value={item.slug}>{locale === "ru" ? item.nameRu : item.nameKk}</option>)}</select>
      <select name="format" defaultValue={filters.format} aria-label={locale === "ru" ? "Формат" : "Формат"}><option value="all">{locale === "ru" ? "Все форматы" : "Барлық форматтар"}</option>{researchProgramFormats.map(format => <option key={format} value={format}>{researchProgramFormatLabels[locale][format]}</option>)}</select><button>{locale === "ru" ? "Найти" : "Іздеу"}</button>
    </form><p className="science-count">{locale === "ru" ? `${programs.length} программ · до 100 последних` : `${programs.length} бағдарлама · соңғы 100-ге дейін`}</p>
      {programs.length ? <div className="public-article-grid">{programs.map(program => {
        const t = program.translations.find(item => item.locale === locale)!;
        const coordinator = program.coordinator.find(item => item.locale === locale)!;
        return <article className="public-article-card mentorship-card" key={program.id}><div className="public-card-content"><p className="science-card-field">{locale === "ru" ? program.field?.nameRu : program.field?.nameKk} · {researchProgramFormatLabels[locale][program.format]}</p><h2><Link href={"/research-program/" + locale + "/" + t.slug}>{t.title}</Link></h2><p>{t.summary}</p>
          <p className="program-dates">{programDate(program.startsOn, locale)} — {programDate(program.endsOn, locale)}</p>
          <p className="program-intake">{programApplicationsOpen(program) ? (locale === "ru" ? "Набор открыт" : "Қабылдау ашық") : (locale === "ru" ? "Приём заявок закрыт" : "Өтінім қабылдау жабық")} · {locale === "ru" ? "Заявки до " : "Өтінім мерзімі: "}{programDate(program.applicationDeadline, locale)}</p>
          <p className="mentorship-mentor"><Link href={"/scientists/" + locale + "/" + coordinator.slug}>{coordinator.fullName}</Link></p><Link className="mentorship-card-link" href={"/research-program/" + locale + "/" + t.slug}>{locale === "ru" ? "Программа и заявка →" : "Бағдарлама мен өтінім →"}</Link></div></article>;
      })}</div> : <div className="journal-empty"><h2>{locale === "ru" ? "Программы не найдены" : "Бағдарламалар табылмады"}</h2><p>{locale === "ru" ? "Попробуйте изменить фильтры. Новые программы появятся после публикации координатором." : "Сүзгілерді өзгертіп көріңіз. Жаңа бағдарламалар үйлестіруші жариялағаннан кейін пайда болады."}</p><Link href={"/research-program?lang=" + locale}>{locale === "ru" ? "Сбросить фильтры" : "Сүзгілерді қалпына келтіру"}</Link></div>}
    </section></main></>;
}
async function detail(params: ResearchProgramDetailParams) {
  const value = await params;
  const locale = z.enum(["ru", "kk"]).safeParse(value.locale);
  if (!locale.success || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) || value.slug.length > 160) notFound();
  const program = await getPublicResearchProgram(locale.data, value.slug);
  const translation = program?.translations.find(item => item.locale === locale.data);
  if (!program || !translation) notFound();
  return { locale: locale.data, program, translation };
}
export async function researchProgramDetailMetadata(params: ResearchProgramDetailParams): Promise<Metadata> {
  const { locale, program, translation } = await detail(params);
  const canonical = "/research-program/" + locale + "/" + translation.slug;
  return { title: translation.title + " — СМУ", description: translation.summary,
    alternates: { canonical, languages: Object.fromEntries(program.translations.map(t => [t.locale, "/research-program/" + t.locale + "/" + t.slug])) },
    openGraph: { type: "website", title: translation.title, description: translation.summary, url: canonical, locale: locale === "ru" ? "ru_RU" : "kk_KZ" } };
}
export async function PublicResearchProgramDetail({ params }: { params: ResearchProgramDetailParams }) {
  const { locale, program, translation } = await detail(params);
  const coordinator = program.coordinator.find(item => item.locale === locale)!;
  return <><Header locale={locale} translations={program.translations} /><main className="public-article-shell" lang={locale}>
    <nav className="public-breadcrumbs" aria-label={locale === "ru" ? "Хлебные крошки" : "Навигация"}><Link href={"/research-program?lang=" + locale}>{locale === "ru" ? "Research Program" : "Зерттеу бағдарламасы"}</Link><span>/</span><span>{translation.title}</span></nav>
    <header className="public-article-header"><p className="science-card-field">{locale === "ru" ? program.field?.nameRu : program.field?.nameKk}</p><h1>{translation.title}</h1><p className="public-article-lead">{translation.summary}</p></header>
    <div className="public-article-layout"><div className="science-work-body">
      <h2>{locale === "ru" ? "О программе" : "Бағдарлама туралы"}</h2><p>{translation.description}</p>
      <h2>{locale === "ru" ? "План и этапы" : "Жоспар мен кезеңдер"}</h2><p>{translation.curriculum}</p>
      <h2>{locale === "ru" ? "Кто может участвовать" : "Кім қатыса алады"}</h2><p>{translation.eligibility}</p>
      <h2>{locale === "ru" ? "Ожидаемые результаты" : "Күтілетін нәтижелер"}</h2><p>{translation.outcomes}</p>
      {programApplicationsOpen(program) ? <ApplicationForm programId={program.id} locale={locale} /> : <div className="notice" role="status">{locale === "ru" ? "Приём заявок доступен с " : "Өтінім қабылдау мерзімі: "}{programDate(program.applicationsOpenOn, locale)} — {programDate(program.applicationDeadline, locale)}.</div>}
    </div>
      <aside className="public-article-aside science-work-aside">
        <section><h2>{locale === "ru" ? "Координатор" : "Үйлестіруші"}</h2><Link href={"/scientists/" + locale + "/" + coordinator.slug}>{coordinator.fullName}</Link></section>
        <section><h2>{locale === "ru" ? "Формат" : "Формат"}</h2><p>{researchProgramFormatLabels[locale][program.format]}</p></section>
        <section><h2>{locale === "ru" ? "Сроки проведения" : "Өткізу мерзімі"}</h2><p>{programDate(program.startsOn, locale)} — {programDate(program.endsOn, locale)}</p></section>
        <section><h2>{locale === "ru" ? "Приём заявок" : "Өтінім қабылдау"}</h2><p>{programDate(program.applicationsOpenOn, locale)} — {programDate(program.applicationDeadline, locale)}</p><p>{locale === "ru" ? "Последний день включён. Время Актобе (UTC+5)." : "Соңғы күн қоса есептеледі. Ақтөбе уақыты (UTC+5)."}</p></section>
        <section><h2>{locale === "ru" ? "Участие" : "Қатысу"}</h2><p>{locale === "ru" ? `${program.capacity} мест в наборе. Заявка проходит отбор; отправка не гарантирует место.` : `Қабылдауда ${program.capacity} орын. Өтінім іріктеуден өтеді; жіберу орынға кепілдік бермейді.`}</p></section>
      </aside>
    </div><div className="science-return"><Link href={"/research-program?lang=" + locale}>{locale === "ru" ? "← Все программы" : "← Барлық бағдарламалар"}</Link></div>
  </main></>;
}
