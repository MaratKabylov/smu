import Link from "next/link";
import { FlaskConical, Search } from "lucide-react";
import { catalogMetadata } from "@/lib/seo/metadata";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { PublicResearchOutputCard } from "@/components/science/PublicResearchOutputs";
import { ResearchOutputService } from "@/server/services/research-output.service";
import { Pagination } from "@/components/search/Pagination";
import { readPage, readSearch, searchCopy } from "@/lib/search";
import type { PublicQuery } from "@/lib/i18n/locales";

const heroEyebrows = {
  ru: "Научная деятельность",
  kk: "Ғылыми қызмет",
  en: "Scientific Activity",
};

const heroTitles = {
  ru: "Научные результаты",
  kk: "Ғылыми нәтижелер",
  en: "Research Outputs",
};

const heroIntros = {
  ru: "Наборы данных, отчёты, аналитические карты, методики и прикладные инструменты исследователей региона.",
  kk: "Өңір зерттеушілерінің деректер жиынтығы, есептері, талдау карталары, әдістемелері мен қолданбалы құралдары.",
  en: "Datasets, reports, analytical maps, methodologies, and applied research tools by regional scientists.",
};

const countWord = {
  ru: "результатов в каталоге",
  kk: "каталогтағы нәтиже",
  en: "outputs in directory",
};

const emptyTitles = {
  ru: "Научные результаты не найдены",
  kk: "Ғылыми нәтижелер табылмады",
  en: "No research outputs found",
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
    "results",
    getDictionary(locale).common.brands.results,
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
  const kind = typeof state.kind === "string" ? state.kind : "all";

  const { outputs, pagination } = await new ResearchOutputService().listPublicPage(
    locale,
    query,
    readPage(state.page),
    kind
  );
  const text = searchCopy[locale];

  return (
    <>
      <PublicHeader locale={locale} section="results" />
      <main>
        <section className="journal-hero">
          <div className="journal-hero-inner">
            <p className="journal-eyebrow">{heroEyebrows[locale]}</p>
            <h1>{heroTitles[locale]}</h1>
            <p>{heroIntros[locale]}</p>
          </div>
        </section>

        <section className="journal-catalog">
          <form action={`/${locale}/results`} className="science-filters">
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

          {outputs.length ? (
            <div className="public-article-grid">
              {outputs.map((item) => (
                <PublicResearchOutputCard key={item.id} item={item} locale={locale} />
              ))}
            </div>
          ) : (
            <div className="journal-empty">
              <FlaskConical size={44} aria-hidden="true" />
              <h2>{emptyTitles[locale]}</h2>
              <p>{emptyHints[locale]}</p>
              {query || kind !== "all" ? (
                <Link
                  href={`/${locale}/results`}
                  className="secondary-button"
                  style={{ marginTop: "12px" }}
                >
                  {locale === "ru"
                    ? "Сбросить поиск"
                    : locale === "en"
                    ? "Reset search"
                    : "Іздеуді тазарту"}
                </Link>
              ) : null}
            </div>
          )}

          <Pagination
            {...pagination}
            locale={locale}
            path={`/${locale}/results`}
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
