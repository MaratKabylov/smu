import Link from "next/link";
import { BookOpenText, Search } from "lucide-react";
import { catalogMetadata } from "@/lib/seo/metadata";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { PublicPublicationCard } from "@/components/science/PublicPublications";
import { PublicationService } from "@/server/services/publication.service";
import { Pagination } from "@/components/search/Pagination";
import { readPage, readSearch, searchCopy } from "@/lib/search";
import type { PublicQuery } from "@/lib/i18n/locales";

const heroEyebrows = {
  ru: "Научная деятельность",
  kk: "Ғылыми қызмет",
  en: "Scientific Activity",
};

const heroTitles = {
  ru: "Научные публикации",
  kk: "Ғылыми жарияланымдар",
  en: "Scientific publications",
};

const heroIntros = {
  ru: "Рецензируемые статьи, монографии, материалы конференций и библиографические труды исследователей региона.",
  kk: "Өңір зерттеушілерінің рецензияланған мақалалары, монографиялары, конференция материалдары мен библиографиялық еңбектері.",
  en: "Peer-reviewed articles, books, conference papers, and bibliographic research outputs by regional scientists.",
};

const countWord = {
  ru: "публикаций в каталоге",
  kk: "каталогтағы жарияланым",
  en: "publications in directory",
};

const emptyTitles = {
  ru: "Публикации не найдены",
  kk: "Жарияланымдар табылмады",
  en: "No publications found",
};

const emptyHints = {
  ru: "Попробуйте изменить поисковый запрос или сбросить фильтры.",
  kk: "Іздеу сұрауын өзгертіп көріңіз немесе сүзгілерді қалпына келтіріңіз.",
  en: "Try modifying your search query or resetting filters.",
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: LocaleParams;
  searchParams: Promise<PublicQuery>;
}) {
  const locale = requireLocale((await params).locale);
  return catalogMetadata(
    locale,
    "publications",
    getDictionary(locale).common.brands.publications,
    getDictionary(locale).science.intro,
    await searchParams
  );
}

export default async function Page({
  params,
  searchParams,
}: {
  params: LocaleParams;
  searchParams: Promise<PublicQuery>;
}) {
  const locale = requireLocale((await params).locale);
  const state = await searchParams;
  const query = readSearch(state.q);
  const { publications, pagination } = await new PublicationService().listPublicPage(
    locale,
    query,
    readPage(state.page)
  );
  const text = searchCopy[locale];

  return (
    <>
      <PublicHeader locale={locale} section="publications" />
      <main>
        <section className="journal-hero">
          <div className="journal-hero-inner">
            <p className="journal-eyebrow">{heroEyebrows[locale]}</p>
            <h1>{heroTitles[locale]}</h1>
            <p>{heroIntros[locale]}</p>
          </div>
        </section>

        <section className="journal-catalog">
          <form action={`/${locale}/publications`} className="science-filters">
            <label>
              <Search size={16} aria-hidden="true" />
              <span className="visually-hidden">{text.input}</span>
              <input
                name="q"
                type="search"
                defaultValue={query}
                maxLength={120}
                placeholder={text.input}
              />
            </label>
            <button type="submit">{text.find}</button>
          </form>

          <p className="science-count" aria-live="polite">
            {pagination.total} {countWord[locale]}
          </p>

          {publications.length ? (
            <div className="public-article-grid">
              {publications.map((item) => (
                <PublicPublicationCard key={item.id} item={item} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="journal-empty">
              <BookOpenText size={44} aria-hidden="true" />
              <h2>{emptyTitles[locale]}</h2>
              <p>{emptyHints[locale]}</p>
              {query ? (
                <Link href={`/${locale}/publications`} className="secondary-button" style={{ marginTop: "12px" }}>
                  {locale === "ru" ? "Сбросить поиск" : locale === "en" ? "Reset search" : "Іздеуді тазарту"}
                </Link>
              ) : null}
            </div>
          )}

          <Pagination
            {...pagination}
            locale={locale}
            path={`/${locale}/publications`}
            query={state}
          />
        </section>
      </main>

      <footer className="journal-footer">
        <span>© {new Date().getFullYear()} {getDictionary(locale).science.footer}</span>
        <Link href={"/" + locale + "/scientists"}>
          {locale === "ru" ? "Научное сообщество" : "Ғылыми қауымдастық"}
        </Link>
      </footer>
    </>
  );
}
