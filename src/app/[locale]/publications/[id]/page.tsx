import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, ArrowUpRight, BookOpen, Download, ExternalLink, FileText, Globe, Hash, Layers } from "lucide-react";
import { SeoService } from "@/server/services/seo.service";
import { absoluteUrl } from "@/lib/seo/site";
import { openGraphLocale } from "@/lib/seo/metadata";
import { PublicationAuthors } from "@/components/science/PublicPublications";
import { PublicationService } from "@/server/services/publication.service";
import { PublicHeader } from "@/components/i18n/PublicHeader";
import { RelatedArticles } from "@/components/articles/PublicArticleRelations";
import { publicationTypeLabels } from "@/types/domain/publication";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { ArticleLocale } from "@/types/domain/article";
import { isLocale } from "@/lib/i18n/locales";

type Props = { params: Promise<{ locale: string; id: string }> };

const publicationByLocale = cache(async (locale: ArticleLocale, id: string) => {
  const [publication] = await new PublicationService().listPublic(locale, id);
  const paths = await new SeoService().paths("publications", id);
  return { publication, paths };
});

async function detail(params: Props["params"]) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !z.uuid().safeParse(id).success) notFound();
  const { publication, paths } = await publicationByLocale(locale, id);
  if (!publication) notFound();
  return { publication, paths, locale: locale as ArticleLocale };
}

export async function generateMetadata({ params }: Props) {
  const { publication, paths, locale } = await detail(params);
  const canonical = absoluteUrl(`/${locale}/publications/${publication.id}`);
  return {
    title: publication.title,
    description: `${publication.journal}, ${publication.year}`,
    alternates: {
      canonical,
      languages: Object.fromEntries(Object.entries(paths).map(([l, path]) => [l, absoluteUrl(path)])),
      types: { "application/rss+xml": absoluteUrl(`/${locale}/feed.xml`) },
    },
    openGraph: {
      title: publication.title,
      url: canonical,
      locale: openGraphLocale[locale],
    },
  };
}

const sectionTitles = {
  ru: {
    back: "Научные публикации",
    abstract: "Аннотация / Abstract",
    journal: "Издание / Журнал",
    year: "Год издания",
    type: "Тип публикации",
    leadAuthor: "Основной автор",
    authors: "Авторский коллектив",
    source: "Первоисточник и ссылки",
    openPaper: "Открыть публикацию",
    doi: "Цифровой идентификатор DOI",
    pdfTitle: "Полный текст публикации (PDF)",
    readPdf: "Читать онлайн (PDF)",
    downloadPdf: "Скачать PDF",
    relatedWorks: "Связанные исследования и проекты",
    emptyWorks: "Связанные исследования не указаны.",
  },
  kk: {
    back: "Ғылыми жарияланымдар",
    abstract: "Аңдатпа / Abstract",
    journal: "Басылым / Журнал",
    year: "Шыққан жылы",
    type: "Жарияланым түрі",
    leadAuthor: "Негізгі автор",
    authors: "Авторлық ұжым",
    source: "Түпнұсқа және сілтемелер",
    openPaper: "Жарияланымды ашу",
    doi: "Сандық идентификатор DOI",
    pdfTitle: "Жарияланымның толық мәтіні (PDF)",
    readPdf: "Онлайн оқу (PDF)",
    downloadPdf: "PDF жүктеп алу",
    relatedWorks: "Байланысты зерттеулер мен жобалар",
    emptyWorks: "Байланысты зерттеулер көрсетілмеген.",
  },
  en: {
    back: "Scientific publications",
    abstract: "Abstract",
    journal: "Publisher / Journal",
    year: "Publication year",
    type: "Publication type",
    leadAuthor: "Lead author",
    authors: "Authors & Contributors",
    source: "Original source & links",
    openPaper: "Open publication",
    doi: "Digital Object Identifier (DOI)",
    pdfTitle: "Full text publication (PDF)",
    readPdf: "Read online (PDF)",
    downloadPdf: "Download PDF",
    relatedWorks: "Related research and projects",
    emptyWorks: "No related research linked.",
  },
};

