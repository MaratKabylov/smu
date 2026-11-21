"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  ExternalLink,
  FileCheck,
  FileText,
  Globe,
  Hash,
  Info,
  Layers,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { CustomSelect } from "@/components/articles/CustomSelect";
import { PublicationScientistSelect } from "@/components/science/PublicationScientistSelect";
import { PublicationRelationsEditor } from "@/components/science/PublicationRelationsEditor";
import { generateSlug } from "@/lib/articles/slug";
import type { MediaAsset } from "@/types/domain/media";
import {
  publicationTypes,
  publicationTypeLabels,
  type Publication,
  type PublicationType,
} from "@/types/domain/publication";
import type { ArticleRelationOption } from "@/types/domain/article-relations";

type Props = {
  action: (formData: FormData) => Promise<void>;
  publication?: Publication | null;
  media?: MediaAsset[];
  scientistOptions: ArticleRelationOption[];
  authorOptions: ArticleRelationOption[];
  workOptions: ArticleRelationOption[];
  submitLabel?: string;
};

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  published: "Опубликована",
  archived: "В архиве",
};

export function PublicationForm({
  action,
  publication,
  media = [],
  scientistOptions,
  authorOptions,
  workOptions,
  submitLabel = publication ? "Сохранить публикацию" : "Создать публикацию",
}: Props) {
  const mediaSearchId = useId();

  const [activeLocale, setActiveLocale] = useState<"Ru" | "Kk" | "En">("Ru");
  const [pending, setPending] = useState(false);

  // Translations
  const ru = publication?.translations?.find((item) => item.locale === "ru");
  const kk = publication?.translations?.find((item) => item.locale === "kk");
  const en = publication?.translations?.find((item) => item.locale === "en");

  const [titles, setTitles] = useState({
    Ru: ru?.title ?? publication?.title ?? "",
    Kk: kk?.title ?? "",
    En: en?.title ?? "",
  });

  const [slugs, setSlugs] = useState({
    Ru: ru?.slug ?? "",
    Kk: kk?.slug ?? "",
    En: en?.slug ?? "",
  });

  const [isSlugTouched, setIsSlugTouched] = useState({
    Ru: Boolean(ru?.slug),
    Kk: Boolean(kk?.slug),
    En: Boolean(en?.slug),
  });

  const [summaries, setSummaries] = useState({
    Ru: ru?.summary ?? "",
    Kk: kk?.summary ?? "",
    En: en?.summary ?? "",
  });

  // Attached PDF Document
  const [fileMediaId, setFileMediaId] = useState<string>(() => publication?.fileMediaId ?? "");
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaSearchQuery, setMediaSearchQuery] = useState("");

  const selectedFile = media.find((m) => m.id === fileMediaId);

  const filteredMedia = media.filter(
    (asset) =>
      asset.status === "ready" &&
      !asset.deletedAt &&
      (asset.mimeType === "application/pdf" || asset.fileName.toLowerCase().endsWith(".pdf")) &&
      (!mediaSearchQuery.trim() ||
        asset.fileName.toLowerCase().includes(mediaSearchQuery.toLowerCase()) ||
        (asset.altRu && asset.altRu.toLowerCase().includes(mediaSearchQuery.toLowerCase())))
  );

  // Bibliographic metadata
  const [currentStatus, setCurrentStatus] = useState<string>(() => publication?.status ?? "draft");
  const [publicationType, setPublicationType] = useState<string>(() => publication?.publicationType ?? "article");
  const [journalValue, setJournalValue] = useState<string>(() => publication?.journal ?? "");
  const [yearValue, setYearValue] = useState<string | number>(() => publication?.year ?? new Date().getFullYear());
  const [doiValue, setDoiValue] = useState<string>(() => publication?.doi ?? "");
  const [urlValue, setUrlValue] = useState<string>(() => publication?.url ?? "");

  const handleTitleChange = (locale: "Ru" | "Kk" | "En", val: string) => {
    setTitles((prev) => ({ ...prev, [locale]: val }));
    if (!isSlugTouched[locale] && val.trim()) {
      setSlugs((prev) => ({ ...prev, [locale]: generateSlug(val) }));
    }
  };

  const handleSlugChange = (locale: "Ru" | "Kk" | "En", val: string) => {
    setIsSlugTouched((prev) => ({ ...prev, [locale]: true }));
    setSlugs((prev) => ({ ...prev, [locale]: val }));
  };

  const handleRegenerateSlug = (locale: "Ru" | "Kk" | "En") => {
    const title = titles[locale];
    if (title.trim()) {
      setSlugs((prev) => ({ ...prev, [locale]: generateSlug(title) }));
      setIsSlugTouched((prev) => ({ ...prev, [locale]: true }));
    }
  };

  const typeOptions = publicationTypes.map((type) => ({
    value: type,
    label: publicationTypeLabels.ru[type],
  }));

  const statusOptions = [
    { value: "draft", label: "Черновик" },
    { value: "published", label: "Опубликована" },
    { value: "archived", label: "В архиве" },
  ];

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const mainTitle = titles.Ru.trim() || titles.Kk.trim() || titles.En.trim();
    if (!mainTitle || mainTitle.length < 3) {
      event.preventDefault();
      alert("Пожалуйста, укажите название публикации (от 3 символов).");
      setActiveLocale("Ru");
      return;
    }

    if (!journalValue.trim() || journalValue.trim().length < 2) {
      event.preventDefault();
      alert("Пожалуйста, укажите журнал или издание (от 2 символов).");
      return;
    }

    const form = event.currentTarget;
    const scientistSelect = form.elements.namedItem("scientistId") as HTMLSelectElement | null;
    if (!scientistSelect?.value) {
      event.preventDefault();
      alert("Пожалуйста, выберите основного автора из каталога исследователей.");
      scientistSelect?.focus();
      return;
    }

    setPending(true);
  };

  return (
    <form
      action={action}
      onSubmit={handleSubmit}
      className="article-form wp-editor-form"
      key={publication?.updatedAt ?? "new"}
    >
      {publication ? (
        <>
          <input type="hidden" name="id" value={publication.id} />
          <input type="hidden" name="expectedUpdatedAt" value={publication.updatedAt} />
        </>
      ) : null}

      {/* Main fallback title for backwards compatibility */}
      <input type="hidden" name="title" value={titles.Ru || titles.Kk || titles.En} />
      <input type="hidden" name="fileMediaId" value={fileMediaId} />
      <input type="hidden" name="status" value={currentStatus} />
      <input type="hidden" name="publicationType" value={publicationType} />

      {/* TOPBAR: Language Tabs & Submit */}
      <div className="wp-editor-topbar">
        <div className="wp-topbar-left">
          <div className="wp-lang-tabs" role="tablist" aria-label="Языковые версии">
            <button
              type="button"
              role="tab"
              disabled={pending}
              aria-selected={activeLocale === "Ru"}
              className={`wp-lang-tab ${activeLocale === "Ru" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("Ru")}
            >
              <span className={`wp-tab-dot ${titles.Ru.trim() ? "is-filled" : ""}`} />
              Русский
            </button>
            <button
              type="button"
              role="tab"
              disabled={pending}
              aria-selected={activeLocale === "Kk"}
              className={`wp-lang-tab ${activeLocale === "Kk" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("Kk")}
            >
              <span className={`wp-tab-dot ${titles.Kk.trim() ? "is-filled" : ""}`} />
              Қазақша
            </button>
            <button
              type="button"
              role="tab"
              disabled={pending}
              aria-selected={activeLocale === "En"}
              className={`wp-lang-tab ${activeLocale === "En" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("En")}
            >
              <span className={`wp-tab-dot ${titles.En.trim() ? "is-filled" : ""}`} />
              English <small className="wp-tab-optional">необяз.</small>
            </button>
          </div>
        </div>

        <div className="wp-topbar-right">
          <button type="submit" className="primary-button wp-submit-btn" disabled={pending}>
            <Save size={16} aria-hidden="true" />
            <span>{pending ? "Сохранение…" : submitLabel}</span>
          </button>
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="wp-editor-workspace">
        {/* MAIN COLUMN */}
        <div className="wp-editor-main">
          {/* RU LOCALE PANE */}
          <div style={{ display: activeLocale === "Ru" ? "block" : "none" }}>
            <div className="wp-title-section">
              <label className="wp-field-label" htmlFor="publication-title-ru">
                Название публикации (RU) <span className="required-star">*</span>
              </label>
              <input
                id="publication-title-ru"
                name="titleRu"
                value={titles.Ru}
                maxLength={500}
                className="wp-title-input"
                placeholder="Например: Клинические и генетические маркеры сахарного диабета..."
                disabled={pending}
                onChange={(e) => handleTitleChange("Ru", e.target.value)}
              />
              <p className="wp-field-hint" style={{ marginTop: "6px" }}>
                Полное библиографическое название публикации на русском языке.
              </p>
            </div>

            <div className="wp-permalink-bar">
              <span className="wp-permalink-prefix">Постоянная ссылка: smu.kz/ru/publications/</span>
              <input
                name="slugRu"
                value={slugs.Ru}
                maxLength={160}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="latin-slug-url"
                className="wp-permalink-input"
                disabled={pending}
                onChange={(e) => handleSlugChange("Ru", e.target.value)}
              />
              {titles.Ru.trim() ? (
                <button
                  type="button"
                  className="wp-permalink-refresh-btn"
                  onClick={() => handleRegenerateSlug("Ru")}
                  title="Сгенерировать ссылку из названия"
                  disabled={pending}
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  <span>Обновить</span>
                </button>
              ) : null}
            </div>

            <div className="wp-excerpt-section" style={{ marginTop: "16px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="wp-field-label">Аннотация / Abstract (RU)</span>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>{summaries.Ru.length} / 5000</span>
                </div>
                <textarea
                  name="summaryRu"
                  value={summaries.Ru}
                  maxLength={5000}
                  rows={4}
                  className="wp-excerpt-textarea"
                  disabled={pending}
                  placeholder="Краткое содержание публикации, цель исследования, методы и основные выводы..."
                  onChange={(e) => setSummaries((prev) => ({ ...prev, Ru: e.target.value }))}
                />
              </label>
            </div>

            {/* SEO Snippet Preview */}
            <div className="wp-seo-preview" style={{ marginTop: "16px", padding: "14px 16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
              <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                Предпросмотр в поисковой выдаче Google
              </span>
              <div style={{ fontSize: "12px", color: "#202124", marginBottom: "2px" }}>
                smu.kz › ru › publications › {slugs.Ru || "latin-slug-url"}
              </div>
              <div style={{ fontSize: "16px", color: "#1a0dab", fontWeight: 500, lineHeight: 1.3, marginBottom: "4px" }}>
                {titles.Ru || "Название публикации в каталоге"} — SMU Наука
              </div>
              <div style={{ fontSize: "13px", color: "#4d5156", lineHeight: 1.4 }}>
                {summaries.Ru ? summaries.Ru.slice(0, 160) + (summaries.Ru.length > 160 ? "…" : "") : "Аннотация научной статьи с кратким изложением целей, методологии и полученных результатов."}
              </div>
            </div>
          </div>

          {/* KK LOCALE PANE */}
          <div style={{ display: activeLocale === "Kk" ? "block" : "none" }}>
            <div className="wp-title-section">
              <label className="wp-field-label" htmlFor="publication-title-kk">
                Жарияланым атауы (KK)
              </label>
              <input
                id="publication-title-kk"
                name="titleKk"
                value={titles.Kk}
                maxLength={500}
                className="wp-title-input"
                placeholder="Мысалы: Жасөспірімдердегі қант диабетінің клиникалық және генетикалық маркерлері..."
                disabled={pending}
                onChange={(e) => handleTitleChange("Kk", e.target.value)}
              />
              <p className="wp-field-hint" style={{ marginTop: "6px" }}>
                Ғылыми жарияланымның қазақ тіліндегі толық атауы.
              </p>
            </div>

            <div className="wp-permalink-bar">
              <span className="wp-permalink-prefix">Постоянная ссылка: smu.kz/kk/publications/</span>
              <input
                name="slugKk"
                value={slugs.Kk}
                maxLength={160}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="latin-slug-url"
                className="wp-permalink-input"
                disabled={pending}
                onChange={(e) => handleSlugChange("Kk", e.target.value)}
              />
              {titles.Kk.trim() ? (
                <button
                  type="button"
                  className="wp-permalink-refresh-btn"
                  onClick={() => handleRegenerateSlug("Kk")}
                  title="Сгенерировать ссылку из названия"
                  disabled={pending}
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  <span>Обновить</span>
                </button>
              ) : null}
            </div>

            <div className="wp-excerpt-section" style={{ marginTop: "16px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="wp-field-label">Аңдатпа / Abstract (KK)</span>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>{summaries.Kk.length} / 5000</span>
                </div>
                <textarea
                  name="summaryKk"
                  value={summaries.Kk}
                  maxLength={5000}
                  rows={4}
                  className="wp-excerpt-textarea"
                  disabled={pending}
                  placeholder="Жарияланымның қысқаша мазмұны, зерттеу мақсаты, әдістері мен нәтижелері..."
                  onChange={(e) => setSummaries((prev) => ({ ...prev, Kk: e.target.value }))}
                />
              </label>
            </div>

            {/* SEO Snippet Preview KK */}
            <div className="wp-seo-preview" style={{ marginTop: "16px", padding: "14px 16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
              <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                Google іздеу жүйесінде көрінуі
              </span>
              <div style={{ fontSize: "12px", color: "#202124", marginBottom: "2px" }}>
                smu.kz › kk › publications › {slugs.Kk || "latin-slug-url"}
              </div>
              <div style={{ fontSize: "16px", color: "#1a0dab", fontWeight: 500, lineHeight: 1.3, marginBottom: "4px" }}>
                {titles.Kk || "Жарияланым атауы"} — SMU Ғылым
              </div>
              <div style={{ fontSize: "13px", color: "#4d5156", lineHeight: 1.4 }}>
                {summaries.Kk ? summaries.Kk.slice(0, 160) + (summaries.Kk.length > 160 ? "…" : "") : "Ғылыми мақаланың негізгі мақсаттары, әдістемесі және алынған нәтижелері көрсетілген қысқаша аңдатпа."}
              </div>
            </div>
          </div>

          {/* EN LOCALE PANE */}
          <div style={{ display: activeLocale === "En" ? "block" : "none" }}>
            <div className="wp-title-section">
              <label className="wp-field-label" htmlFor="publication-title-en">
                Publication Title (EN) <small className="wp-tab-optional" style={{ fontWeight: 400 }}>(optional)</small>
              </label>
              <input
                id="publication-title-en"
                name="titleEn"
                value={titles.En}
                maxLength={500}
                className="wp-title-input"
                placeholder="e.g. Clinical and genetic markers in youth diabetes..."
                disabled={pending}
                onChange={(e) => handleTitleChange("En", e.target.value)}
              />
              <p className="wp-field-hint" style={{ marginTop: "6px" }}>
                Full bibliographic title in English (recommended for international indexing).
              </p>
            </div>

            <div className="wp-permalink-bar">
              <span className="wp-permalink-prefix">Постоянная ссылка: smu.kz/en/publications/</span>
              <input
                name="slugEn"
                value={slugs.En}
                maxLength={160}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="latin-slug-url"
                className="wp-permalink-input"
                disabled={pending}
                onChange={(e) => handleSlugChange("En", e.target.value)}
              />
              {titles.En.trim() ? (
                <button
                  type="button"
                  className="wp-permalink-refresh-btn"
                  onClick={() => handleRegenerateSlug("En")}
                  title="Generate slug from title"
                  disabled={pending}
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  <span>Обновить</span>
                </button>
              ) : null}
            </div>

            <div className="wp-excerpt-section" style={{ marginTop: "16px" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="wp-field-label">Abstract (EN)</span>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>{summaries.En.length} / 5000</span>
                </div>
                <textarea
                  name="summaryEn"
                  value={summaries.En}
                  maxLength={5000}
                  rows={4}
                  className="wp-excerpt-textarea"
                  disabled={pending}
                  placeholder="Abstract outlining study objective, methods, key findings, and scientific significance..."
                  onChange={(e) => setSummaries((prev) => ({ ...prev, En: e.target.value }))}
                />
              </label>
            </div>

            {/* SEO Snippet Preview EN */}
            <div className="wp-seo-preview" style={{ marginTop: "16px", padding: "14px 16px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
              <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                Google Search Snippet Preview
              </span>
              <div style={{ fontSize: "12px", color: "#202124", marginBottom: "2px" }}>
                smu.kz › en › publications › {slugs.En || "latin-slug-url"}
              </div>
              <div style={{ fontSize: "16px", color: "#1a0dab", fontWeight: 500, lineHeight: 1.3, marginBottom: "4px" }}>
                {titles.En || "Publication Title"} — SMU Science
              </div>
              <div style={{ fontSize: "13px", color: "#4d5156", lineHeight: 1.4 }}>
                {summaries.En ? summaries.En.slice(0, 160) + (summaries.En.length > 160 ? "…" : "") : "Concise abstract detailing research hypothesis, methods, and experimental findings."}
              </div>
            </div>
          </div>

          {/* METABOX: PDF DOCUMENT ATTACHMENT (OPTION A) */}
          <details className="wp-metabox-card" open style={{ marginTop: "24px" }}>
            <summary className="wp-metabox-header">
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={16} aria-hidden="true" style={{ color: "#e11d48" }} />
                Полный текст публикации (PDF-документ)
              </span>
            </summary>
            <div className="wp-metabox-content">
              {fileMediaId ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    gap: "16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "8px",
                        background: "#ffe4e6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: "#e11d48",
                      }}
                    >
                      <FileText size={24} aria-hidden="true" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 650, color: "#1e293b", fontSize: "14px", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {selectedFile?.fileName ?? "publication-document.pdf"}
                      </p>
                      <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0" }}>
                        PDF · {selectedFile?.fileSize ? `${(selectedFile.fileSize / (1024 * 1024)).toFixed(2)} МБ` : "Загруженный документ"}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    <button
                      type="button"
                      className="secondary-button"
                      style={{ padding: "6px 12px", fontSize: "12px" }}
                      onClick={() => setIsMediaModalOpen(true)}
                      disabled={pending}
                    >
                      Заменить PDF
                    </button>
                    <button
                      type="button"
                      className="wp-icon-btn is-danger"
                      onClick={() => setFileMediaId("")}
                      title="Удалить прикреплённый файл"
                      disabled={pending}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    border: "2px dashed #cbd5e1",
                    borderRadius: "10px",
                    padding: "24px 20px",
                    textAlign: "center",
                    background: "#fbfcfe",
                  }}
                >
                  <FileText size={36} aria-hidden="true" style={{ color: "#94a3b8", margin: "0 auto 8px" }} />
                  <h4 style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "#1e293b" }}>
                    PDF-документ публикации не прикреплен
                  </h4>
                  <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b", maxWidth: "480px", marginInline: "auto" }}>
                    Загрузите PDF статьи, доклада или автореферата (до 50 МБ). Посетители сайта смогут читать и скачивать полный текст.
                  </p>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                    onClick={() => setIsMediaModalOpen(true)}
                    disabled={pending}
                  >
                    <Upload size={14} aria-hidden="true" />
                    <span>Выбрать PDF из медиатеки</span>
                  </button>
                </div>
              )}
            </div>
          </details>

          {/* METABOX: BIBLIOGRAPHIC DATA */}
          <details className="wp-metabox-card" open style={{ marginTop: "20px" }}>
            <summary className="wp-metabox-header">
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <BookOpen size={16} aria-hidden="true" />
                Библиографические параметры
              </span>
            </summary>
            <div className="wp-metabox-content">
              <label style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                <span className="wp-field-label">Журнал / Издание <span className="required-star">*</span></span>
                <input
                  name="journal"
                  required
                  minLength={2}
                  maxLength={240}
                  value={journalValue}
                  onChange={(e) => setJournalValue(e.target.value)}
                  placeholder="Например: Вестник НАН РК, Nature, Международный научный вестник"
                  disabled={pending}
                  style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                />
              </label>

              <div className="form-two-columns" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span className="wp-field-label">
                    <Calendar size={13} aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                    Год издания <span className="required-star">*</span>
                  </span>
                  <input
                    type="number"
                    name="year"
                    required
                    min={1800}
                    max={2200}
                    value={yearValue}
                    onChange={(e) => setYearValue(e.target.value)}
                    disabled={pending}
                    style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span className="wp-field-label">
                    <Hash size={13} aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                    DOI (цифровой идентификатор)
                  </span>
                  <input
                    name="doi"
                    value={doiValue}
                    onChange={(e) => setDoiValue(e.target.value)}
                    placeholder="10.1234/example.2026.01"
                    maxLength={300}
                    disabled={pending}
                    style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                  />
                  <small style={{ color: "#64748b", fontSize: "11px" }}>Формат: 10.xxxx/...</small>
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span className="wp-field-label">
                  <Globe size={13} aria-hidden="true" style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                  Ссылка на публикацию (URL)
                </span>
                <input
                  type="url"
                  name="url"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="https://..."
                  maxLength={1000}
                  disabled={pending}
                  style={{ padding: "9px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                />
                <small style={{ color: "#64748b", fontSize: "11px" }}>Прямая ссылка на электронную версию или издательство</small>
              </label>
            </div>
          </details>

          {/* METABOX: AUTHORS & RELATIONS */}
          <details className="wp-metabox-card" open style={{ marginTop: "20px" }}>
            <summary className="wp-metabox-header">
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={16} aria-hidden="true" />
                Авторский коллектив и связи
              </span>
            </summary>
            <div className="wp-metabox-content">
              {/* Primary author */}
              <div style={{ marginBottom: "20px" }}>
                <label className="wp-field-label" htmlFor="publication-primary-scientist" style={{ marginBottom: "8px", display: "block" }}>
                  Основной автор (исследователь из каталога) <span className="required-star">*</span>
                </label>
                <PublicationScientistSelect
                  options={scientistOptions}
                  initialId={publication?.scientistId ?? ""}
                  disabled={pending}
                />
                <p className="wp-field-hint" style={{ marginTop: "6px" }}>
                  Учёный региона, в профиле которого публикация будет представлена в первую очередь.
                </p>
              </div>

              {/* Coauthors and linked works */}
              <PublicationRelationsEditor
                coauthors={publication?.coauthors ?? []}
                workIds={publication?.workIds ?? []}
                scientists={authorOptions}
                works={workOptions}
              />
            </div>
          </details>
        </div>

        {/* SIDEBAR */}
        <aside className="wp-editor-sidebar">
          {/* Status Metabox */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Статус и публикация</summary>
            <div className="wp-sidebar-card-body">
              {publication ? (
                <div className="wp-sidebar-meta-row">
                  <span>Текущий статус:</span>
                  <span className={`status-badge status-${publication.status}`} style={{ fontSize: "11px" }}>
                    {statusLabels[publication.status]}
                  </span>
                </div>
              ) : null}

              <div style={{ marginTop: "12px" }}>
                <label className="wp-field-label" style={{ marginBottom: "6px", display: "block" }}>
                  Установить статус
                </label>
                <CustomSelect
                  name="status"
                  value={currentStatus}
                  options={statusOptions}
                  onChange={setCurrentStatus}
                  disabled={pending}
                />
              </div>

              <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #e2e8f0" }}>
                <button
                  type="submit"
                  className="primary-button"
                  style={{ width: "100%", justifyContent: "center" }}
                  disabled={pending}
                >
                  <Save size={15} aria-hidden="true" />
                  <span>{pending ? "Сохранение…" : submitLabel}</span>
                </button>
              </div>
            </div>
          </details>

          {/* Type Metabox */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Тип материала</summary>
            <div className="wp-sidebar-card-body">
              <label className="wp-field-label" style={{ marginBottom: "6px", display: "block" }}>
                Категория публикации
              </label>
              <CustomSelect
                name="publicationType"
                value={publicationType}
                options={typeOptions}
                onChange={setPublicationType}
                disabled={pending}
              />
              <p className="wp-field-hint" style={{ marginTop: "10px" }}>
                Определяет бейдж и фильтрацию в научном каталоге.
              </p>
            </div>
          </details>

          {/* Guidelines Metabox */}
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Справка и рекомендации</summary>
            <div className="wp-sidebar-card-body" style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                <Info size={16} aria-hidden="true" style={{ color: "var(--forest-bright)", flexShrink: 0, marginTop: "2px" }} />
                <span>Заполняйте аннотацию и заголовок на трёх языках для максимального охвата в международных каталогах.</span>
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                <FileCheck size={16} aria-hidden="true" style={{ color: "var(--forest-bright)", flexShrink: 0, marginTop: "2px" }} />
                <span>Прикрепление PDF даёт возможность читателям знакомиться с полным текстом статьи прямо на портале.</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <Layers size={16} aria-hidden="true" style={{ color: "var(--forest-bright)", flexShrink: 0, marginTop: "2px" }} />
                <span>Привязывайте соавторов и связанные исследования для построения целостного графа науки.</span>
              </div>
            </div>
          </details>
        </aside>
      </div>

      {/* MEDIA SELECTOR MODAL (PDF) */}
      {isMediaModalOpen ? (
        <div className="wp-modal-backdrop" onClick={() => setIsMediaModalOpen(false)}>
          <div className="wp-modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "680px" }}>
            <div className="wp-modal-header">
              <h3>Выбор PDF-файла публикации</h3>
              <button
                type="button"
                className="wp-modal-close-btn"
                onClick={() => setIsMediaModalOpen(false)}
                aria-label="Закрыть"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="wp-modal-toolbar">
              <label htmlFor={mediaSearchId} className="visually-hidden">
                Поиск файла
              </label>
              <input
                id={mediaSearchId}
                type="search"
                value={mediaSearchQuery}
                onChange={(e) => setMediaSearchQuery(e.target.value)}
                placeholder="Поиск PDF по названию документа..."
                className="wp-modal-search-input"
              />
              <Link href="/admin/content/media" target="_blank" className="secondary-button wp-modal-upload-link">
                Медиатека ↗
              </Link>
            </div>

            <div className="wp-modal-grid" style={{ gridTemplateColumns: "1fr", maxHeight: "360px", overflowY: "auto" }}>
              {filteredMedia.length > 0 ? (
                filteredMedia.map((asset) => (
                  <div
                    key={asset.id}
                    className={`wp-modal-item ${asset.id === fileMediaId ? "is-selected" : ""}`}
                    onClick={() => {
                      setFileMediaId(asset.id);
                      setIsMediaModalOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: asset.id === fileMediaId ? "2px solid var(--forest-bright)" : "1px solid #e2e8f0",
                      background: asset.id === fileMediaId ? "#f0fdf4" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "6px",
                        background: "#ffe4e6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: "#e11d48",
                      }}
                    >
                      <FileText size={20} aria-hidden="true" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: "13px", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {asset.fileName}
                      </p>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        {(asset.fileSize / (1024 * 1024)).toFixed(2)} МБ · {asset.mimeType}
                      </span>
                    </div>
                    {asset.id === fileMediaId ? (
                      <span className="wp-modal-tag" style={{ background: "var(--forest-bright)", color: "#fff" }}>
                        Выбран
                      </span>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="wp-modal-empty" style={{ padding: "32px 16px", textAlign: "center" }}>
                  <FileText size={32} style={{ color: "#94a3b8", margin: "0 auto 8px" }} />
                  <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
                    {media.length === 0
                      ? "В медиатеке пока нет загруженных PDF документов."
                      : "PDF-документы по запросу не найдены."}
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#94a3b8" }}>
                    Вы можете загрузить файл в разделе <Link href="/admin/content/media" target="_blank" style={{ textDecoration: "underline", color: "var(--forest-bright)" }}>Медиатека</Link>.
                  </p>
                </div>
              )}
            </div>

            <div className="wp-modal-footer">
              <button type="button" className="secondary-button" onClick={() => setIsMediaModalOpen(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
