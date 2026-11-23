"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Globe,
  HandHeart,
  Info,
  Layers,
  RotateCcw,
  Save,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import { generateSlug } from "@/lib/articles/slug";
import { mentorshipFormatLabels, mentorshipStatusLabels } from "@/lib/mentorship";
import {
  mentorshipFormats,
  type MentorshipFormat,
  type MentorshipOffer,
} from "@/types/domain/mentorship";
import type { ScienceWorkOptions } from "@/types/domain/science-work";

type Props = {
  action: (form: FormData) => Promise<void>;
  offer?: MentorshipOffer;
  options: ScienceWorkOptions;
  submitLabel?: string;
};

export function MentorshipForm({
  action,
  offer,
  options,
  submitLabel = offer ? "Сохранить предложение" : "Создать предложение",
}: Props) {
  const [activeLocale, setActiveLocale] = useState<"ru" | "kk" | "en">("ru");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Existing translations
  const ru = offer?.translations.find((item) => item.locale === "ru");
  const kk = offer?.translations.find((item) => item.locale === "kk");
  const en = offer?.translations.find((item) => item.locale === "en");

  // Form states for translations
  const [titles, setTitles] = useState({
    ru: ru?.title ?? "",
    kk: kk?.title ?? "",
    en: en?.title ?? "",
  });

  const [slugs, setSlugs] = useState({
    ru: ru?.slug ?? "",
    kk: kk?.slug ?? "",
    en: en?.slug ?? "",
  });

  const [isSlugTouched, setIsSlugTouched] = useState({
    ru: Boolean(ru?.slug),
    kk: Boolean(kk?.slug),
    en: Boolean(en?.slug),
  });

  const [summaries, setSummaries] = useState({
    ru: ru?.summary ?? "",
    kk: kk?.summary ?? "",
    en: en?.summary ?? "",
  });

  const [descriptions, setDescriptions] = useState({
    ru: ru?.description ?? "",
    kk: kk?.description ?? "",
    en: en?.description ?? "",
  });

  // Settings
  const [scientistId, setScientistId] = useState(offer?.scientistId ?? "");
  const [fieldId, setFieldId] = useState(offer?.fieldId ?? "");
  const [format, setFormat] = useState<MentorshipFormat>(offer?.format ?? "online");
  const [capacity, setCapacity] = useState(offer?.capacity ?? 3);

  // Scientist search filter in sidebar
  const [scientistQuery, setScientistQuery] = useState("");

  const filteredScientists = options.scientists.filter((s) =>
    !scientistQuery.trim() || s.name.toLowerCase().includes(scientistQuery.toLowerCase())
  );

  const handleTitleChange = (locale: "ru" | "kk" | "en", val: string) => {
    setTitles((prev) => ({ ...prev, [locale]: val }));
    if (!isSlugTouched[locale] && val.trim()) {
      setSlugs((prev) => ({ ...prev, [locale]: generateSlug(val) }));
    }
  };

  const handleSlugChange = (locale: "ru" | "kk" | "en", val: string) => {
    setIsSlugTouched((prev) => ({ ...prev, [locale]: true }));
    setSlugs((prev) => ({ ...prev, [locale]: val }));
  };

  const handleRegenerateSlug = (locale: "ru" | "kk" | "en") => {
    const title = titles[locale];
    if (title.trim()) {
      setSlugs((prev) => ({ ...prev, [locale]: generateSlug(title) }));
      setIsSlugTouched((prev) => ({ ...prev, [locale]: true }));
    }
  };

  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  const validateForm = (e: React.FormEvent<HTMLFormElement>) => {
    setErrorMsg("");

    // Scientist & Field validation
    if (!scientistId) {
      e.preventDefault();
      setErrorMsg("Выберите наставника из списка учёных.");
      return;
    }

    if (!fieldId) {
      e.preventDefault();
      setErrorMsg("Выберите научное направление.");
      return;
    }

    if (capacity < 1 || capacity > 50) {
      e.preventDefault();
      setErrorMsg("Количество мест одновременно должно быть от 1 до 50.");
      return;
    }

    // Russian validation (mandatory)
    if (!titles.ru.trim() || titles.ru.trim().length < 3) {
      e.preventDefault();
      setErrorMsg("Укажите название предложения на русском языке (минимум 3 символа).");
      setActiveLocale("ru");
      return;
    }
    if (!slugs.ru.trim() || !slugRegex.test(slugs.ru.trim()) || slugs.ru.trim().length < 2) {
      e.preventDefault();
      setErrorMsg("URL slug (RU) должен содержать строчные латинские буквы, цифры и дефисы (от 2 символов).");
      setActiveLocale("ru");
      return;
    }
    if (!summaries.ru.trim() || summaries.ru.trim().length < 20) {
      e.preventDefault();
      setErrorMsg("Укажите краткое описание на русском языке (минимум 20 символов).");
      setActiveLocale("ru");
      return;
    }
    if (!descriptions.ru.trim() || descriptions.ru.trim().length < 40) {
      e.preventDefault();
      setErrorMsg("Укажите цели, условия и ожидаемые результаты на русском языке (минимум 40 символов).");
      setActiveLocale("ru");
      return;
    }

    // Kazakh validation (mandatory)
    if (!titles.kk.trim() || titles.kk.trim().length < 3) {
      e.preventDefault();
      setErrorMsg("Укажите название предложения на казахском языке (минимум 3 символа).");
      setActiveLocale("kk");
      return;
    }
    if (!slugs.kk.trim() || !slugRegex.test(slugs.kk.trim()) || slugs.kk.trim().length < 2) {
      e.preventDefault();
      setErrorMsg("URL slug (KK) должен содержать строчные латинские буквы, цифры и дефисы (от 2 символов).");
      setActiveLocale("kk");
      return;
    }
    if (!summaries.kk.trim() || summaries.kk.trim().length < 20) {
      e.preventDefault();
      setErrorMsg("Укажите краткое описание на казахском языке (минимум 20 символов).");
      setActiveLocale("kk");
      return;
    }
    if (!descriptions.kk.trim() || descriptions.kk.trim().length < 40) {
      e.preventDefault();
      setErrorMsg("Укажите цели, условия и ожидаемые результаты на казахском языке (минимум 40 символов).");
      setActiveLocale("kk");
      return;
    }

    // English validation (optional, but if any field is filled, all must meet requirements)
    const hasEn =
      titles.en.trim() || slugs.en.trim() || summaries.en.trim() || descriptions.en.trim();
    if (hasEn) {
      if (!titles.en.trim() || titles.en.trim().length < 3) {
        e.preventDefault();
        setErrorMsg("Для английской версии название должно содержать от 3 символов.");
        setActiveLocale("en");
        return;
      }
      if (!slugs.en.trim() || !slugRegex.test(slugs.en.trim()) || slugs.en.trim().length < 2) {
        e.preventDefault();
        setErrorMsg("URL slug (EN) должен содержать строчные латинские буквы, цифры и дефисы (от 2 символов).");
        setActiveLocale("en");
        return;
      }
      if (!summaries.en.trim() || summaries.en.trim().length < 20) {
        e.preventDefault();
        setErrorMsg("Для английской версии краткое описание должно содержать от 20 символов.");
        setActiveLocale("en");
        return;
      }
      if (!descriptions.en.trim() || descriptions.en.trim().length < 40) {
        e.preventDefault();
        setErrorMsg("Для английской версии цели и условия должны содержать от 40 символов.");
        setActiveLocale("en");
        return;
      }
    }
  };

  return (
    <form
      action={async (formData) => {
        setPending(true);
        setErrorMsg("");
        try {
          await action(formData);
        } catch (e: any) {
          if (e?.message?.includes("NEXT_REDIRECT") || e?.message?.includes("redirect:")) {
            throw e;
          }
          setErrorMsg("Произошла ошибка при сохранении предложения наставничества.");
          setPending(false);
        }
      }}
      onSubmit={validateForm}
      className="article-form wp-editor-form"
    >
      {errorMsg ? (
        <div role="alert" className="notice error-notice" style={{ marginBottom: "16px" }}>
          {errorMsg}
        </div>
      ) : null}

      {/* TOPBAR: Language Tabs & Submit Button */}
      <div className="wp-editor-topbar">
        <div className="wp-topbar-left">
          <div className="wp-lang-tabs" role="tablist" aria-label="Языковые версии предложения">
            <button
              type="button"
              role="tab"
              disabled={pending}
              aria-selected={activeLocale === "ru"}
              className={`wp-lang-tab ${activeLocale === "ru" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("ru")}
            >
              <span
                className={`wp-tab-dot ${
                  titles.ru.trim() && summaries.ru.trim() && descriptions.ru.trim()
                    ? "is-filled"
                    : ""
                }`}
              />
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
              <span
                className={`wp-tab-dot ${
                  titles.kk.trim() && summaries.kk.trim() && descriptions.kk.trim()
                    ? "is-filled"
                    : ""
                }`}
              />
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
              <span
                className={`wp-tab-dot ${
                  titles.en.trim() && summaries.en.trim() && descriptions.en.trim()
                    ? "is-filled"
                    : ""
                }`}
              />
              English <small className="wp-tab-optional">необяз.</small>
            </button>
          </div>
        </div>

        <div className="wp-topbar-right">
          {offer ? (
            <span className={`status-badge status-${offer.status}`} style={{ fontSize: "12px", padding: "4px 10px" }}>
              {mentorshipStatusLabels[offer.status]}
            </span>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="primary-button wp-submit-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Save size={16} aria-hidden="true" />
            <span>{pending ? "Сохранение…" : submitLabel}</span>
          </button>
        </div>
      </div>

      {/* WORKSPACE: 2 COLUMNS */}
      <div className="wp-editor-workspace">
        {/* MAIN COLUMN */}
        <div className="wp-editor-main">
          {(["ru", "kk", "en"] as const).map((locale) => {
            const suffix = locale === "ru" ? "Ru" : locale === "kk" ? "Kk" : "En";
            const isMandatory = locale !== "en";

            return (
              <div
                key={locale}
                style={{ display: activeLocale === locale ? "block" : "none" }}
              >
                <div className="wp-editor-content-box">
                  {/* TITLE */}
                  <div className="wp-title-section">
                    <label className="wp-field-label" htmlFor={`field-title-${locale}`}>
                      Название предложения ({locale.toUpperCase()}){" "}
                      {isMandatory ? (
                        <span style={{ color: "#e11d48" }}>*</span>
                      ) : (
                        <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                      )}
                    </label>
                    <input
                      id={`field-title-${locale}`}
                      name={`title${suffix}`}
                      value={titles[locale]}
                      maxLength={240}
                      className="wp-title-input"
                      disabled={pending}
                      placeholder={
                        locale === "ru"
                          ? "Например: Программа наставничества по геоэкологии и гидробиологии..."
                          : locale === "kk"
                          ? "Мысалы: Геоэкология және гидробиология бойынша тәлімгерлік бағдарламасы..."
                          : "E.g., Mentorship program in geoecology and hydrobiology..."
                      }
                      onChange={(e) => handleTitleChange(locale, e.target.value)}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: "6px",
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      <span>
                        {isMandatory
                          ? "Минимум 3 символа, максимум 240"
                          : "Для публикации на английском языке"}
                      </span>
                      <span>{titles[locale].length}/240</span>
                    </div>
                  </div>

                  {/* SLUG */}
                  <div className="wp-slug-section" style={{ marginTop: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label className="wp-field-label" htmlFor={`field-slug-${locale}`}>
                        URL slug ({locale.toUpperCase()}){" "}
                        {isMandatory ? (
                          <span style={{ color: "#e11d48" }}>*</span>
                        ) : (
                          <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => handleRegenerateSlug(locale)}
                        className="button-link"
                        style={{
                          fontSize: "12px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "var(--forest-bright)",
                        }}
                      >
                        <RotateCcw size={12} aria-hidden="true" />
                        <span>Сгенерировать из названия</span>
                      </button>
                    </div>
                    <div style={{ position: "relative", marginTop: "4px" }}>
                      <input
                        id={`field-slug-${locale}`}
                        name={`slug${suffix}`}
                        value={slugs[locale]}
                        maxLength={160}
                        disabled={pending}
                        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                        placeholder={
                          locale === "ru"
                            ? "geoecology-mentorship"
                            : locale === "kk"
                            ? "geoekologiya-talimgerlik"
                            : "geoecology-mentorship-en"
                        }
                        onChange={(e) => handleSlugChange(locale, e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          fontFamily: "monospace",
                          fontSize: "13px",
                        }}
                      />
                    </div>
                    <p style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>
                      Латинские буквы, цифры и дефисы (от 2 до 160 символов).
                    </p>
                  </div>

                  {/* SUMMARY */}
                  <div className="wp-excerpt-section" style={{ marginTop: "20px" }}>
                    <label htmlFor={`field-summary-${locale}`}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span className="wp-field-label">
                          Краткое описание ({locale.toUpperCase()}){" "}
                          {isMandatory ? (
                            <span style={{ color: "#e11d48" }}>*</span>
                          ) : (
                            <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                          )}
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {summaries[locale].length} / 800
                        </span>
                      </div>
                      <textarea
                        id={`field-summary-${locale}`}
                        name={`summary${suffix}`}
                        rows={3}
                        maxLength={800}
                        className="wp-excerpt-textarea"
                        disabled={pending}
                        placeholder={
                          locale === "ru"
                            ? "Краткое описание программы наставничества для карточки в каталоге (от 20 до 800 символов)..."
                            : locale === "kk"
                            ? "Каталог карточкасына арналған тәлімгерлік бағдарламасының қысқаша сипаттамасы (20-дан 800 таңбаға дейін)..."
                            : "Brief description of the mentorship program for catalog cards (20 to 800 characters)..."
                        }
                        value={summaries[locale]}
                        onChange={(e) =>
                          setSummaries((prev) => ({ ...prev, [locale]: e.target.value }))
                        }
                      />
                    </label>
                    <p className="wp-field-hint" style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>
                      {isMandatory ? "Минимум 20 символов." : "Минимум 20 символов, если поле заполнено."}
                    </p>
                  </div>

                  {/* DESCRIPTION / GOALS & CONDITIONS */}
                  <div className="wp-excerpt-section" style={{ marginTop: "20px" }}>
                    <label htmlFor={`field-desc-${locale}`}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span className="wp-field-label">
                          Цели, условия и ожидаемые результаты ({locale.toUpperCase()}){" "}
                          {isMandatory ? (
                            <span style={{ color: "#e11d48" }}>*</span>
                          ) : (
                            <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                          )}
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {descriptions[locale].length} / 20000
                        </span>
                      </div>
                      <textarea
                        id={`field-desc-${locale}`}
                        name={`description${suffix}`}
                        rows={10}
                        maxLength={20000}
                        className="wp-excerpt-textarea"
                        disabled={pending}
                        placeholder={
                          locale === "ru"
                            ? "Подробно опишите требования к участникам, план совместной работы, график встреч и ожидаемый результат..."
                            : locale === "kk"
                            ? "Қатысушыларға қойылатын талаптарды, бірлескен жұмыс жоспарын, кездесулер кестесін және күтілетін нәтижені егжей-тегжейлі сипаттаңыз..."
                            : "Describe requirements for participants, collaboration plan, schedule, and expected outcomes..."
                        }
                        value={descriptions[locale]}
                        onChange={(e) =>
                          setDescriptions((prev) => ({ ...prev, [locale]: e.target.value }))
                        }
                      />
                    </label>
                    <p className="wp-field-hint" style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>
                      {isMandatory ? "Минимум 40 символов." : "Минимум 40 символов, если поле заполнено."}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* SIDEBAR COLUMN */}
        <aside className="wp-editor-sidebar">
          {/* MENTORSHIP CONDITIONS */}
          <section className="article-editor-panel wp-editor-content-box">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <HandHeart size={18} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 650 }}>Условия участия</h2>
            </div>

            {/* MENTOR / SCIENTIST */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="mentorship-scientistId"
                className="wp-field-label"
                style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}
              >
                <UserCheck size={14} aria-hidden="true" />
                <span>Наставник <span style={{ color: "#e11d48" }}>*</span></span>
              </label>

              {options.scientists.length > 8 ? (
                <div style={{ marginBottom: "6px", position: "relative" }}>
                  <input
                    type="search"
                    placeholder="Фильтр учёных..."
                    value={scientistQuery}
                    onChange={(e) => setScientistQuery(e.target.value)}
                    style={{ width: "100%", fontSize: "12px", padding: "4px 8px" }}
                  />
                </div>
              ) : null}

              <select
                id="mentorship-scientistId"
                name="scientistId"
                value={scientistId}
                disabled={pending}
                onChange={(e) => setScientistId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: "14px" }}
              >
                <option value="">Выберите учёного</option>
                {filteredScientists.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                {offer && !options.scientists.some((item) => item.id === offer.scientistId) ? (
                  <option value={offer.scientistId}>Профиль недоступен — выберите другой</option>
                ) : null}
              </select>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                Верифицированный профиль учёного.
              </p>
            </div>

            {/* FIELD / TAXONOMY */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="mentorship-fieldId"
                className="wp-field-label"
                style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}
              >
                <Layers size={14} aria-hidden="true" />
                <span>Научное направление <span style={{ color: "#e11d48" }}>*</span></span>
              </label>
              <select
                id="mentorship-fieldId"
                name="fieldId"
                value={fieldId}
                disabled={pending}
                onChange={(e) => setFieldId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: "14px" }}
              >
                <option value="">Выберите направление</option>
                {options.fields.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nameRu}
                  </option>
                ))}
                {offer && !options.fields.some((item) => item.id === offer.fieldId) ? (
                  <option value={offer.fieldId}>Направление недоступно — выберите другое</option>
                ) : null}
              </select>
            </div>

            {/* FORMAT */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="mentorship-format"
                className="wp-field-label"
                style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}
              >
                <Globe size={14} aria-hidden="true" />
                <span>Формат наставничества <span style={{ color: "#e11d48" }}>*</span></span>
              </label>
              <select
                id="mentorship-format"
                name="format"
                value={format}
                disabled={pending}
                onChange={(e) => setFormat(e.target.value as MentorshipFormat)}
                style={{ width: "100%", padding: "8px 10px", fontSize: "14px" }}
              >
                {mentorshipFormats.map((f) => (
                  <option key={f} value={f}>
                    {mentorshipFormatLabels.ru[f]}
                  </option>
                ))}
              </select>
            </div>

            {/* CAPACITY */}
            <div>
              <label
                htmlFor="mentorship-capacity"
                className="wp-field-label"
                style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}
              >
                <Users size={14} aria-hidden="true" />
                <span>Мест одновременно <span style={{ color: "#e11d48" }}>*</span></span>
              </label>
              <input
                id="mentorship-capacity"
                name="capacity"
                type="number"
                min={1}
                max={50}
                value={capacity}
                disabled={pending}
                onChange={(e) => setCapacity(Number.parseInt(e.target.value, 10) || 1)}
                style={{ width: "100%", padding: "8px 10px", fontSize: "14px" }}
              />
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                Принятые заявки занимают места до завершения наставничества (от 1 до 50).
              </p>
            </div>
          </section>

          {/* PUBLICATION STATUS & INFO */}
          {offer ? (
            <section className="article-editor-panel wp-editor-content-box" style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Info size={16} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 650 }}>Статус предложения</h3>
              </div>
              <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#475569" }}>
                Текущий статус:{" "}
                <span className={`status-badge status-${offer.status}`} style={{ fontSize: "12px" }}>
                  {mentorshipStatusLabels[offer.status]}
                </span>
              </p>
              <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b", lineHeight: 1.4 }}>
                С активными заявками нельзя заменить наставника. Сохранение изменений переводит опубликованное предложение обратно в черновик для перепроверки.
              </p>
              {offer.status === "published" ? (
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px", marginTop: "10px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#334155", margin: "0 0 6px" }}>
                    Просмотр на сайте:
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {offer.translations.map((t) => (
                      <Link
                        key={t.locale}
                        href={`/${t.locale}/mentorship/${t.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: "12px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "var(--forest-bright)",
                        }}
                      >
                        <ExternalLink size={12} aria-hidden="true" />
                        <span>Открыть {t.locale.toUpperCase()} нұсқасын</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>
    </form>
  );
}
