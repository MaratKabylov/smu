import type { Metadata } from "next";
import { BookOpenText, Search } from "lucide-react";
import Link from "next/link";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { PublicArticleCard } from "@/components/journal/PublicArticleCard";
import { publicArticleFiltersSchema } from "@/lib/validation/article";
import { PublicArticleService } from "@/server/services/public-article.service";
import type { ArticleLocale } from "@/types/domain/article";

export const metadata: Metadata = {
  title: "Журнал молодых учёных",
  description:
    "Новости, интервью и научные материалы молодых учёных Актюбинской области.",
};

type JournalPageProps = {
  searchParams: Promise<{
    lang?: string;
    q?: string;
    category?: string;
    tag?: string;
  }>;
};

export default async function JournalPage({ searchParams }: JournalPageProps) {
  const params = await searchParams;
  const parsed = publicArticleFiltersSchema.safeParse({
    locale: params.lang ?? "ru",
    query: params.q ?? "",
    category: params.category ?? "",
    tag: params.tag ?? "",
  });
  const filters = parsed.success
    ? parsed.data
    : { locale: "ru" as const, query: "", category: "", tag: "" };
  const { articles, taxonomy } = await new PublicArticleService().list(filters);
  const [featured, ...rest] = articles;
  const copy = journalCopy[filters.locale];

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
                {filters.locale === "ru" ? category.nameRu : category.nameKk}
              </Link>
            ))}
          </div>

          <div className="journal-toolbar">
            <form action="/journal" className="journal-search-form">
              <input type="hidden" name="lang" value={filters.locale} />
              {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
              <label>
                <Search aria-hidden="true" />
                <span className="visually-hidden">{copy.search}</span>
                <input type="search" name="q" defaultValue={filters.query} placeholder={copy.search} />
              </label>
              <select name="tag" defaultValue={filters.tag} aria-label={copy.tag}>
                <option value="">{copy.allTags}</option>
                {taxonomy.tags.map((tag) => (
                  <option value={tag.slug} key={tag.id}>{filters.locale === "ru" ? tag.nameRu : tag.nameKk}</option>
                ))}
              </select>
              <button type="submit">{copy.find}</button>
            </form>
            <span>{articles.length} {copy.materials}</span>
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
              {filters.query || filters.category || filters.tag ? <Link href={`/journal?lang=${filters.locale}`}>{copy.reset}</Link> : null}
            </div>
          )}
        </section>
      </main>
      <footer className="journal-footer">
        <span>© {new Date().getFullYear()} Совет молодых учёных</span>
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
  const params = new URLSearchParams({ lang: next.locale });
  if (next.query) params.set("q", next.query);
  if (next.category) params.set("category", next.category);
  if (next.tag) params.set("tag", next.tag);
  return `/journal?${params.toString()}`;
}

const journalCopy = {
  ru: {
    eyebrow: "Наука · люди · регион",
    title: "Идеи, которые меняют будущее региона",
    intro: "Исследования, истории и новости научного сообщества Актюбинской области — на русском и казахском языках.",
    categories: "Категории материалов",
    allCategories: "Все материалы",
    search: "Поиск по заголовку",
    tag: "Тематический тег",
    allTags: "Все темы",
    find: "Найти",
    materials: "материалов",
    notFound: "Материалы не найдены",
    changeFilters: "Попробуйте изменить запрос, категорию или тематический тег.",
    empty: "Журнал пока готовится к публикации",
    emptyHint: "Здесь появятся новости, интервью и статьи молодых учёных региона.",
    reset: "Сбросить фильтры",
  },
  kk: {
    eyebrow: "Ғылым · адамдар · өңір",
    title: "Өңірдің болашағын өзгертетін идеялар",
    intro: "Ақтөбе облысының ғылыми қоғамдастығы туралы зерттеулер, оқиғалар мен жаңалықтар қазақ және орыс тілдерінде.",
    categories: "Материалдар санаттары",
    allCategories: "Барлық материалдар",
    search: "Тақырып бойынша іздеу",
    tag: "Тақырыптық белгі",
    allTags: "Барлық тақырыптар",
    find: "Іздеу",
    materials: "материал",
    notFound: "Материалдар табылмады",
    changeFilters: "Сұрауды, санатты немесе тақырыптық белгіні өзгертіп көріңіз.",
    empty: "Журнал жариялануға дайындалуда",
    emptyHint: "Мұнда өңірдің жас ғалымдарының жаңалықтары, сұхбаттары мен мақалалары шығады.",
    reset: "Сүзгілерді қалпына келтіру",
  },
} as const;
