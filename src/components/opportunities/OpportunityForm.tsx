"use client";

import { useState } from "react";
import { useActionState } from "react";
import { ArrowUpRight, RotateCcw, Save } from "lucide-react";
import Link from "next/link";
import { CustomSelect } from "@/components/articles/CustomSelect";
import { eventLocalInput } from "@/lib/events";
import { generateSlug } from "@/lib/articles/slug";
import { opportunityTypes } from "@/lib/opportunity-constants";
import type { Opportunity } from "@/lib/validation/opportunity";
import { opportunityTypeLabels, opportunityErrorMessage } from "@/lib/i18n/opportunity";

const statuses = { draft: "Черновик", published: "Опубликовано", archived: "В архиве" };

export function OpportunityForm({
  action,
  opportunity,
}: {
  action: (previous: { error?: string }, form: FormData) => Promise<{ error?: string }>;
  opportunity?: Opportunity;
}) {
  const [state, submit, pending] = useActionState<{ error?: string; values?: Record<string, string> }, FormData>(
    async (_previous, form) => {
      const result = await action({}, form);
      // React resets uncontrolled forms after an action returns. Keep submitted
      // values as the new defaults when validation or a version check fails.
      return {
        ...result,
        values: Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)])),
      };
    },
    {}
  );

  const field = (name: string, initial: string) => state.values?.[name] ?? initial;

  const [activeLocale, setActiveLocale] = useState<"ru" | "kk" | "en">("ru");

  const ru = opportunity?.translations.find((t) => t.locale === "ru");
  const kk = opportunity?.translations.find((t) => t.locale === "kk");
  const en = opportunity?.translations.find((t) => t.locale === "en");

  const [titles, setTitles] = useState({
    ru: field("title_ru", ru?.title ?? ""),
    kk: field("title_kk", kk?.title ?? ""),
    en: field("title_en", en?.title ?? ""),
  });

  const [slugs, setSlugs] = useState({
    ru: field("slug_ru", ru?.slug ?? ""),
    kk: field("slug_kk", kk?.slug ?? ""),
    en: field("slug_en", en?.slug ?? ""),
  });

  const [slugTouched, setSlugTouched] = useState({
    ru: Boolean(field("slug_ru", ru?.slug ?? "")),
    kk: Boolean(field("slug_kk", kk?.slug ?? "")),
    en: Boolean(field("slug_en", en?.slug ?? "")),
  });

  const [summaries, setSummaries] = useState({
    ru: field("summary_ru", ru?.summary ?? ""),
    kk: field("summary_kk", kk?.summary ?? ""),
    en: field("summary_en", en?.summary ?? ""),
  });

  const handleTitleChange = (locale: "ru" | "kk" | "en", val: string) => {
    setTitles((prev) => ({ ...prev, [locale]: val }));
    if (!slugTouched[locale]) {
      setSlugs((prev) => ({ ...prev, [locale]: generateSlug(val) }));
    }
  };

  const handleSlugChange = (locale: "ru" | "kk" | "en", val: string) => {
    setSlugs((prev) => ({ ...prev, [locale]: val }));
    setSlugTouched((prev) => ({ ...prev, [locale]: true }));
  };

  const handleRegenerateSlug = (locale: "ru" | "kk" | "en") => {
    const auto = generateSlug(titles[locale]);
    setSlugs((prev) => ({ ...prev, [locale]: auto }));
    setSlugTouched((prev) => ({ ...prev, [locale]: false }));
  };

  const typeOptions = opportunityTypes.map((type) => ({
    value: type,
    label: opportunityTypeLabels.ru[type],
  }));

  return (
    <form action={submit} className="article-form wp-editor-form">
      {state.error && (
        <p role="alert" className="notice error-notice" style={{ margin: "0 0 16px 0" }}>
          {opportunityErrorMessage(state.error)}
        </p>
      )}

      <fieldset disabled={pending} className="opportunity-fields" style={{ border: 0, padding: 0, margin: 0 }}>
        {/* TOPBAR: Language Tabs, Status & Action */}
        <div className="wp-editor-topbar">
          <div className="wp-topbar-left">
            <div className="wp-lang-tabs" role="tablist" aria-label="Языковые версии возможности">
              <button
                type="button"
                role="tab"
                disabled={pending}
                aria-selected={activeLocale === "ru"}
                className={`wp-lang-tab ${activeLocale === "ru" ? "is-active" : ""}`}
                onClick={() => setActiveLocale("ru")}
              >
                <span className={`wp-tab-dot ${(titles.ru || field("title_ru", ru?.title ?? "")).trim() ? "is-filled" : ""}`} />
                Русский
              </button>
              <button
                type="button"
                role="tab"
                disabled={pending}
                aria-selected={activeLocale === "kk"}
                className={`wp-lang-tab ${activeLocale === "kk" ? "is-active" : ""}`}
                onClick={() => setActiveLocale("kk")}
              >
                <span className={`wp-tab-dot ${(titles.kk || field("title_kk", kk?.title ?? "")).trim() ? "is-filled" : ""}`} />
                Қазақша
              </button>
              <button
                type="button"
                role="tab"
                disabled={pending}
                aria-selected={activeLocale === "en"}
                className={`wp-lang-tab ${activeLocale === "en" ? "is-active" : ""}`}
                onClick={() => setActiveLocale("en")}
              >
                <span className={`wp-tab-dot ${(titles.en || field("title_en", en?.title ?? "")).trim() ? "is-filled" : ""}`} />
                English <small className="wp-tab-optional">необяз.</small>
              </button>
            </div>
          </div>

          <div className="wp-topbar-right">
            <button type="submit" className="primary-button wp-submit-btn" disabled={pending}>
              <Save size={16} aria-hidden="true" />
              <span>{pending ? "Сохранение…" : "Сохранить черновик"}</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE: Left Column (Content) & Right Column (Sidebar) */}
        <div className="wp-editor-workspace">
          {/* MAIN COLUMN */}
          <div className="wp-editor-main">
            {/* RU LOCALE */}
            <div
              className={`wp-locale-pane ${activeLocale === "ru" ? "is-active" : ""}`}
              style={{ display: activeLocale === "ru" ? "flex" : "none", flexDirection: "column", gap: "16px" }}
            >
              <div className="wp-title-section">
                <label className="visually-hidden" htmlFor="title_ru">Название (RU)</label>
                <input
                  id="title_ru"
                  name="title_ru"
                  defaultValue={field("title_ru", ru?.title ?? "")}
                  required
                  minLength={3}
                  maxLength={240}
                  className="wp-title-input"
                  placeholder="Добавьте название возможности (RU)..."
                  onChange={(e) => handleTitleChange("ru", e.target.value)}
                />
              </div>

              <div className="wp-permalink-bar">
                <span className="wp-permalink-prefix">Постоянная ссылка: smu.kz/ru/opportunities/</span>
                <input
                  name="slug_ru"
                  value={slugs.ru}
                  required
                  minLength={2}
                  maxLength={160}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="latin-slug-url"
                  className="wp-permalink-input"
                  onChange={(e) => handleSlugChange("ru", e.target.value)}
                />
                {titles.ru.trim() ? (
                  <button
                    type="button"
                    className="wp-permalink-refresh-btn"
                    onClick={() => handleRegenerateSlug("ru")}
                    title="Сгенерировать ссылку из названия"
                    disabled={pending}
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    <span>Обновить</span>
                  </button>
                ) : null}
              </div>

              <div className="wp-excerpt-section">
                <label>
                  <span className="wp-field-label">Краткое описание (анонс для каталога)</span>
                  <textarea
                    name="summary_ru"
                    defaultValue={field("summary_ru", ru?.summary ?? "")}
                    required
                    minLength={20}
                    maxLength={800}
                    rows={3}
                    className="wp-excerpt-textarea"
                    placeholder="Краткое описание для карточек каталога и главной страницы..."
                    onChange={(e) => setSummaries((prev) => ({ ...prev, ru: e.target.value }))}
                  />
                </label>
              </div>

              <div className="wp-opportunity-description-box" style={{ background: "#fff", border: "1px solid #dce8ed", borderRadius: "10px", padding: "18px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span className="wp-field-label" style={{ fontWeight: 650, color: "#1e293b", fontSize: "14px" }}>
                    Полное описание программы и условий
                  </span>
                  <textarea
                    name="description_ru"
                    defaultValue={field("description_ru", ru?.description ?? "")}
                    required
                    minLength={40}
                    maxLength={30000}
                    rows={10}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      fontFamily: "inherit",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                    placeholder="Подробное описание программы, требования к кандидатам, этапы отбора..."
                  />
                </label>
                <small style={{ color: "#64748b", fontSize: "12px", marginTop: "4px", display: "block" }}>
                  Разделяйте абзацы пустой строкой.
                </small>
              </div>

              <details className="wp-metabox-card" open>
                <summary className="wp-metabox-header">Организация и финансирование (RU)</summary>
                <div className="wp-metabox-content" style={{ display: "grid", gap: "14px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span className="wp-field-label">Организация / грантодатель</span>
                    <input
                      name="organization_ru"
                      defaultValue={field("organization_ru", ru?.organization ?? "")}
                      required
                      minLength={2}
                      maxLength={240}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      placeholder="Например: Фонд науки, Erasmus+, МОН РК"
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span className="wp-field-label">Финансирование / размер гранта (необязательно)</span>
                    <textarea
                      name="funding_ru"
                      defaultValue={field("funding_ru", ru?.funding ?? "")}
                      maxLength={1000}
                      rows={2}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      placeholder="Например: До 10 000 000 ₸, покрытие расходов на проживание"
                    />
                  </label>
                </div>
              </details>

              {/* SEO Preview Box */}
              <details className="wp-metabox-card wp-seo-card" open>
                <summary className="wp-metabox-header">Поисковая оптимизация (SEO · RU)</summary>
                <div className="wp-metabox-content">
                  <div className="wp-seo-preview">
                    <span className="wp-seo-preview-label">Предпросмотр в поисковой выдаче Google</span>
                    <div className="wp-seo-preview-snippet">
                      <span className="wp-seo-preview-url">https://smu.kz/ru/opportunities/{slugs.ru || "primer-slug"}</span>
                      <h4 className="wp-seo-preview-title">{titles.ru || "Заголовок возможности в поиске"}</h4>
                      <p className="wp-seo-preview-desc">
                        {summaries.ru || "Краткое описание возможности будет отображаться в поисковой выдаче для привлечения исследователей."}
                      </p>
                    </div>
                  </div>
                </div>
              </details>
            </div>

            {/* KK LOCALE */}
            <div
              className={`wp-locale-pane ${activeLocale === "kk" ? "is-active" : ""}`}
              style={{ display: activeLocale === "kk" ? "flex" : "none", flexDirection: "column", gap: "16px" }}
            >
              <div className="wp-title-section">
                <label className="visually-hidden" htmlFor="title_kk">Название (KK)</label>
                <input
                  id="title_kk"
                  name="title_kk"
                  defaultValue={field("title_kk", kk?.title ?? "")}
                  required
                  minLength={3}
                  maxLength={240}
                  className="wp-title-input"
                  placeholder="Мүмкіндік атауын енгізіңіз (KK)..."
                  onChange={(e) => handleTitleChange("kk", e.target.value)}
                />
              </div>

              <div className="wp-permalink-bar">
                <span className="wp-permalink-prefix">Постоянная ссылка: smu.kz/kk/opportunities/</span>
                <input
                  name="slug_kk"
                  value={slugs.kk}
                  required
                  minLength={2}
                  maxLength={160}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="latin-slug-url"
                  className="wp-permalink-input"
                  onChange={(e) => handleSlugChange("kk", e.target.value)}
                />
                {titles.kk.trim() ? (
                  <button
                    type="button"
                    className="wp-permalink-refresh-btn"
                    onClick={() => handleRegenerateSlug("kk")}
                    title="Сгенерировать ссылку из названия"
                    disabled={pending}
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    <span>Жаңарту</span>
                  </button>
                ) : null}
              </div>

              <div className="wp-excerpt-section">
                <label>
                  <span className="wp-field-label">Қысқаша сипаттама (каталогқа арналған анонс)</span>
                  <textarea
                    name="summary_kk"
                    defaultValue={field("summary_kk", kk?.summary ?? "")}
                    required
                    minLength={20}
                    maxLength={800}
                    rows={3}
                    className="wp-excerpt-textarea"
                    placeholder="Каталог пен карточкаларға арналған қысқаша анонс..."
                    onChange={(e) => setSummaries((prev) => ({ ...prev, kk: e.target.value }))}
                  />
                </label>
              </div>

              <div className="wp-opportunity-description-box" style={{ background: "#fff", border: "1px solid #dce8ed", borderRadius: "10px", padding: "18px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span className="wp-field-label" style={{ fontWeight: 650, color: "#1e293b", fontSize: "14px" }}>
                    Бағдарлама мен шарттардың толық сипаттамасы
                  </span>
                  <textarea
                    name="description_kk"
                    defaultValue={field("description_kk", kk?.description ?? "")}
                    required
                    minLength={40}
                    maxLength={30000}
                    rows={10}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      fontFamily: "inherit",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                    placeholder="Бағдарламаның толық сипаттамасы, талаптар, кезеңдер..."
                  />
                </label>
                <small style={{ color: "#64748b", fontSize: "12px", marginTop: "4px", display: "block" }}>
                  Абзацтарды бөлу үшін бос жол қалдырыңыз.
                </small>
              </div>

              <details className="wp-metabox-card" open>
                <summary className="wp-metabox-header">Ұйым және қаржыландыру (KK)</summary>
                <div className="wp-metabox-content" style={{ display: "grid", gap: "14px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span className="wp-field-label">Ұйым / грант беруші</span>
                    <input
                      name="organization_kk"
                      defaultValue={field("organization_kk", kk?.organization ?? "")}
                      required
                      minLength={2}
                      maxLength={240}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      placeholder="Мысалы: Ғылым қоры, ҚР ҒЖБМ"
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span className="wp-field-label">Қаржыландыру / грант көлемі (міндетті емес)</span>
                    <textarea
                      name="funding_kk"
                      defaultValue={field("funding_kk", kk?.funding ?? "")}
                      maxLength={1000}
                      rows={2}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      placeholder="Мысалы: 10 000 000 ₸ дейін"
                    />
                  </label>
                </div>
              </details>

              {/* SEO Preview Box */}
              <details className="wp-metabox-card wp-seo-card" open>
                <summary className="wp-metabox-header">Поисковая оптимизация (SEO · KK)</summary>
                <div className="wp-metabox-content">
                  <div className="wp-seo-preview">
                    <span className="wp-seo-preview-label">Предпросмотр в поисковой выдаче Google</span>
                    <div className="wp-seo-preview-snippet">
                      <span className="wp-seo-preview-url">https://smu.kz/kk/opportunities/{slugs.kk || "primer-slug"}</span>
                      <h4 className="wp-seo-preview-title">{titles.kk || "Мүмкіндік тақырыбы"}</h4>
                      <p className="wp-seo-preview-desc">
                        {summaries.kk || "Ғалымдар мен зерттеушілерге арналған мүмкіндіктің қысқаша сипаттамасы."}
                      </p>
                    </div>
                  </div>
                </div>
              </details>
            </div>

            {/* EN LOCALE */}
            <div
              className={`wp-locale-pane ${activeLocale === "en" ? "is-active" : ""}`}
              style={{ display: activeLocale === "en" ? "flex" : "none", flexDirection: "column", gap: "16px" }}
            >
              <div className="wp-title-section">
                <label className="visually-hidden" htmlFor="title_en">Название (EN)</label>
                <input
                  id="title_en"
                  name="title_en"
                  defaultValue={field("title_en", en?.title ?? "")}
                  minLength={3}
                  maxLength={240}
                  className="wp-title-input"
                  placeholder="Add opportunity title (EN, optional)..."
                  onChange={(e) => handleTitleChange("en", e.target.value)}
                />
              </div>

              <div className="wp-permalink-bar">
                <span className="wp-permalink-prefix">Постоянная ссылка: smu.kz/en/opportunities/</span>
                <input
                  name="slug_en"
                  value={slugs.en}
                  minLength={2}
                  maxLength={160}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="latin-slug-url"
                  className="wp-permalink-input"
                  onChange={(e) => handleSlugChange("en", e.target.value)}
                />
                {titles.en.trim() ? (
                  <button
                    type="button"
                    className="wp-permalink-refresh-btn"
                    onClick={() => handleRegenerateSlug("en")}
                    title="Сгенерировать ссылку из названия"
                    disabled={pending}
                  >
                    <RotateCcw size={12} aria-hidden="true" />
                    <span>Update</span>
                  </button>
                ) : null}
              </div>

              <div className="wp-excerpt-section">
                <label>
                  <span className="wp-field-label">Short description / summary (optional)</span>
                  <textarea
                    name="summary_en"
                    defaultValue={field("summary_en", en?.summary ?? "")}
                    minLength={20}
                    maxLength={800}
                    rows={3}
                    className="wp-excerpt-textarea"
                    placeholder="Short summary for catalogue cards and preview..."
                    onChange={(e) => setSummaries((prev) => ({ ...prev, en: e.target.value }))}
                  />
                </label>
              </div>

              <div className="wp-opportunity-description-box" style={{ background: "#fff", border: "1px solid #dce8ed", borderRadius: "10px", padding: "18px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span className="wp-field-label" style={{ fontWeight: 650, color: "#1e293b", fontSize: "14px" }}>
                    Detailed description (optional)
                  </span>
                  <textarea
                    name="description_en"
                    defaultValue={field("description_en", en?.description ?? "")}
                    minLength={40}
                    maxLength={30000}
                    rows={10}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      fontFamily: "inherit",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                    placeholder="Detailed program description, eligibility requirements..."
                  />
                </label>
                <small style={{ color: "#64748b", fontSize: "12px", marginTop: "4px", display: "block" }}>
                  Separate paragraphs with blank lines.
                </small>
              </div>

              <details className="wp-metabox-card" open>
                <summary className="wp-metabox-header">Organization & Funding (EN, optional)</summary>
                <div className="wp-metabox-content" style={{ display: "grid", gap: "14px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span className="wp-field-label">Organization</span>
                    <input
                      name="organization_en"
                      defaultValue={field("organization_en", en?.organization ?? "")}
                      minLength={2}
                      maxLength={240}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      placeholder="e.g. Science Foundation, European Commission"
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span className="wp-field-label">Funding (optional)</span>
                    <textarea
                      name="funding_en"
                      defaultValue={field("funding_en", en?.funding ?? "")}
                      maxLength={1000}
                      rows={2}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      placeholder="e.g. Up to $25,000, covers travel and accommodation"
                    />
                  </label>
                </div>
              </details>

              {/* SEO Preview Box */}
              <details className="wp-metabox-card wp-seo-card" open>
                <summary className="wp-metabox-header">Поисковая оптимизация (SEO · EN)</summary>
                <div className="wp-metabox-content">
                  <div className="wp-seo-preview">
                    <span className="wp-seo-preview-label">Google Search Preview</span>
                    <div className="wp-seo-preview-snippet">
                      <span className="wp-seo-preview-url">https://smu.kz/en/opportunities/{slugs.en || "primer-slug"}</span>
                      <h4 className="wp-seo-preview-title">{titles.en || "Opportunity Title in Search"}</h4>
                      <p className="wp-seo-preview-desc">
                        {summaries.en || "Brief description of the opportunity as it appears in Google search results."}
                      </p>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>

          {/* INSPECTOR SIDEBAR */}
          <aside className="wp-editor-sidebar">
            {/* Card: Status & Save */}
            <details className="wp-sidebar-card" open>
              <summary className="wp-sidebar-card-header">Параметры и сохранение</summary>
              <div className="wp-sidebar-card-body">
                <div className="wp-sidebar-meta-row">
                  <span className="wp-field-label">Статус материала</span>
                  <span className={`status-badge status-${opportunity?.status ?? "draft"}`}>
                    {statuses[opportunity?.status ?? "draft"]}
                  </span>
                </div>

                {opportunity?.status === "published" ? (
                  <div className="wp-sidebar-meta-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
                    <span className="wp-field-label">Публичный просмотр:</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {opportunity.translations.map((t) => (
                        <Link
                          key={t.locale}
                          href={`/${t.locale}/opportunities/${t.slug}`}
                          target="_blank"
                          className="wp-preview-link"
                          style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <span>{t.locale.toUpperCase()}</span>
                          <ArrowUpRight size={12} aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div style={{ marginTop: "14px" }}>
                  <button
                    type="submit"
                    className="primary-button wp-submit-btn"
                    disabled={pending}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    <Save size={16} aria-hidden="true" />
                    <span>{pending ? "Сохранение…" : "Сохранить черновик"}</span>
                  </button>
                </div>
              </div>
            </details>

            {/* Card: Terms & Conditions */}
            <details className="wp-sidebar-card" open>
              <summary className="wp-sidebar-card-header">Условия участия</summary>
              <div className="wp-sidebar-card-body">
                <div className="wp-field-group">
                  <span className="wp-field-label">Тип возможности</span>
                  <CustomSelect
                    name="type"
                    defaultValue={field("type", opportunity?.type ?? "grant")}
                    options={typeOptions}
                    disabled={pending}
                  />
                </div>

                <div className="wp-field-group">
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span className="wp-field-label">Код страны</span>
                    <input
                      name="country"
                      defaultValue={field("country", opportunity?.country ?? "")}
                      pattern="[A-Za-z]{2}"
                      maxLength={2}
                      placeholder="KZ"
                      disabled={pending}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                    />
                    <small style={{ color: "#64748b", fontSize: "11px", marginTop: "2px" }}>
                      Две латинские буквы; пусто — международная / не указана.
                    </small>
                  </label>
                </div>

                <div className="wp-field-group">
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span className="wp-field-label">Срок подачи (дедлайн, UTC+5)</span>
                    <input
                      type="datetime-local"
                      name="deadline"
                      defaultValue={field("deadline", eventLocalInput(opportunity?.deadline))}
                      disabled={pending}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                    />
                    <small style={{ color: "#64748b", fontSize: "11px", marginTop: "2px" }}>
                      Пусто — срок не указан. Приём закрывается в указанное время.
                    </small>
                  </label>
                </div>

                <div className="wp-field-group">
                  <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span className="wp-field-label">Первоисточник (URL)</span>
                    <input
                      type="url"
                      name="sourceUrl"
                      defaultValue={field("sourceUrl", opportunity?.sourceUrl ?? "")}
                      required
                      maxLength={2000}
                      placeholder="https://example.org/grant"
                      disabled={pending}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                    />
                  </label>
                </div>
              </div>
            </details>
          </aside>
        </div>
      </fieldset>
    </form>
  );
}
