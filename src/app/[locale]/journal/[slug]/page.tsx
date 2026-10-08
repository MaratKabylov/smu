import { pageAlternates, openGraphLocale, noIndex } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/JsonLd";
import { articleJsonLd } from "@/lib/seo/structured-data";
import { appendPublicQuery, isLocale, type PublicQuery } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, Languages } from "lucide-react";
import Link from "next/link";
import { PublicArticleRelations } from "@/components/articles/PublicArticleRelations";
import { notFound, permanentRedirect } from "next/navigation";
import { JournalHeader } from "@/components/journal/JournalHeader";
import { RichTextContent } from "@/components/articles/RichTextContent";
import { getArticleImages } from "@/server/repositories/article-images.repository";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { articleTypeLabel } from "@/lib/articles/presentation";
import { ArticleCredits } from "@/components/articles/ArticleCredits";
import { getPublishedArticleBySlug, PublicArticleService } from "@/server/services/public-article.service";
import type { ArticleLocale } from "@/types/domain/article";

type PublicArticlePageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<PublicQuery>;
};

export async function generateMetadata({
  params,
}: PublicArticlePageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  if (!isArticleLocale(rawLocale)) return { title: "Материал не найден", robots: noIndex };
  const article = await getPublishedArticleBySlug(rawLocale, slug);
  if (!article) return { title: "Материал не найден", robots: noIndex };

  const title = article.translation.seoTitle ?? article.translation.title;
  const description =
    article.translation.seoDescription ?? article.translation.excerpt;
  return {
    title,
    description,
    alternates: pageAlternates(rawLocale, "journal", [article.translation, ...article.alternateTranslations]),
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: article.publishedAt,
      url: pageAlternates(rawLocale, "journal", [article.translation, ...article.alternateTranslations]).canonical,
      locale: openGraphLocale[rawLocale],
      images: article.cover ? [{ url: article.cover.url }] : undefined,
    },
  };
}

export default async function PublicArticlePage({ params, searchParams }: PublicArticlePageProps) {
  const { locale: rawLocale, slug } = await params;
  if (!isArticleLocale(rawLocale)) notFound();
  const locale = rawLocale;
  const article = await getPublishedArticleBySlug(locale, slug);
  if (!article) {
    const currentSlug = await new PublicArticleService().getSlugRedirect(locale, slug);
    if (currentSlug) permanentRedirect(appendPublicQuery(`/${locale}/journal/${currentSlug}`, await searchParams));
    notFound();
  }

  const copy = getDictionary(locale).journalDetail;
  const images = await getArticleImages(createPublicSupabaseClient(), article.translation.contentJson, locale);
  const categoryName = article.category
    ? locale === "ru"
      ? article.category.nameRu
      : locale === "en" ? article.category.nameEn ?? article.category.nameRu : article.category.nameKk
    : articleTypeLabel(article.contentType, article.contentTypeItem, locale);
  const date = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : locale === "en" ? "en-GB" : "kk-KZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(article.publishedAt));
  const wordCount = article.translation.body.trim().split(/\s+/).length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 180));
  const coverAlt = article.cover
    ? locale === "ru"
      ? article.cover.altRu
      : locale === "en" ? article.cover.altEn ?? article.cover.altRu : article.cover.altKk
    : null;
  const coverCaption = article.cover
    ? locale === "ru"
      ? article.cover.captionRu
      : locale === "en" ? article.cover.captionEn ?? article.cover.captionRu : article.cover.captionKk
    : null;

  return (
    <>
      <JsonLd data={articleJsonLd(article)} />
      <JournalHeader locale={locale} translations={[article.translation, ...article.alternateTranslations]} />
      <main className="public-article-page" lang={locale}>
        <div className="public-article-shell">
          <nav className="public-breadcrumbs" aria-label={copy.breadcrumbs}>
            <Link href={`/${locale}/journal`}><ArrowLeft aria-hidden="true" />{copy.back}</Link>
            <span>/</span>
            <span>{categoryName}</span>
          </nav>

          <article className="public-article">
            <header className="public-article-header">
              <div className="public-article-kicker">
                <Link href={`/${locale}/journal?category=${article.category?.slug ?? ""}`}>{categoryName}</Link>
                <span>{articleTypeLabel(article.contentType, article.contentTypeItem, locale)} · {locale.toUpperCase()}</span>
              </div>
              <h1>{article.translation.title}</h1>
              <p className="public-article-lead">{article.translation.excerpt}</p>
              <ArticleCredits authors={article.authors} locale={locale} />
              <div className="public-article-byline">
                <span><CalendarDays aria-hidden="true" />{date}</span>
                <span>{readingMinutes} {copy.minutes}</span>
                {article.alternateTranslations.map(item => (
                  <Link key={item.locale} href={`/${item.locale}/journal/${item.slug}`}>
                    <Languages aria-hidden="true" />
                    {item.locale === "ru" ? "Читать по-русски" : item.locale === "en" ? "Read in English" : "Қазақша оқу"}
                  </Link>
                ))}
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
                <RichTextContent content={article.translation.contentJson} body={article.translation.body} images={images} />
              </div>
              <aside className="public-article-aside">
                <div>
                  <small>{copy.category}</small>
                  <div className="public-article-tags">{article.categories.map(category => <Link key={category.id} href={`/${locale}/journal?category=${category.slug}`}>{locale === "en" ? category.nameEn ?? category.nameRu : locale === "ru" ? category.nameRu : category.nameKk}</Link>)}</div>
                  {!article.categories.length ? <strong>{categoryName}</strong> : null}
                </div>
                {article.tags.length > 0 ? (
                  <div>
                    <small>{copy.topics}</small>
                    <div className="public-article-tags">
                      {article.tags.map((tag) => (
                        <Link href={`/${locale}/journal?tag=${tag.slug}`} key={tag.id}>
                          {locale === "en" ? tag.nameEn ?? tag.nameRu : locale === "ru" ? tag.nameRu : tag.nameKk}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
            <ArticleCredits authors={article.authors} locale={locale} detailed />
          </article>

          <PublicArticleRelations id={article.id} locale={locale} />
          <section className="public-article-end">
            <span>СМУ</span>
            <div>
              <h2>{copy.endTitle}</h2>
              <p>{copy.endText}</p>
            </div>
            <Link href={`/${locale}/journal`}>{copy.allMaterials}</Link>
          </section>
        </div>
      </main>
      <footer className="journal-footer">
        <span>© {new Date().getFullYear()} {getDictionary(locale).common.footer}</span>
        <Link href={`/${locale}/journal`}>{copy.allMaterials}</Link>
      </footer>
    </>
  );
}

function isArticleLocale(value: string): value is ArticleLocale {
  return isLocale(value);
}