export default async function Page({ params }: Props) {
  const { publication: item, locale, paths } = await detail(params);
  const copy = sectionTitles[locale];
  const typeName = publicationTypeLabels[locale][item.publicationType];

  return (
    <>
      <PublicHeader locale={locale} section="publications" paths={paths} />
      <main className="public-article-page">
        <div className="public-article-shell">
          <nav className="public-breadcrumbs">
            <Link href={`/${locale}/publications`} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <ArrowLeft size={14} aria-hidden="true" />
              <span>{copy.back}</span>
            </Link>
          </nav>

          <header className="public-article-header">
            <span className="stage-badge" style={{ marginBottom: "12px" }}>
              {typeName}
            </span>
            <h1>{item.title}</h1>
            <p className="public-article-lead">
              {item.journal} · {item.year}
            </p>
          </header>

          <div className="public-article-layout">
            <article className="science-work-body">
              {/* ABSTRACT SECTION */}
              {item.summary ? (
                <section style={{ marginBottom: "28px" }}>
                  <h2 style={{ fontSize: "22px", marginBottom: "14px" }}>{copy.abstract}</h2>
                  <div
                    style={{
                      padding: "18px 22px",
                      background: "#f8fafc",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      lineHeight: 1.65,
                      fontSize: "15px",
                      color: "#334155",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {item.summary}
                  </div>
                </section>
              ) : null}

              {/* PDF FULLTEXT PUBLICATION (OPTION A) */}
              {item.fileUrl ? (
                <section
                  style={{
                    marginBottom: "32px",
                    padding: "20px 24px",
                    background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)",
                    borderRadius: "12px",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "10px",
                          background: "#ffe4e6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#e11d48",
                          flexShrink: 0,
                        }}
                      >
                        <FileText size={26} aria-hidden="true" />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>{copy.pdfTitle}</h3>
                        <p style={{ margin: "3px 0 0", fontSize: "13px", color: "#64748b" }}>
                          {item.fileName ?? "publication-fulltext.pdf"}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-button"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 16px" }}
                      >
                        <BookOpen size={15} aria-hidden="true" />
                        <span>{copy.readPdf}</span>
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                      <a
                        href={`${item.fileUrl}?download=1`}
                        download={item.fileName ?? "publication.pdf"}
                        className="primary-button"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 18px" }}
                      >
                        <Download size={15} aria-hidden="true" />
                        <span>{copy.downloadPdf}</span>
                      </a>
                    </div>
                  </div>
                </section>
              ) : null}

              {/* AUTHORS SECTION */}
              <section style={{ marginBottom: "28px" }}>
                <h2 style={{ fontSize: "22px", marginBottom: "14px" }}>{copy.authors}</h2>
                <div style={{ padding: "16px 20px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <PublicationAuthors item={item} />
                </div>
              </section>

              {/* SOURCE AND EXTERNAL ACCESS */}
              {(item.doi || item.url) ? (
                <section style={{ marginBottom: "32px" }}>
                  <h2 style={{ fontSize: "22px", marginBottom: "14px" }}>{copy.source}</h2>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                    {item.doi ? (
                      <a
                        href={`https://doi.org/${item.doi}`}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-button"
                        style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 16px" }}
                      >
                        <Hash size={15} aria-hidden="true" />
                        <span>DOI: {item.doi}</span>
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    ) : null}
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="primary-button"
                        style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 18px" }}
                      >
                        <Globe size={15} aria-hidden="true" />
                        <span>{copy.openPaper}</span>
                        <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {/* RELATED WORKS */}
              {item.works?.length ? (
                <section className="public-relations" style={{ marginTop: "32px" }}>
                  <h2 style={{ fontSize: "22px" }}>{copy.relatedWorks}</h2>
                  <ul>
                    {item.works.map((work) => (
                      <li key={work.id}>
                        <Link href={work.href} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <span>{work.title}</span>
                          <ArrowUpRight size={14} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* RELATED EDITORIAL ARTICLES */}
              <div style={{ marginTop: "40px" }}>
                <RelatedArticles kind="publication" id={item.id} locale={locale} />
              </div>
            </article>

            {/* SIDEBAR ASIDE */}
            <aside className="public-article-aside science-work-aside">
              <div>
                <small>{copy.journal}</small>
                <span>{item.journal}</span>
              </div>
              <div>
                <small>{copy.year}</small>
                <span>{item.year}</span>
              </div>
              <div>
                <small>{copy.type}</small>
                <span>{typeName}</span>
              </div>
              <div>
                <small>{copy.leadAuthor}</small>
                <Link href={item.scientistHref} style={{ fontWeight: 600 }}>
                  {item.scientistName}
                </Link>
              </div>

              {item.doi ? (
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "8px" }}>
                  <small>DOI</small>
                  <a
                    href={`https://doi.org/${item.doi}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px" }}
                  >
                    <span>{item.doi}</span>
                    <ExternalLink size={11} aria-hidden="true" />
                  </a>
                </div>
              ) : null}

              {item.fileUrl ? (
                <a
                  href={`${item.fileUrl}?download=1`}
                  download={item.fileName ?? "publication.pdf"}
                  className="primary-button"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", width: "100%", marginTop: "12px" }}
                >
                  <Download size={13} aria-hidden="true" />
                  <span>{copy.downloadPdf}</span>
                </a>
              ) : null}

              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="secondary-button"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", width: "100%", marginTop: "12px" }}
                >
                  <span>{copy.openPaper}</span>
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              ) : null}
            </aside>
          </div>
        </div>
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
