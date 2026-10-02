/* eslint-disable @next/next/no-img-element -- Supabase public URLs are configured at runtime. */
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, FlaskConical, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScienceHeader } from "./ScienceHeader";
import { scienceWorkPath, scienceWorkStageLabels, scienceWorkTitles } from "@/lib/science-work";
import { publicScienceWorkFiltersSchema } from "@/lib/validation/science-work";
import { getPublicScienceWork, PublicScienceWorkService } from "@/server/services/science-work.service";
import { scienceWorkStages, type ScienceWorkKind } from "@/types/domain/science-work";
import type { ScientistLocale } from "@/types/domain/scientist";

type SearchParams = Promise<{ lang?: string; q?: string; organization?: string; field?: string; stage?: string }>;
export type ScienceDetailParams = Promise<{ locale: string; slug: string }>;
const copy = {
  ru: { eyebrow: "Наука региона", intro: "Откройте научные работы Актюбинской области: направления, команды и результаты.", search: "Поиск по названию", organizations: "Все организации", fields: "Все направления", stages: "Все этапы", find: "Найти", empty: "Научные работы не найдены", hint: "Здесь появятся опубликованные работы. Попробуйте изменить фильтры.", reset: "Сбросить фильтры", read: "Подробнее", description: "Описание и цели", results: "Результаты", team: "Команда", lead: "Руководитель", noTeam: "Участники не указаны", organization: "Организация", dates: "Сроки", from: "Начало", to: "Окончание", external: "Сайт / публикация", catalog: "Вернуться в каталог", notFound: "Работа не найдена", count: "записей · до 100 последних", footer: "Совет молодых учёных" },
  kk: { eyebrow: "Өңір ғылымы", intro: "Ақтөбе облысының ғылыми жұмыстарын ашыңыз: бағыттар, командалар және нәтижелер.", search: "Атауы бойынша іздеу", organizations: "Барлық ұйымдар", fields: "Барлық бағыттар", stages: "Барлық кезеңдер", find: "Іздеу", empty: "Ғылыми жұмыстар табылмады", hint: "Мұнда жарияланған жұмыстар көрсетіледі. Сүзгілерді өзгертіп көріңіз.", reset: "Сүзгілерді қалпына келтіру", read: "Толығырақ", description: "Сипаттама және мақсаттар", results: "Нәтижелер", team: "Команда", lead: "Жетекші", noTeam: "Қатысушылар көрсетілмеген", organization: "Ұйым", dates: "Мерзімдер", from: "Басталуы", to: "Аяқталуы", external: "Сайт / жарияланым", catalog: "Каталогқа оралу", notFound: "Жұмыс табылмады", count: "жазба · соңғы 100 жазбаға дейін", footer: "Жас ғалымдар кеңесі" },
} as const;
function validLocale(locale: string): ScientistLocale {
  if (locale !== "ru" && locale !== "kk") notFound();
  return locale;
}
export async function scienceCatalogMetadata(kind: ScienceWorkKind, searchParams: SearchParams): Promise<Metadata> {
  const state = await searchParams;
  const locale = state.lang === "kk" ? "kk" : "ru";
  return { title: scienceWorkTitles[locale][kind], description: copy[locale].intro };
}
export async function PublicScienceWorkCatalog({ kind, searchParams }: { kind: ScienceWorkKind; searchParams: SearchParams }) {
  const state = await searchParams;
  const locale = state.lang === "kk" ? "kk" : "ru";
  const parsed = publicScienceWorkFiltersSchema.safeParse({ locale, query: state.q ?? "", organization: state.organization ?? "", field: state.field ?? "", stage: state.stage ?? "all" });
  const filters = parsed.success ? parsed.data : publicScienceWorkFiltersSchema.parse({ locale });
  const { works, taxonomy } = await new PublicScienceWorkService().list(kind, filters);
  const text = copy[filters.locale];
  const base = scienceWorkPath(kind);
  return <>
    <ScienceHeader kind={kind} locale={filters.locale} />
    <main><section className="journal-hero"><div className="journal-hero-inner"><p className="journal-eyebrow">{text.eyebrow}</p><h1>{scienceWorkTitles[filters.locale][kind]}</h1><p>{text.intro}</p></div></section>
      <section className="journal-catalog"><form action={base} className="science-filters">
        <input type="hidden" name="lang" value={filters.locale} />
        <label><Search aria-hidden="true" /><span className="visually-hidden">{text.search}</span><input type="search" name="q" defaultValue={filters.query} placeholder={text.search} maxLength={120} /></label>
        <select name="organization" defaultValue={filters.organization} aria-label={text.organization}><option value="">{text.organizations}</option>{taxonomy.organizations.map(item => <option key={item.id} value={item.slug}>{filters.locale === "ru" ? item.nameRu : item.nameKk}</option>)}</select>
        <select name="field" defaultValue={filters.field} aria-label={text.fields}><option value="">{text.fields}</option>{taxonomy.fields.map(item => <option key={item.id} value={item.slug}>{filters.locale === "ru" ? item.nameRu : item.nameKk}</option>)}</select>
        <select name="stage" defaultValue={filters.stage} aria-label={text.stages}><option value="all">{text.stages}</option>{scienceWorkStages.map(stage => <option key={stage} value={stage}>{scienceWorkStageLabels[filters.locale][stage]}</option>)}</select><button type="submit">{text.find}</button>
      </form><p className="science-count" aria-live="polite">{works.length} {text.count}</p>
      {works.length ? <div className="public-article-grid">{works.map(work => {
        const translation = work.translations.find(item => item.locale === filters.locale)!;
        const href = base + "/" + filters.locale + "/" + translation.slug;
        return <article className="public-article-card science-card" key={work.id}><Link className="public-card-cover" href={href} aria-label={translation.title}>{work.coverUrl ? <img src={work.coverUrl} alt="" loading="lazy" /> : <FlaskConical aria-hidden="true" />}</Link><div className="public-card-content"><div className="public-card-meta"><span>{scienceWorkStageLabels[filters.locale][work.stage]}</span></div><h2><Link href={href}>{translation.title}</Link></h2><p>{translation.summary}</p>{work.field ? <small className="science-card-field">{filters.locale === "ru" ? work.field.nameRu : work.field.nameKk}</small> : null}<Link className="public-card-link" href={href}>{text.read}<ArrowUpRight aria-hidden="true" /></Link></div></article>;
      })}</div> : <div className="journal-empty"><FlaskConical aria-hidden="true" /><h2>{text.empty}</h2><p>{text.hint}</p>{filters.query || filters.field || filters.organization || filters.stage !== "all" ? <Link href={base + "?lang=" + filters.locale}>{text.reset}</Link> : null}</div>}
      </section>
    </main><footer className="journal-footer"><span>© {new Date().getFullYear()} {text.footer}</span><Link href={"/scientists?lang=" + filters.locale}>{filters.locale === "ru" ? "Научное сообщество" : "Ғылыми қауымдастық"}</Link></footer>
  </>;
}
export async function scienceDetailMetadata(kind: ScienceWorkKind, params: ScienceDetailParams): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = validLocale(rawLocale);
  const work = await getPublicScienceWork(kind, locale, slug);
  const translation = work?.translations.find(item => item.locale === locale);
  if (!work || !translation) return { title: copy[locale].notFound };
  const path = scienceWorkPath(kind);
  return {
    title: translation.title, description: translation.summary,
    alternates: { canonical: path + "/" + locale + "/" + slug, languages: Object.fromEntries(work.translations.map(item => [item.locale, path + "/" + item.locale + "/" + item.slug])) },
    openGraph: { title: translation.title, description: translation.summary, type: "article", locale: locale === "ru" ? "ru_RU" : "kk_KZ", images: work.coverUrl ? [{ url: work.coverUrl }] : undefined },
  };
}
export async function PublicScienceWorkDetail({ kind, params }: { kind: ScienceWorkKind; params: ScienceDetailParams }) {
  const { locale: rawLocale, slug } = await params;
  const locale = validLocale(rawLocale);
  const work = await getPublicScienceWork(kind, locale, slug);
  const translation = work?.translations.find(item => item.locale === locale);
  if (!work || !translation) notFound();
  const text = copy[locale];
  const base = scienceWorkPath(kind);
  const date = (value: string) => new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
  return <>
    <ScienceHeader kind={kind} locale={locale} translations={work.translations} />
    <main className="public-article-page"><div className="public-article-shell">
      <nav className="public-breadcrumbs" aria-label={text.catalog}><Link href={base + "?lang=" + locale}><ArrowLeft aria-hidden="true" />{scienceWorkTitles[locale][kind]}</Link></nav>
      <header className="public-article-header"><div className="public-article-kicker">{work.field ? <Link href={base + "?lang=" + locale + "&field=" + work.field.slug}>{locale === "ru" ? work.field.nameRu : work.field.nameKk}</Link> : null}<span>{scienceWorkStageLabels[locale][work.stage]}</span></div><h1>{translation.title}</h1><p className="public-article-lead">{translation.summary}</p></header>
      {work.coverUrl ? <figure className="public-article-cover"><img src={work.coverUrl} alt={translation.title} /></figure> : null}
      <div className="public-article-layout"><article className="science-work-body"><h2>{text.description}</h2>{translation.description.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}{translation.results ? <><h2>{text.results}</h2>{translation.results.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</> : null}</article>
        <aside className="public-article-aside science-work-aside">
          {work.organization ? <div><small>{text.organization}</small><Link href={base + "?lang=" + locale + "&organization=" + work.organization.slug}>{locale === "ru" ? work.organization.nameRu : work.organization.nameKk}</Link></div> : null}
          {work.startDate || work.endDate ? <div><small>{text.dates}</small>{work.startDate ? <span>{text.from}: <time dateTime={work.startDate}>{date(work.startDate)}</time></span> : null}{work.endDate ? <span>{text.to}: <time dateTime={work.endDate}>{date(work.endDate)}</time></span> : null}</div> : null}
          <div><small>{text.team}</small>{work.members.length ? work.members.map(member => {
            const person = member.translations.find(item => item.locale === locale);
            return person ? <div key={member.id} className="science-team-member"><Link href={"/scientists/" + locale + "/" + person.slug}>{person.fullName}</Link>{member.role === "lead" ? <span>{text.lead}</span> : null}</div> : null;
          }) : <span>{text.noTeam}</span>}</div>
          {work.doi ? <a href={"https://doi.org/" + work.doi} target="_blank" rel="noreferrer">DOI: {work.doi}<ArrowUpRight aria-hidden="true" /></a> : null}
          {work.externalUrl ? <a href={work.externalUrl} target="_blank" rel="noreferrer">{text.external}<ArrowUpRight aria-hidden="true" /></a> : null}
        </aside>
      </div><div className="science-return"><Link href={base + "?lang=" + locale}>{text.catalog}</Link></div>
    </div></main><footer className="journal-footer"><span>© {new Date().getFullYear()} {text.footer}</span><Link href={base + "?lang=" + locale}>{scienceWorkTitles[locale][kind]}</Link></footer>
  </>;
}
