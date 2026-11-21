import Link from "next/link";
import { ArrowUpRight, BookOpen, ExternalLink, FileText } from "lucide-react";
import { PublicationService } from "@/server/services/publication.service";
import { publicationTypeLabels } from "@/types/domain/publication";
import type { ArticleLocale } from "@/types/domain/article";
import type { PublicPublication } from "@/types/domain/publication";

const titles = {
  ru: "Научные публикации",
  kk: "Ғылыми жарияланымдар",
  en: "Scientific publications",
};

const moreLabels = {
  ru: "Подробнее",
  kk: "Толығырақ",
  en: "Details",
};

export function PublicationAuthors({ item }: { item: PublicPublication }) {
  const authors = item.authors?.length
    ? item.authors
    : [{ scientistId: item.scientistId, name: item.scientistName, href: item.scientistHref, affiliation: "" }];

  return (
    <ul className="publication-authors">
      {authors.map((a, i) => (
        <li key={a.scientistId ?? i}>
          {a.href ? (
            <Link href={a.href} className="publication-author-link">
              {a.name}
            </Link>
          ) : (
            <span className="publication-external-author">{a.name}</span>
          )}
          {a.affiliation ? <small className="publication-author-affil"> ({a.affiliation})</small> : null}
          {i < authors.length - 1 ? <span className="publication-author-sep">, </span> : null}
        </li>
      ))}
    </ul>
  );
}

export function PublicPublicationCard({
  item,
  locale,
}: {
  item: PublicPublication;
  locale: ArticleLocale;
}) {
  const detailHref = `/${locale}/publications/${item.id}`;
  const typeLabel = publicationTypeLabels[locale]?.[item.publicationType] ?? item.publicationType;

  return (
    <article className="public-article-card publication-public-card" key={item.id}>
      <div className="public-card-content">
        <div className="public-card-meta publication-card-top-meta">
          <span className="publication-type-pill">{typeLabel}</span>
          <span className="publication-year-pill">{item.year}</span>
        </div>

        <h2 className="publication-card-heading">
          <Link href={detailHref}>{item.title}</Link>
        </h2>

        <div className="publication-card-journal">
          <BookOpen size={14} aria-hidden="true" />
          <span>{item.journal}</span>
        </div>

        <div className="publication-card-authors-wrap">
          <PublicationAuthors item={item} />
        </div>

        {item.summary ? (
          <p
            className="public-card-excerpt"
            style={{
              margin: "8px 0 0",
              fontSize: "13px",
              color: "#64748b",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.summary}
          </p>
        ) : null}

        <div className="publication-card-footer">
          <div className="publication-card-links">
            {item.fileUrl ? (
              <a
                href={item.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="publication-badge-link"
                title="PDF документ"
                style={{ color: "#e11d48", borderColor: "#fecdd3", background: "#fff1f2" }}
              >
                <FileText size={11} aria-hidden="true" />
                <span>PDF</span>
              </a>
            ) : null}
            {item.doi ? (
              <a
                href={`https://doi.org/${item.doi}`}
                target="_blank"
                rel="noreferrer"
                className="publication-badge-link"
                title={`DOI: ${item.doi}`}
              >
                <span>DOI</span>
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            ) : null}
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="publication-badge-link"
                title="Перейти к публикации"
              >
                <span>Источник</span>
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            ) : null}
          </div>

          <Link href={detailHref} className="public-card-link">
            <span>{moreLabels[locale]}</span>
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function PublicationList({
  publications,
  locale,
}: {
  publications: PublicPublication[];
  locale: ArticleLocale;
}) {
  if (!publications.length) return null;
  return (
    <section className="public-relations publication-relations-section">
      <h2>{titles[locale]}</h2>
      <div className="public-article-grid publication-compact-grid">
        {publications.map((item) => (
          <PublicPublicationCard key={item.id} item={item} locale={locale} />
        ))}
      </div>
    </section>
  );
}

export async function ScientistPublications({ id, locale }: { id: string; locale: ArticleLocale }) {
  return <PublicationList publications={await new PublicationService().listPublic(locale, null, id)} locale={locale} />;
}

export async function WorkPublications({ id, locale }: { id: string; locale: ArticleLocale }) {
  return <PublicationList publications={await new PublicationService().listPublicByWork(locale, id)} locale={locale} />;
}
