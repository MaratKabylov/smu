import { catalogMetadata } from "@/lib/seo/metadata";
import type { PublicQuery } from "@/lib/i18n/locales";
import { Pagination } from "@/components/search/Pagination";
import { readPage } from "@/lib/search";
import { requireLocale, type LocaleParams } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Metadata } from "next";
import { BookOpenText, Search } from "lucide-react";
import Link from "next/link";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { PublicArticleCard } from "@/components/journal/PublicArticleCard";
import { publicArticleFiltersSchema } from "@/lib/validation/article";
import { PublicArticleService } from "@/server/services/public-article.service";
import type { ArticleLocale } from "@/types/domain/article";

export async function generateMetadata({ params, searchParams = Promise.resolve({}) }: { params: LocaleParams; searchParams?: Promise<PublicQuery> }): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const copy = getDictionary(locale);
  return catalogMetadata(locale, "journal", copy.common.brands.journal, copy.journalCatalog.intro, await searchParams);
}

type JournalPageProps = {
  params: LocaleParams; searchParams: Promise<{
    page?: string; lang?: string;
    q?: string;
    category?: string;
    tag?: string;
  }>;
};

export default async function JournalPage({ searchParams, params: routeParams }: JournalPageProps) {
  const params = await searchParams;
  const locale = requireLocale((await routeParams).locale);
  const parsed = publicArticleFiltersSchema.safeParse({
    locale,
    query: params.q ?? "",
    category: params.category ?? "",
    tag: params.tag ?? "",
  });
  const filters = parsed.success
    ? parsed.data
    : { locale, query: "", category: "", tag: "" };
  const { articles, taxonomy, pagination } = await new PublicArticleService().listPage(filters, readPage(params.page));
  const [featured, ...rest] = articles;
  const copy = getDictionary(filters.locale).journalCatalog;

  return (
    <>
      <JournalHeader locale={filters.locale} />
      <main>
        <section className="journal-hero">
          <div className="journal-hero-inner">
            <p className="journal-eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p>{copy.intro}</p>
          </div>
        </section>

        <section className="journal-catalog">
          <div className="journal-category-row" aria-label={copy.categories}>
            <Link className={!filters.category ? "is-active" : ""} href={buildHref(filters, { category: "" })}>
              {copy.allCategories}
            </Link>
            {taxonomy.categories.map((category) => (
              <Link
                className={filters.category === category.slug ? "is-active" : ""}
                href={buildHref(filters, { category: category.slug })}
                key={category.id}
              >
                {filters.locale === "en" ? category.nameEn ?? category.nameRu : filters.locale === "ru" ? category.nameRu : category.nameKk}
              </Link>
            ))}
          </div>

          <div className="journal-toolbar">
            <form action={`/${locale}/journal`} className="journal-search-form">
              {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
              <label>
                <Search aria-hidden="true" />
                <span className="visually-hidden">{copy.search}</span>
                <input type="search" name="q" defaultValue={filters.query} placeholder={copy.search} />
              </label>
              <select name="tag" defaultValue={filters.tag} aria-label={copy.tag}>
                <option value="">{copy.allTags}</option>
                {taxonomy.tags.map((tag) => (
                  <option value={tag.slug} key={tag.id}>{filters.locale === "en" ? tag.nameEn ?? tag.nameRu : filters.locale === "ru" ? tag.nameRu : tag.nameKk}</option>
                ))}
              </select>
              <button type="submit">{copy.find}</button>
            </form>
            <span>{pagination.total} {copy.materials}</span>
          </div>

          {featured ? (
            <>
              <PublicArticleCard article={featured} locale={filters.locale} featured />
              {rest.length > 0 ? (
                <div className="public-article-grid">
                  {rest.map((article) => <PublicArticleCard article={article} locale={filters.locale} key={article.id} />)}
                </div>
              ) : null}
            </>
          ) : (
            <div className="journal-empty">
              <BookOpenText aria-hidden="true" />
              <h2>{filters.query || filters.category || filters.tag ? copy.notFound : copy.empty}</h2>
              <p>{filters.query || filters.category || filters.tag ? copy.changeFilters : copy.emptyHint}</p>
              {filters.query || filters.category || filters.tag ? <Link href={`/${filters.locale}/journal`}>{copy.reset}</Link> : null}
            </div>
          )}
        <Pagination {...pagination} path={`/${locale}/journal`} query={params} locale={locale} />
      </section>
      </main>
      <footer className="journal-footer">
        <span>© {new Date().getFullYear()} {getDictionary(locale).common.footer}</span>
        <Link href="/admin">SMU Admin</Link>
      </footer>
    </>
  );
}

function buildHref(
  filters: { locale: ArticleLocale; query: string; category: string; tag: string },
  update: Partial<{ query: string; category: string; tag: string }>,
) {
  const next = { ...filters, ...update };
  const params = new URLSearchParams();
  if (next.query) params.set("q", next.query);
  if (next.category) params.set("category", next.category);
  if (next.tag) params.set("tag", next.tag);
  return `/${next.locale}/journal${params.size ? `?${params}` : ""}`;
}
