import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { articleTypeLabel } from "@/lib/articles/presentation";
import { ArticleCredits } from "@/components/articles/ArticleCredits";
import type {
  ArticleLocale,
  PublicArticleCard as PublicArticleCardType,
} from "@/types/domain/article";

export function PublicArticleCard({
  article,
  locale,
  featured = false,
}: {
  article: PublicArticleCardType;
  locale: ArticleLocale;
  featured?: boolean;
}) {
  const categoryName = article.category
    ? locale === "ru"
      ? article.category.nameRu
      : article.category.nameKk
    : null;
  const date = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(article.publishedAt));
  const alt = article.cover
    ? locale === "ru"
      ? article.cover.altRu
      : article.cover.altKk
    : null;

  return (
    <article className={`public-article-card${featured ? " is-featured" : ""}`}>
      <Link
        className="public-card-cover"
        href={`/${locale}/journal/${article.translation.slug}`}
        aria-label={article.translation.title}
      >
        {article.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.cover.url} alt={alt ?? ""} />
        ) : (
          <span className="public-card-placeholder">СМУ</span>
        )}
      </Link>
      <div className="public-card-content">
        <div className="public-card-meta">
          <span>{categoryName ?? articleTypeLabel(article.contentType, article.contentTypeItem, locale)}</span>
          <time dateTime={article.publishedAt}>{date}</time>
        </div>
        <h2>
          <Link href={`/${locale}/journal/${article.translation.slug}`}>
            {article.translation.title}
          </Link>
        </h2>
        <p>{article.translation.excerpt}</p>
        <ArticleCredits authors={article.authors} locale={locale} />
        <Link className="public-card-link" href={`/${locale}/journal/${article.translation.slug}`}>
          {locale === "ru" ? "Читать материал" : "Материалды оқу"}
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
