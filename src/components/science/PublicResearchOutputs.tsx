import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  ExternalLink,
  FileText,
  FlaskConical,
  Layers,
  Lock,
  Tag,
  Unlock,
} from "lucide-react";
import { ResearchOutputService } from "@/server/services/research-output.service";
import { researchOutputLabels } from "@/types/domain/research-output";
import type { ArticleLocale } from "@/types/domain/article";
import type { PublicResearchOutputItem } from "@/types/domain/research-output";

const moreLabels = {
  ru: "Подробнее",
  kk: "Толығырақ",
  en: "Details",
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

export function PublicResearchOutputCard({
  item,
  locale,
}: {
  item: PublicResearchOutputItem;
  locale: ArticleLocale;
}) {
  const detailHref = `/${locale}/results/${item.id}`;
  const kindLabel = researchOutputLabels[locale]?.[item.kind] ?? item.kind;
  const publicFilesCount = item.files.length;
  const works = item.works ?? [];

  return (
    <article className="public-article-card publication-public-card" key={item.id}>
      <div className="public-card-content">
        <div className="public-card-meta publication-card-top-meta">
          <span className="publication-type-pill">{kindLabel}</span>
          <span className="publication-year-pill">v{item.versionLabel}</span>
        </div>

        <h2 className="publication-card-heading">
          <Link href={detailHref}>{item.title}</Link>
        </h2>

        {works.length ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12.5px",
              color: "#64748b",
              marginTop: "4px",
              flexWrap: "wrap",
            }}
          >
            <Layers size={13} aria-hidden="true" style={{ color: "var(--forest-bright)", flexShrink: 0 }} />
            <span>
              {works.map((w, idx) => (
                <span key={w.id}>
                  <Link
                    href={`/${locale}/${w.kind === "project" ? "projects" : "research"}/${w.id}`}
                    style={{ color: "#334155", textDecoration: "underline" }}
                  >
                    {w.title}
                  </Link>
                  {idx < works.length - 1 ? ", " : ""}
                </span>
              ))}
            </span>
          </div>
        ) : null}

        {item.description ? (
          <p
            className="public-card-excerpt"
            style={{
              margin: "10px 0 0",
              fontSize: "13.5px",
              color: "#64748b",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.description}
          </p>
        ) : null}

        <div className="publication-card-footer" style={{ marginTop: "16px" }}>
          <div className="publication-card-links">
            {publicFilesCount > 0 ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: "#16a34a",
                  background: "#dcfce7",
                  padding: "3px 8px",
                  borderRadius: "6px",
                }}
              >
                <Download size={12} aria-hidden="true" />
                <span>
                  {publicFilesCount}{" "}
                  {locale === "ru"
                    ? publicFilesCount === 1
                      ? "файл"
                      : "файла"
                    : locale === "kk"
                    ? "файл"
                    : "files"}
                </span>
              </span>
            ) : null}

            {item.license ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  color: "#64748b",
                  background: "#f1f5f9",
                  padding: "3px 8px",
                  borderRadius: "6px",
                }}
              >
                <Tag size={10} aria-hidden="true" />
                <span>{item.license}</span>
              </span>
            ) : null}
          </div>

          <Link href={detailHref} className="publication-details-btn">
            <span>{moreLabels[locale]}</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function PublicResearchOutputDetail({
  item,
  locale,
}: {
  item: PublicResearchOutputItem;
  locale: ArticleLocale;
}) {
  const kindLabel = researchOutputLabels[locale]?.[item.kind] ?? item.kind;
  const works = item.works ?? [];
  const copy = {
    ru: {
      back: "Научные результаты",
      description: "Описание научного результата",
      files: "Файлы и материалы для скачивания",
      download: "Скачать",
      works: "Связанные исследования и проекты",
      license: "Условия использования и лицензия",
      external: "Открыть внешний ресурс / репозиторий",
      version: "Версия",
      updatedAt: "Дата обновления",
      catalog: "Вернуться в каталог результатов",
    },
    kk: {
      back: "Ғылыми нәтижелер",
      description: "Ғылыми нәтиженің сипаттамасы",
      files: "Жүктеп алынатын файлдар мен материалдар",
      download: "Жүктеп алу",
      works: "Байланысты зерттеулер мен жобалар",
      license: "Пайдалану шарттары мен лицензия",
      external: "Сыртқы ресурсты / репозиторийді ашу",
      version: "Нұсқа",
      updatedAt: "Жаңартылған күні",
      catalog: "Нәтижелер каталогына оралу",
    },
    en: {
      back: "Research outputs",
      description: "Description of research output",
      files: "Downloadable files and datasets",
      download: "Download",
      works: "Related research and projects",
      license: "Terms of use and license",
      external: "Open external repository / resource",
      version: "Version",
      updatedAt: "Last updated",
      catalog: "Return to outputs catalog",
    },
  }[locale];

  return (
    <main className="public-article-page">
      <div className="public-article-shell">
        <nav className="public-breadcrumbs">
          <Link
            href={`/${locale}/results`}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>{copy.back}</span>
          </Link>
        </nav>

        <header className="public-article-header">
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" }}>
            <span className="stage-badge">{kindLabel}</span>
            <span className="stage-badge" style={{ background: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd" }}>
              {copy.version} {item.versionLabel}
            </span>
          </div>
          <h1>{item.title}</h1>
          {item.license ? (
            <p className="public-article-lead" style={{ fontSize: "14.5px" }}>
              {copy.license}: <strong>{item.license}</strong>
            </p>
          ) : null}
        </header>

        <div className="public-article-layout">
          <article className="science-work-body">
            {/* DESCRIPTION */}
            <section style={{ marginBottom: "28px" }}>
              <h2 style={{ fontSize: "22px", marginBottom: "14px" }}>{copy.description}</h2>
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
                {item.description}
              </div>
            </section>

            {/* EXTERNAL LINK IF PRESENT */}
            {item.externalUrl ? (
              <section style={{ marginBottom: "28px" }}>
                <a
                  href={item.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="primary-button"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  <span>{copy.external}</span>
                  <ExternalLink size={15} aria-hidden="true" />
                </a>
              </section>
            ) : null}

            {/* DOWNLOADABLE FILES */}
            {item.files.length ? (
              <section style={{ marginBottom: "32px" }}>
                <h2 style={{ fontSize: "22px", marginBottom: "14px" }}>{copy.files}</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {item.files.map((file) => (
                    <div
                      key={file.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 18px",
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <FileText size={22} style={{ color: "var(--forest-bright)", flexShrink: 0 }} aria-hidden="true" />
                        <div>
                          <strong style={{ display: "block", fontSize: "14px", color: "#0f172a" }}>
                            {file.name}
                          </strong>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            {formatSize(file.size)} · {file.mimeType}
                          </span>
                        </div>
                      </div>

                      <a
                        href={`/api/results/${item.id}/files/${file.id}?version=${item.version}`}
                        className="secondary-button"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" }}
                      >
                        <Download size={14} aria-hidden="true" />
                        <span>{copy.download}</span>
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* RELATED WORKS */}
            {works.length ? (
              <section style={{ marginBottom: "28px" }}>
                <h2 style={{ fontSize: "22px", marginBottom: "14px" }}>{copy.works}</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {works.map((work) => (
                    <div
                      key={work.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                      }}
                    >
                      <span className="stage-badge" style={{ fontSize: "11px" }}>
                        {work.kind === "project" ? (locale === "ru" ? "Проект" : locale === "kk" ? "Жоба" : "Project") : (locale === "ru" ? "Исследование" : locale === "kk" ? "Зерттеу" : "Research")}
                      </span>
                      <Link
                        href={`/${locale}/${work.kind === "project" ? "projects" : "research"}/${work.id}`}
                        style={{ fontWeight: 600, fontSize: "14px", color: "var(--forest-bright)", flex: 1 }}
                      >
                        {work.title}
                      </Link>
                      <ArrowUpRight size={14} style={{ color: "#64748b" }} aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="science-return" style={{ marginTop: "40px" }}>
              <Link href={`/${locale}/results`}>{copy.catalog}</Link>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}

/**
 * Embedded research outputs section on research work / project detail pages
 */
export async function PublicResearchOutputs({
  workId,
  locale,
}: {
  workId: string;
  locale: ArticleLocale;
}) {
  const outputs = await new ResearchOutputService().publicByWork(locale, workId);
  if (!outputs.length) return null;

  const text = {
    ru: {
      title: "Научные результаты",
      version: "Версия",
      license: "Условия использования",
      download: "Скачать",
      external: "Открыть результат",
      details: "Подробнее о результате",
    },
    kk: {
      title: "Ғылыми нәтижелер",
      version: "Нұсқа",
      license: "Пайдалану шарттары",
      download: "Жүктеп алу",
      external: "Нәтижені ашу",
      details: "Нәтиже туралы толығырақ",
    },
    en: {
      title: "Research outputs",
      version: "Version",
      license: "Terms of use",
      download: "Download",
      external: "Open output",
      details: "Output details",
    },
  }[locale];

  return (
    <section className="science-work-body" id="results">
      <h2>{text.title}</h2>
      {outputs.map((o) => (
        <article key={o.id} style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
            <span className="stage-badge" style={{ fontSize: "11px" }}>
              {researchOutputLabels[locale][o.kind]}
            </span>
            <small style={{ color: "#64748b" }}>
              {text.version} {o.versionLabel}
            </small>
          </div>
          <h3 style={{ margin: "4px 0 10px" }}>
            <Link href={`/${locale}/results/${o.id}`} style={{ color: "inherit", textDecoration: "none" }}>
              {o.title}
            </Link>
          </h3>
          {o.description.split(/\n{2,}/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p style={{ fontSize: "13px", color: "#64748b" }}>
            {text.license}: <strong>{o.license}</strong>
          </p>
          {o.externalUrl ? (
            <p>
              <a href={o.externalUrl} rel="noreferrer" target="_blank" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <span>{text.external}</span>
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </p>
          ) : null}
          {o.files.length ? (
            <ul style={{ margin: "8px 0 12px 18px", padding: 0 }}>
              {o.files.map((f) => (
                <li key={f.id} style={{ margin: "4px 0" }}>
                  <a href={`/api/results/${o.id}/files/${f.id}?version=${o.version}`}>
                    {text.download}: {f.name}
                  </a>{" "}
                  ({Math.ceil(f.size / 1024)} KB)
                </li>
              ))}
            </ul>
          ) : null}
          <div style={{ marginTop: "10px" }}>
            <Link
              href={`/${locale}/results/${o.id}`}
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--forest-bright)",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span>{text.details}</span>
              <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}
