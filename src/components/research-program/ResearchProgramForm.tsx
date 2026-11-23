"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ExternalLink,
  Globe,
  Info,
  Layers,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { generateSlug } from "@/lib/articles/slug";
import {
  researchProgramFormatLabels,
  researchProgramStatusLabels,
} from "@/lib/research-program";
import {
  researchProgramFormats,
  type ResearchProgram,
  type ResearchProgramFormat,
} from "@/types/domain/research-program";
import type { ScienceWorkOptions } from "@/types/domain/science-work";

type Props = {
  action: (form: FormData) => Promise<void>;
  program?: ResearchProgram;
  options: ScienceWorkOptions;
  submitLabel?: string;
};

export function ResearchProgramForm({
  action,
  program,
  options,
  submitLabel = program ? "Сохранить программу" : "Создать программу",
}: Props) {
  const [activeLocale, setActiveLocale] = useState<"ru" | "kk" | "en">("ru");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const ru = program?.translations.find((item) => item.locale === "ru");
  const kk = program?.translations.find((item) => item.locale === "kk");
  const en = program?.translations.find((item) => item.locale === "en");

  // Translation states
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

  const [curriculums, setCurriculums] = useState({
    ru: ru?.curriculum ?? "",
    kk: kk?.curriculum ?? "",
    en: en?.curriculum ?? "",
  });

  const [eligibilities, setEligibilities] = useState({
    ru: ru?.eligibility ?? "",
    kk: kk?.eligibility ?? "",
    en: en?.eligibility ?? "",
  });

  const [outcomes, setOutcomes] = useState({
    ru: ru?.outcomes ?? "",
    kk: kk?.outcomes ?? "",
    en: en?.outcomes ?? "",
  });

  // Settings
  const [coordinatorId, setCoordinatorId] = useState(program?.coordinatorId ?? "");
  const [fieldId, setFieldId] = useState(program?.fieldId ?? "");
  const [format, setFormat] = useState<ResearchProgramFormat>(program?.format ?? "online");
  const [capacity, setCapacity] = useState(program?.capacity ?? 20);

  // Dates
  const [applicationsOpenOn, setApplicationsOpenOn] = useState(program?.applicationsOpenOn ?? "");
  const [applicationDeadline, setApplicationDeadline] = useState(program?.applicationDeadline ?? "");
  const [startsOn, setStartsOn] = useState(program?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(program?.endsOn ?? "");

  // Coordinator search
  const [coordinatorQuery, setCoordinatorQuery] = useState("");
  const filteredScientists = options.scientists.filter((s) =>
    !coordinatorQuery.trim() || s.name.toLowerCase().includes(coordinatorQuery.toLowerCase())
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

    if (!coordinatorId) {
      e.preventDefault();
      setErrorMsg("Выберите координатора программы из списка учёных.");
      return;
    }

    if (!fieldId) {
      e.preventDefault();
      setErrorMsg("Выберите научное направление.");
      return;
    }

    if (capacity < 1 || capacity > 500) {
      e.preventDefault();
      setErrorMsg("Количество мест в наборе должно быть от 1 до 500.");
      return;
    }

    // Dates validation
    if (!applicationsOpenOn || !applicationDeadline || !startsOn || !endsOn) {
      e.preventDefault();
      setErrorMsg("Заполните все четыре даты: открытие набора, дедлайн, начало и завершение программы.");
      return;
    }

    if (
      applicationsOpenOn > applicationDeadline ||
      applicationDeadline > startsOn ||
      startsOn > endsOn
    ) {
      e.preventDefault();
      setErrorMsg(
        "Проверьте хронологию дат: Открытие набора ≤ Дедлайн подачи ≤ Начало программы ≤ Завершение программы."
      );
      return;
    }

    // Russian validation (mandatory)
    if (!titles.ru.trim() || titles.ru.trim().length < 3) {
      e.preventDefault();
      setErrorMsg("Укажите название программы на русском языке (минимум 3 символа).");
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
      setErrorMsg("Укажите описание и цели программы на русском языке (минимум 40 символов).");
      setActiveLocale("ru");
      return;
    }
    if (!curriculums.ru.trim() || curriculums.ru.trim().length < 20) {
      e.preventDefault();
      setErrorMsg("Укажите план занятий и этапы на русском языке (минимум 20 символов).");
      setActiveLocale("ru");
      return;
    }
    if (!eligibilities.ru.trim() || eligibilities.ru.trim().length < 20) {
      e.preventDefault();
      setErrorMsg("Укажите требования к участникам на русском языке (минимум 20 символов).");
      setActiveLocale("ru");
      return;
    }
    if (!outcomes.ru.trim() || outcomes.ru.trim().length < 20) {
      e.preventDefault();
      setErrorMsg("Укажите ожидаемые результаты на русском языке (минимум 20 символов).");
      setActiveLocale("ru");
      return;
    }

    // Kazakh validation (mandatory)
    if (!titles.kk.trim() || titles.kk.trim().length < 3) {
      e.preventDefault();
      setErrorMsg("Укажите название программы на казахском языке (минимум 3 символа).");
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
      setErrorMsg("Укажите описание и цели программы на казахском языке (минимум 40 символов).");
      setActiveLocale("kk");
      return;
    }
    if (!curriculums.kk.trim() || curriculums.kk.trim().length < 20) {
      e.preventDefault();
      setErrorMsg("Укажите план занятий и этапы на казахском языке (минимум 20 символов).");
      setActiveLocale("kk");
      return;
    }
    if (!eligibilities.kk.trim() || eligibilities.kk.trim().length < 20) {
      e.preventDefault();
      setErrorMsg("Укажите требования к участникам на казахском языке (минимум 20 символов).");
      setActiveLocale("kk");
      return;
    }
    if (!outcomes.kk.trim() || outcomes.kk.trim().length < 20) {
      e.preventDefault();
      setErrorMsg("Укажите ожидаемые результаты на казахском языке (минимум 20 символов).");
      setActiveLocale("kk");
      return;
    }

    // English validation (optional, but if any field is filled, all must meet requirements)
    const hasEn =
      titles.en.trim() ||
      slugs.en.trim() ||
      summaries.en.trim() ||
      descriptions.en.trim() ||
      curriculums.en.trim() ||
      eligibilities.en.trim() ||
      outcomes.en.trim();

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
        setErrorMsg("Для английской версии цели должны содержать от 40 символов.");
        setActiveLocale("en");
        return;
      }
      if (!curriculums.en.trim() || curriculums.en.trim().length < 20) {
        e.preventDefault();
        setErrorMsg("Для английской версии план занятий должен содержать от 20 символов.");
        setActiveLocale("en");
        return;
      }
      if (!eligibilities.en.trim() || eligibilities.en.trim().length < 20) {
        e.preventDefault();
        setErrorMsg("Для английской версии требования должны содержать от 20 символов.");
        setActiveLocale("en");
        return;
      }
      if (!outcomes.en.trim() || outcomes.en.trim().length < 20) {
        e.preventDefault();
        setErrorMsg("Для английской версии результаты должны содержать от 20 символов.");
        setActiveLocale("en");
        return;
      }
    }
  };

  const isRuComplete =
    titles.ru.trim() &&
    summaries.ru.trim() &&
    descriptions.ru.trim() &&
    curriculums.ru.trim() &&
    eligibilities.ru.trim() &&
    outcomes.ru.trim();

  const isKkComplete =
    titles.kk.trim() &&
    summaries.kk.trim() &&
    descriptions.kk.trim() &&
    curriculums.kk.trim() &&
    eligibilities.kk.trim() &&
    outcomes.kk.trim();

  const isEnComplete =
    titles.en.trim() &&
    summaries.en.trim() &&
    descriptions.en.trim() &&
    curriculums.en.trim() &&
    eligibilities.en.trim() &&
    outcomes.en.trim();

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
          setErrorMsg("Произошла ошибка при сохранении исследовательской программы.");
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
          <div className="wp-lang-tabs" role="tablist" aria-label="Языковые версии программы">
            <button
              type="button"
              role="tab"
              disabled={pending}
              aria-selected={activeLocale === "ru"}
              className={`wp-lang-tab ${activeLocale === "ru" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("ru")}
            >
              <span className={`wp-tab-dot ${isRuComplete ? "is-filled" : ""}`} />
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
              <span className={`wp-tab-dot ${isKkComplete ? "is-filled" : ""}`} />
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
              <span className={`wp-tab-dot ${isEnComplete ? "is-filled" : ""}`} />
              English <small className="wp-tab-optional">необяз.</small>
            </button>
          </div>
        </div>

        <div className="wp-topbar-right">
          {program ? (
            <span
              className={`status-badge status-${program.status}`}
              style={{ fontSize: "12px", padding: "4px 10px" }}
            >
              {researchProgramStatusLabels[program.status]}
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
                    <label className="wp-field-label" htmlFor={`program-title-${locale}`}>
                      Название программы ({locale.toUpperCase()}){" "}
                      {isMandatory ? (
                        <span style={{ color: "#e11d48" }}>*</span>
                      ) : (
                        <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                      )}
                    </label>
                    <input
                      id={`program-title-${locale}`}
                      name={`title${suffix}`}
                      value={titles[locale]}
                      maxLength={240}
                      className="wp-title-input"
                      disabled={pending}
                      placeholder={
                        locale === "ru"
                          ? "Например: Программа поддержки междисциплинарных гидроэкологических исследований..."
                          : locale === "kk"
                          ? "Мысалы: Пәнаралық гидроэкологиялық зерттеулерді қолдау бағдарламасы..."
                          : "E.g., Interdisciplinary Hydroecological Research Program..."
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
                      <label className="wp-field-label" htmlFor={`program-slug-${locale}`}>
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
                        id={`program-slug-${locale}`}
                        name={`slug${suffix}`}
                        value={slugs[locale]}
                        maxLength={160}
                        disabled={pending}
                        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                        placeholder={
                          locale === "ru"
                            ? "hydroecology-research-program"
                            : locale === "kk"
                            ? "gidroekologiya-zertteu-bagdarlamasy"
                            : "hydroecology-research-program-en"
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
                    <label htmlFor={`program-summary-${locale}`}>
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
                        id={`program-summary-${locale}`}
                        name={`summary${suffix}`}
                        rows={3}
                        maxLength={800}
                        className="wp-excerpt-textarea"
                        disabled={pending}
                        placeholder={
                          locale === "ru"
                            ? "Краткое резюме программы для каталога и карточек (от 20 до 800 символов)..."
                            : locale === "kk"
                            ? "Каталог пен карточкаларға арналған бағдарламаның қысқаша түйіндемесі (20-дан 800 таңбаға дейін)..."
                            : "Brief summary of the program for catalog and cards (20 to 800 characters)..."
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

                  {/* DESCRIPTION & GOALS */}
                  <div className="wp-excerpt-section" style={{ marginTop: "20px" }}>
                    <label htmlFor={`program-desc-${locale}`}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span className="wp-field-label">
                          Описание и цели программы ({locale.toUpperCase()}){" "}
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
                        id={`program-desc-${locale}`}
                        name={`description${suffix}`}
                        rows={6}
                        maxLength={20000}
                        className="wp-excerpt-textarea"
                        disabled={pending}
                        placeholder={
                          locale === "ru"
                            ? "Подробное описание программы, её научной значимости и ключевых задач..."
                            : locale === "kk"
                            ? "Бағдарламаның, оның ғылыми маңыздылығының және негізгі міндеттерінің егжей-тегжейлі сипаттамасы..."
                            : "Detailed description of the program, its scientific value, and core objectives..."
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

                  {/* CURRICULUM & STAGES */}
                  <div className="wp-excerpt-section" style={{ marginTop: "20px" }}>
                    <label htmlFor={`program-curr-${locale}`}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span className="wp-field-label">
                          План занятий и этапы ({locale.toUpperCase()}){" "}
                          {isMandatory ? (
                            <span style={{ color: "#e11d48" }}>*</span>
                          ) : (
                            <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                          )}
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {curriculums[locale].length} / 10000
                        </span>
                      </div>
                      <textarea
                        id={`program-curr-${locale}`}
                        name={`curriculum${suffix}`}
                        rows={6}
                        maxLength={10000}
                        className="wp-excerpt-textarea"
                        disabled={pending}
                        placeholder={
                          locale === "ru"
                            ? "Модули программы, расписание семинаров, полевые исследования и контрольные точки..."
                            : locale === "kk"
                            ? "Бағдарлама модульдері, семинарлар кестесі, далалық зерттеулер және бақылау кезеңдері..."
                            : "Program modules, seminar schedule, field research, and milestones..."
                        }
                        value={curriculums[locale]}
                        onChange={(e) =>
                          setCurriculums((prev) => ({ ...prev, [locale]: e.target.value }))
                        }
                      />
                    </label>
                    <p className="wp-field-hint" style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>
                      {isMandatory ? "Минимум 20 символов." : "Минимум 20 символов, если поле заполнено."}
                    </p>
                  </div>

                  {/* ELIGIBILITY */}
                  <div className="wp-excerpt-section" style={{ marginTop: "20px" }}>
                    <label htmlFor={`program-elig-${locale}`}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span className="wp-field-label">
                          Требования к участникам ({locale.toUpperCase()}){" "}
                          {isMandatory ? (
                            <span style={{ color: "#e11d48" }}>*</span>
                          ) : (
                            <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                          )}
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {eligibilities[locale].length} / 5000
                        </span>
                      </div>
                      <textarea
                        id={`program-elig-${locale}`}
                        name={`eligibility${suffix}`}
                        rows={4}
                        maxLength={5000}
                        className="wp-excerpt-textarea"
                        disabled={pending}
                        placeholder={
                          locale === "ru"
                            ? "Кто может участвовать: образование, специализация, академический статус, владение методами..."
                            : locale === "kk"
                            ? "Кім қатыса алады: білімі, мамандығы, академиялық мәртебесі, әдістерді меңгеруі..."
                            : "Eligibility: education level, field, academic background, prerequisite skills..."
                        }
                        value={eligibilities[locale]}
                        onChange={(e) =>
                          setEligibilities((prev) => ({ ...prev, [locale]: e.target.value }))
                        }
                      />
                    </label>
                    <p className="wp-field-hint" style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>
                      {isMandatory ? "Минимум 20 символов." : "Минимум 20 символов, если поле заполнено."}
                    </p>
                  </div>

                  {/* OUTCOMES */}
                  <div className="wp-excerpt-section" style={{ marginTop: "20px" }}>
                    <label htmlFor={`program-outcomes-${locale}`}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span className="wp-field-label">
                          Ожидаемые результаты ({locale.toUpperCase()}){" "}
                          {isMandatory ? (
                            <span style={{ color: "#e11d48" }}>*</span>
                          ) : (
                            <small style={{ color: "#94a3b8", fontWeight: "normal" }}>необязательно</small>
                          )}
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          {outcomes[locale].length} / 10000
                        </span>
                      </div>
                      <textarea
                        id={`program-outcomes-${locale}`}
                        name={`outcomes${suffix}`}
                        rows={4}
                        maxLength={10000}
                        className="wp-excerpt-textarea"
                        disabled={pending}
                        placeholder={
                          locale === "ru"
                            ? "Научные публикации, отчёты, патенты, проектные заявки или сертификаты участников..."
                            : locale === "kk"
                            ? "Ғылыми жарияланымдар, есептер, патенттер, жобалық өтінімдер немесе сертификаттар..."
                            : "Publications, reports, patents, project proposals, or completion certificates..."
                        }
                        value={outcomes[locale]}
                        onChange={(e) =>
                          setOutcomes((prev) => ({ ...prev, [locale]: e.target.value }))
                        }
                      />
                    </label>
                    <p className="wp-field-hint" style={{ marginTop: "4px", fontSize: "12px", color: "#64748b" }}>
                      {isMandatory ? "Минимум 20 символов." : "Минимум 20 символов, если поле заполнено."}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* SIDEBAR COLUMN */}
        <aside className="wp-editor-sidebar">
          {/* PROGRAM SETTINGS */}
          <section className="article-editor-panel wp-editor-content-box">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Sparkles size={18} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 650 }}>Параметры программы</h2>
            </div>

            {/* COORDINATOR */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="program-coordinatorId"
                className="wp-field-label"
                style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}
              >
                <UserCheck size={14} aria-hidden="true" />
                <span>Координатор <span style={{ color: "#e11d48" }}>*</span></span>
              </label>

              {options.scientists.length > 8 ? (
                <div style={{ marginBottom: "6px" }}>
                  <input
                    type="search"
                    placeholder="Фильтр учёных..."
                    value={coordinatorQuery}
                    onChange={(e) => setCoordinatorQuery(e.target.value)}
                    style={{ width: "100%", fontSize: "12px", padding: "4px 8px" }}
                  />
                </div>
              ) : null}

              <select
                id="program-coordinatorId"
                name="coordinatorId"
                value={coordinatorId}
                disabled={pending}
                onChange={(e) => setCoordinatorId(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", fontSize: "14px" }}
              >
                <option value="">Выберите координатора</option>
                {filteredScientists.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
                {program && !options.scientists.some((item) => item.id === program.coordinatorId) ? (
                  <option value={program.coordinatorId}>Профиль недоступен — выберите другой</option>
                ) : null}
              </select>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                Верифицированный профиль учёного.
              </p>
            </div>

            {/* FIELD */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="program-fieldId"
                className="wp-field-label"
                style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}
              >
                <Layers size={14} aria-hidden="true" />
                <span>Научное направление <span style={{ color: "#e11d48" }}>*</span></span>
              </label>
              <select
                id="program-fieldId"
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
                {program && !options.fields.some((item) => item.id === program.fieldId) ? (
                  <option value={program.fieldId}>Направление недоступно — выберите другое</option>
                ) : null}
              </select>
            </div>

            {/* FORMAT */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="program-format"
                className="wp-field-label"
                style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}
              >
                <Globe size={14} aria-hidden="true" />
                <span>Формат проведения <span style={{ color: "#e11d48" }}>*</span></span>
              </label>
              <select
                id="program-format"
                name="format"
                value={format}
                disabled={pending}
                onChange={(e) => setFormat(e.target.value as ResearchProgramFormat)}
                style={{ width: "100%", padding: "8px 10px", fontSize: "14px" }}
              >
                {researchProgramFormats.map((f) => (
                  <option key={f} value={f}>
                    {researchProgramFormatLabels.ru[f]}
                  </option>
                ))}
              </select>
            </div>

            {/* CAPACITY */}
            <div>
              <label
                htmlFor="program-capacity"
                className="wp-field-label"
                style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}
              >
                <Users size={14} aria-hidden="true" />
                <span>Мест в наборе <span style={{ color: "#e11d48" }}>*</span></span>
              </label>
              <input
                id="program-capacity"
                name="capacity"
                type="number"
                min={1}
                max={500}
                value={capacity}
                disabled={pending}
                onChange={(e) => setCapacity(Number.parseInt(e.target.value, 10) || 1)}
                style={{ width: "100%", padding: "8px 10px", fontSize: "14px" }}
              />
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                Принятые и завершившие участие заявки учитываются в лимите набора (1–500).
              </p>
            </div>
          </section>

          {/* DATES & TIMELINE */}
          <section className="article-editor-panel wp-editor-content-box" style={{ marginTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Calendar size={18} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 650 }}>Сроки набора и проведения</h2>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label htmlFor="program-applicationsOpenOn" className="wp-field-label" style={{ marginBottom: "4px" }}>
                Открытие набора <span style={{ color: "#e11d48" }}>*</span>
              </label>
              <input
                id="program-applicationsOpenOn"
                name="applicationsOpenOn"
                type="date"
                value={applicationsOpenOn}
                disabled={pending}
                onChange={(e) => setApplicationsOpenOn(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: "13px" }}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label htmlFor="program-applicationDeadline" className="wp-field-label" style={{ marginBottom: "4px" }}>
                Последний день подачи заявок <span style={{ color: "#e11d48" }}>*</span>
              </label>
              <input
                id="program-applicationDeadline"
                name="applicationDeadline"
                type="date"
                value={applicationDeadline}
                disabled={pending}
                onChange={(e) => setApplicationDeadline(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: "13px" }}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label htmlFor="program-startsOn" className="wp-field-label" style={{ marginBottom: "4px" }}>
                Начало программы <span style={{ color: "#e11d48" }}>*</span>
              </label>
              <input
                id="program-startsOn"
                name="startsOn"
                type="date"
                value={startsOn}
                disabled={pending}
                onChange={(e) => setStartsOn(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: "13px" }}
              />
            </div>

            <div>
              <label htmlFor="program-endsOn" className="wp-field-label" style={{ marginBottom: "4px" }}>
                Завершение программы <span style={{ color: "#e11d48" }}>*</span>
              </label>
              <input
                id="program-endsOn"
                name="endsOn"
                type="date"
                value={endsOn}
                disabled={pending}
                onChange={(e) => setEndsOn(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", fontSize: "13px" }}
              />
            </div>

            <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#64748b", lineHeight: 1.4 }}>
              Время — Актобе (UTC+5). Последний день подачи включён.
            </p>
          </section>

          {/* STATUS & PREVIEW */}
          {program ? (
            <section className="article-editor-panel wp-editor-content-box" style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <Info size={16} style={{ color: "var(--forest-bright)" }} aria-hidden="true" />
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 650 }}>Статус программы</h3>
              </div>
              <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#475569" }}>
                Текущий статус:{" "}
                <span className={`status-badge status-${program.status}`} style={{ fontSize: "12px" }}>
                  {researchProgramStatusLabels[program.status]}
                </span>
              </p>
              <p style={{ margin: "0 0 12px", fontSize: "12px", color: "#64748b", lineHeight: 1.4 }}>
                С активными заявками нельзя заменить координатора. Правки переводят программу в черновик.
              </p>
              {program.status === "published" ? (
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px", marginTop: "10px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#334155", margin: "0 0 6px" }}>
                    Просмотр на сайте:
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {program.translations.map((t) => (
                      <Link
                        key={t.locale}
                        href={`/${t.locale}/research-program/${t.slug}`}
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
                        <span>Открыть {t.locale.toUpperCase()}</span>
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
