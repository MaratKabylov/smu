import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, Languages } from "lucide-react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { articleContentTypeLabels } from "@/lib/articles/presentation";
import { getPublishedArticleBySlug, PublicArticleService } from "@/server/services/public-article.service";
import type { ArticleLocale } from "@/types/domain/article";

type PublicArticlePageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({
  params,
}: PublicArticlePageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  if (!isArticleLocale(rawLocale)) return { title: "Материал не найден" };
  const article = await getPublishedArticleBySlug(rawLocale, slug);
  if (!article) return { title: "Материал не найден" };

  const title = article.translation.seoTitle ?? article.translation.title;
  const description =
    article.translation.seoDescription ?? article.translation.excerpt;
  return {
    title,
    description,
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: article.publishedAt,
      locale: rawLocale === "ru" ? "ru_RU" : "kk_KZ",
      images: article.cover ? [{ url: article.cover.url }] : undefined,
    },
  };
}

export default async function PublicArticlePage({ params }: PublicArticlePageProps) {
  const { locale: rawLocale, slug } = await params;
  if (!isArticleLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const article = await getPublishedArticleBySlug(locale, slug);
  if (!article) {
    const currentSlug = await new PublicArticleService().getSlugRedirect(locale, slug);
    if (currentSlug) permanentRedirect(`/journal/${locale}/${currentSlug}`);
    notFound();
  }

  const copy = detailCopy[locale];
  const categoryName = article.category
    ? locale === "ru"
      ? article.category.nameRu
      : article.category.nameKk
    : locale === "ru"
      ? articleContentTypeLabels[article.contentType]
      : typeLabelsKk[article.contentType];
  const date = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(article.publishedAt));
  const wordCount = article.translation.body.trim().split(/\s+/).length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 180));
  const coverAlt = article.cover
    ? locale === "ru"
      ? article.cover.altRu
      : article.cover.altKk
    : null;
  const coverCaption = article.cover
    ? locale === "ru"
      ? article.cover.captionRu
      : article.cover.captionKk
    : null;

  return (
    <>
      <JournalHeader locale={locale} />
      <main className="public-article-page" lang={locale}>
        <div className="public-article-shell">
          <nav className="public-breadcrumbs" aria-label={copy.breadcrumbs}>
            <Link href={`/journal?lang=${locale}`}><ArrowLeft aria-hidden="true" />{copy.back}</Link>
            <span>/</span>
            <span>{categoryName}</span>
          </nav>

          <article className="public-article">
            <header className="public-article-header">
              <div className="public-article-kicker">
                <Link href={`/journal?lang=${locale}&category=${article.category?.slug ?? ""}`}>{categoryName}</Link>
                <span>{locale.toUpperCase()}</span>
              </div>
              <h1>{article.translation.title}</h1>
              <p className="public-article-lead">{article.translation.excerpt}</p>
              <div className="public-article-byline">
                <span><CalendarDays aria-hidden="true" />{date}</span>
                <span>{readingMinutes} {copy.minutes}</span>
                {article.alternateTranslation ? (
                  <Link href={`/journal/${article.alternateTranslation.locale}/${article.alternateTranslation.slug}`}>
                    <Languages aria-hidden="true" />
                    {locale === "ru" ? "Қазақша оқу" : "Читать по-русски"}
                  </Link>
                ) : null}
              </div>
            </header>

            {article.cover ? (
              <figure className="public-article-cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={article.cover.url} alt={coverAlt ?? ""} />
                {coverCaption ? <figcaption>{coverCaption}</figcaption> : null}
              </figure>
            ) : null}

            <div className="public-article-layout">
              <div className="public-article-body">
                {article.translation.body.split(/\n\s*\n/).map((paragraph, index) => (
                  <p key={`${article.id}-${index}`}>{paragraph}</p>
                ))}
              </div>
              <aside className="public-article-aside">
                <div>
                  <small>{copy.category}</small>
                  <strong>{categoryName}</strong>
                </div>
                {article.tags.length > 0 ? (
                  <div>
                    <small>{copy.topics}</small>
                    <div className="public-article-tags">
                      {article.tags.map((tag) => (
                        <Link href={`/journal?lang=${locale}&tag=${tag.slug}`} key={tag.id}>
                          {locale === "ru" ? tag.nameRu : tag.nameKk}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </article>

          <section className="public-article-end">
            <span>СМУ</span>
            <div>
              <h2>{copy.endTitle}</h2>
              <p>{copy.endText}</p>
            </div>
            <Link href={`/journal?lang=${locale}`}>{copy.allMaterials}</Link>
          </section>
        </div>
      </main>
      <footer className="journal-footer">
        <span>© {new Date().getFullYear()} Совет молодых учёных</span>
        <Link href={`/journal?lang=${locale}`}>{copy.allMaterials}</Link>
      </footer>
    </>
  );
}

function isArticleLocale(value: string): value is ArticleLocale {
  return value === "ru" || value === "kk";
}

const typeLabelsKk = {
  article: "Мақала",
  news: "Жаңалық",
  interview: "Сұхбат",
  announcement: "Хабарландыру",
} as const;

const detailCopy = {
  ru: {
    breadcrumbs: "Навигация по журналу",
    back: "Журнал",
    minutes: "мин чтения",
    category: "Категория",
    topics: "Темы",
    endTitle: "Наука становится ближе",
    endText: "Следите за исследованиями и инициативами молодых учёных Актюбинской области.",
    allMaterials: "Все материалы",
  },
  kk: {
    breadcrumbs: "Журнал навигациясы",
    back: "Журнал",
    minutes: "мин оқу",
    category: "Санат",
    topics: "Тақырыптар",
    endTitle: "Ғылым жақындай түседі",
    endText: "Ақтөбе облысының жас ғалымдарының зерттеулері мен бастамаларын қадағалаңыз.",
    allMaterials: "Барлық материалдар",
  },
} as const;
