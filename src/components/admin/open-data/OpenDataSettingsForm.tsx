"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Calendar,
  Database,
  FileSpreadsheet,
  Save,
} from "lucide-react";
import type { OpenDataSettingsRow } from "@/types/domain/open-data";
import {
  openDataErrorMessage,
  openDataInitiativeStatuses,
} from "@/lib/open-data-constants";
import { CustomSelect } from "@/components/articles/CustomSelect";
import { saveOpenDataSettingsAction } from "@/server/actions/open-data.actions";

type Stats = {
  totalMetrics: number;
  homepageMetrics: number;
  totalCategories: number;
  homepageCategories: number;
  totalUpdates: number;
  publishedUpdates: number;
};

type Props = {
  settings: OpenDataSettingsRow | null;
  stats?: Stats;
};

type ActionState = {
  error?: string;
  success?: boolean;
};

export function OpenDataSettingsForm({ settings, stats }: Props) {
  const [activeLocale, setActiveLocale] = useState<"ru" | "kk">("ru");
  const [clientError, setClientError] = useState<string | null>(null);

  const [titles, setTitles] = useState({
    ru: settings?.title_ru ?? "Open Data Aktobe",
    kk: settings?.title_kk ?? "Open Data Aktobe",
  });
  const [subtitles, setSubtitles] = useState({
    ru: settings?.subtitle_ru ?? "Данные сегодня — открытия завтра.",
    kk: settings?.subtitle_kk ?? "Бүгінгі деректер — ертеңгі жаңалықтар.",
  });
  const [shortDescriptions, setShortDescriptions] = useState({
    ru: settings?.short_description_ru ?? "",
    kk: settings?.short_description_kk ?? "",
  });
  const [descriptions, setDescriptions] = useState({
    ru: settings?.description_ru ?? "",
    kk: settings?.description_kk ?? "",
  });
  const [statusTexts, setStatusTexts] = useState({
    ru: settings?.status_text_ru ?? "Ведётся сбор и систематизация данных.",
    kk: settings?.status_text_kk ?? "Деректерді жинау және жүйелеу жұмыстары жүргізілуде.",
  });
  const [collaborationTexts, setCollaborationTexts] = useState({
    ru: settings?.collaboration_text_ru ?? "",
    kk: settings?.collaboration_text_kk ?? "",
  });

  const [isPublished, setIsPublished] = useState<boolean>(settings?.is_published ?? true);
  const [showOnHomepage, setShowOnHomepage] = useState<boolean>(
    settings?.show_on_homepage ?? true
  );
  const [status, setStatus] = useState<string>(settings?.status ?? "collecting");
  const [dataUpdatedAt, setDataUpdatedAt] = useState<string>(
    settings?.data_updated_at ?? new Date().toISOString().split("T")[0]
  );

  const [state, formAction, pending] = useActionState<ActionState, FormData>(async () => {
    setClientError(null);

    if (
      !titles.ru.trim() ||
      !subtitles.ru.trim() ||
      !shortDescriptions.ru.trim() ||
      !descriptions.ru.trim() ||
      !statusTexts.ru.trim() ||
      !collaborationTexts.ru.trim()
    ) {
      setActiveLocale("ru");
      setClientError("Заполните все обязательные текстовые поля на русском языке (RU).");
      return {};
    }

    if (
      !titles.kk.trim() ||
      !subtitles.kk.trim() ||
      !shortDescriptions.kk.trim() ||
      !descriptions.kk.trim() ||
      !statusTexts.kk.trim() ||
      !collaborationTexts.kk.trim()
    ) {
      setActiveLocale("kk");
      setClientError("Заполните все обязательные текстовые поля на казахском языке (KZ).");
      return {};
    }

    const payload = {
      title_ru: titles.ru.trim(),
      title_kk: titles.kk.trim(),
      subtitle_ru: subtitles.ru.trim(),
      subtitle_kk: subtitles.kk.trim(),
      short_description_ru: shortDescriptions.ru.trim(),
      short_description_kk: shortDescriptions.kk.trim(),
      description_ru: descriptions.ru.trim(),
      description_kk: descriptions.kk.trim(),
      status: status.trim() || "collecting",
      status_text_ru: statusTexts.ru.trim(),
      status_text_kk: statusTexts.kk.trim(),
      collaboration_text_ru: collaborationTexts.ru.trim(),
      collaboration_text_kk: collaborationTexts.kk.trim(),
      is_published: isPublished,
      show_on_homepage: showOnHomepage,
      data_updated_at: dataUpdatedAt,
    };

    return saveOpenDataSettingsAction(payload);
  }, {});

  const isRuFilled = Boolean(
    titles.ru.trim() &&
      subtitles.ru.trim() &&
      shortDescriptions.ru.trim() &&
      descriptions.ru.trim() &&
      statusTexts.ru.trim() &&
      collaborationTexts.ru.trim()
  );

  const isKkFilled = Boolean(
    titles.kk.trim() &&
      subtitles.kk.trim() &&
      shortDescriptions.kk.trim() &&
      descriptions.kk.trim() &&
      statusTexts.kk.trim() &&
      collaborationTexts.kk.trim()
  );

  const statusOptions = openDataInitiativeStatuses.some((opt) => opt.value === status)
    ? [...openDataInitiativeStatuses]
    : [...openDataInitiativeStatuses, { value: status, label: status }];

  const errorText = clientError ?? (state.error ? openDataErrorMessage(state.error) : null);

  return (
    <form action={formAction} className="article-form wp-editor-form">
      {errorText ? (
        <div role="alert" className="notice error-notice" style={{ marginBottom: 0 }}>
          {errorText}
        </div>
      ) : state.success ? (
        <div role="status" className="notice success-notice" style={{ marginBottom: 0 }}>
          Настройки Open Data Aktobe успешно сохранены.
        </div>
      ) : null}

      {/* Hidden inputs for semantics and standard form serialization */}
      <input type="hidden" name="status" value={status} />

      {/* TOPBAR */}
      <div className="wp-editor-topbar">
        <div className="wp-topbar-left">
          <div className="wp-lang-tabs" role="tablist" aria-label="Языковые версии настроек">
            <button
              type="button"
              role="tab"
              disabled={pending}
              aria-selected={activeLocale === "ru"}
              className={`wp-lang-tab ${activeLocale === "ru" ? "is-active" : ""}`}
              onClick={() => setActiveLocale("ru")}
            >
              <span className={`wp-tab-dot ${isRuFilled ? "is-filled" : ""}`} />
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
              <span className={`wp-tab-dot ${isKkFilled ? "is-filled" : ""}`} />
              Қазақша
            </button>
          </div>
        </div>

        <div className="wp-topbar-right">
          <span className={`status-badge ${isPublished ? "status-published" : "status-draft"}`}>
            {isPublished ? "Опубликовано" : "Скрыто"}
          </span>
          <button type="submit" className="primary-button wp-submit-btn" disabled={pending}>
            <Save size={16} aria-hidden="true" />
            <span>{pending ? "Сохранение…" : "Сохранить настройки"}</span>
          </button>
        </div>
      </div>

      {/* 2-COLUMN WORKSPACE */}
      <div className="wp-editor-workspace">
        {/* MAIN COLUMN */}
        <div className="wp-editor-main">
          {(["ru", "kk"] as const).map((locale) => {
            const langLabel = locale === "ru" ? "RU" : "KZ";
            return (
              <div
                key={locale}
                style={{
                  display: activeLocale === locale ? "flex" : "none",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                <div className="wp-editor-content-box">
                  <div className="wp-title-section">
                    <div className="opendata-field-header">
                      <label className="wp-field-label" htmlFor={`od-title-${locale}`}>
                        Заголовок инициативы ({langLabel}){" "}
                        <span className="opendata-required-star">*</span>
                      </label>
                      <span className="opendata-field-counter">
                        {titles[locale].length} / 200
                      </span>
                    </div>
                    <input
                      id={`od-title-${locale}`}
                      name={`title_${locale}`}
                      value={titles[locale]}
                      maxLength={200}
                      className="wp-title-input"
                      disabled={pending}
                      placeholder="Open Data Aktobe"
                      onChange={(e) =>
                        setTitles((prev) => ({ ...prev, [locale]: e.target.value }))
                      }
                    />
                  </div>

                  <div className="opendata-field-block" style={{ marginTop: "18px" }}>
                    <div className="opendata-field-header">
                      <label className="wp-field-label" htmlFor={`od-subtitle-${locale}`}>
                        Подзаголовок / слоган ({langLabel}){" "}
                        <span className="opendata-required-star">*</span>
                      </label>
                      <span className="opendata-field-counter">
                        {subtitles[locale].length} / 300
                      </span>
                    </div>
                    <input
                      id={`od-subtitle-${locale}`}
                      name={`subtitle_${locale}`}
                      value={subtitles[locale]}
                      maxLength={300}
                      className="opendata-field-input"
                      disabled={pending}
                      placeholder={
                        locale === "ru"
                          ? "Данные сегодня — открытия завтра."
                          : "Бүгінгі деректер — ертеңгі жаңалықтар."
                      }
                      onChange={(e) =>
                        setSubtitles((prev) => ({ ...prev, [locale]: e.target.value }))
                      }
                    />
                  </div>

                  <div className="wp-excerpt-section" style={{ marginTop: "18px" }}>
                    <label htmlFor={`od-short-${locale}`}>
                      <div className="opendata-field-header">
                        <span className="wp-field-label">
                          Краткое описание для главной страницы ({langLabel}){" "}
                          <span className="opendata-required-star">*</span>
                        </span>
                        <span className="opendata-field-counter">
                          {shortDescriptions[locale].length} / 2000
                        </span>
                      </div>
                      <textarea
                        id={`od-short-${locale}`}
                        name={`short_description_${locale}`}
                        rows={3}
                        maxLength={2000}
                        className="wp-excerpt-textarea"
                        disabled={pending}
                        value={shortDescriptions[locale]}
                        placeholder={
                          locale === "ru"
                            ? "Краткое описание инициативы для блока на главной странице..."
                            : "Басты беттегі блокқа арналған бастаманың қысқаша сипаттамасы..."
                        }
                        onChange={(e) =>
                          setShortDescriptions((prev) => ({
                            ...prev,
                            [locale]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="wp-excerpt-section" style={{ marginTop: "18px" }}>
                    <label htmlFor={`od-desc-${locale}`}>
                      <div className="opendata-field-header">
                        <span className="wp-field-label">
                          Полное описание для Hero страницы /open-data ({langLabel}){" "}
                          <span className="opendata-required-star">*</span>
                        </span>
                        <span className="opendata-field-counter">
                          {descriptions[locale].length} / 10000
                        </span>
                      </div>
                      <textarea
                        id={`od-desc-${locale}`}
                        name={`description_${locale}`}
                        rows={7}
                        maxLength={10000}
                        className="wp-excerpt-textarea"
                        disabled={pending}
                        value={descriptions[locale]}
                        placeholder={
                          locale === "ru"
                            ? "Подробное описание целей и этапов инициативы Open Data Aktobe..."
                            : "Open Data Aktobe бастамасының мақсаттары мен кезеңдерінің толық сипаттамасы..."
                        }
                        onChange={(e) =>
                          setDescriptions((prev) => ({ ...prev, [locale]: e.target.value }))
                        }
                      />
                    </label>
                    <p className="opendata-field-hint" style={{ marginTop: "6px" }}>
                      Разделяйте абзацы пустой строкой — форматирование сохранится на публичной странице.
                    </p>
                  </div>
                </div>

                <details className="wp-metabox-card" open>
                  <summary className="wp-metabox-header">
                    Статус инициативы и приглашение к сотрудничеству ({langLabel})
                  </summary>
                  <div className="wp-metabox-content">
                    <div className="opendata-field-block">
                      <div className="opendata-field-header">
                        <label className="wp-field-label" htmlFor={`od-status-text-${locale}`}>
                          Текст бейджа статуса ({langLabel}){" "}
                          <span className="opendata-required-star">*</span>
                        </label>
                        <span className="opendata-field-counter">
                          {statusTexts[locale].length} / 300
                        </span>
                      </div>
                      <input
                        id={`od-status-text-${locale}`}
                        name={`status_text_${locale}`}
                        value={statusTexts[locale]}
                        maxLength={300}
                        className="opendata-field-input"
                        disabled={pending}
                        placeholder={
                          locale === "ru"
                            ? "Ведётся сбор и систематизация данных."
                            : "Деректерді жинау және жүйелеу жұмыстары жүргізілуде."
                        }
                        onChange={(e) =>
                          setStatusTexts((prev) => ({ ...prev, [locale]: e.target.value }))
                        }
                      />
                    </div>

                    <div className="opendata-field-block">
                      <div className="opendata-field-header">
                        <label className="wp-field-label" htmlFor={`od-collab-${locale}`}>
                          Текст блока «Приглашение к сотрудничеству» ({langLabel}){" "}
                          <span className="opendata-required-star">*</span>
                        </label>
                        <span className="opendata-field-counter">
                          {collaborationTexts[locale].length} / 5000
                        </span>
                      </div>
                      <textarea
                        id={`od-collab-${locale}`}
                        name={`collaboration_text_${locale}`}
                        rows={4}
                        maxLength={5000}
                        className="wp-excerpt-textarea"
                        disabled={pending}
                        value={collaborationTexts[locale]}
                        placeholder={
                          locale === "ru"
                            ? "Приглашение для исследователей и организаций поделиться или запросить данные..."
                            : "Зерттеушілер мен ұйымдарды деректермен бөлісуге немесе сұратуға шақыру..."
                        }
                        onChange={(e) =>
                          setCollaborationTexts((prev) => ({
                            ...prev,
                            [locale]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </details>
              </div>
            );
          })}
        </div>

        {/* SIDEBAR */}
        <aside className="wp-editor-sidebar">
          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Публикация и отображение</summary>
            <div className="wp-sidebar-card-body">
              <label
                className={`wp-public-toggle-card ${isPublished ? "is-public" : "is-private"}`}
              >
                <input
                  type="checkbox"
                  name="is_published"
                  checked={isPublished}
                  disabled={pending}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="visually-hidden"
                />
                <span className="wp-public-toggle-indicator" aria-hidden="true" />
                <span className="wp-public-toggle-text">
                  <strong>Публикация страницы /open-data</strong>
                  <small>
                    {isPublished
                      ? "Страница открыта для всех посетителей сайта."
                      : "Страница скрыта с публичного сайта."}
                  </small>
                </span>
              </label>

              <label
                className={`wp-public-toggle-card ${showOnHomepage ? "is-public" : "is-private"}`}
              >
                <input
                  type="checkbox"
                  name="show_on_homepage"
                  checked={showOnHomepage}
                  disabled={pending}
                  onChange={(e) => setShowOnHomepage(e.target.checked)}
                  className="visually-hidden"
                />
                <span className="wp-public-toggle-indicator" aria-hidden="true" />
                <span className="wp-public-toggle-text">
                  <strong>Отображать блок на главной странице</strong>
                  <small>
                    {showOnHomepage
                      ? "Виджет Open Data виден на главной странице (при включённой публикации)."
                      : "Блок скрыт с главной страницы."}
                  </small>
                </span>
              </label>

              <button
                type="submit"
                className="primary-button wp-submit-btn"
                style={{ width: "100%", justifyContent: "center" }}
                disabled={pending}
              >
                <Save size={15} aria-hidden="true" />
                <span>{pending ? "Сохранение…" : "Сохранить настройки"}</span>
              </button>
            </div>
          </details>

          <details className="wp-sidebar-card" open>
            <summary className="wp-sidebar-card-header">Актуальность и этап</summary>
            <div className="wp-sidebar-card-body">
              <div className="wp-field-group">
                <label className="wp-field-label" htmlFor="od-updated-at">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <Calendar size={13} aria-hidden="true" />
                    Дата актуальности информации
                  </span>
                </label>
                <input
                  id="od-updated-at"
                  type="date"
                  name="data_updated_at"
                  value={dataUpdatedAt}
                  required
                  disabled={pending}
                  className="opendata-field-input"
                  onChange={(e) => setDataUpdatedAt(e.target.value)}
                />
              </div>

              <div className="wp-field-group">
                <span className="wp-field-label">Системный этап инициативы</span>
                <CustomSelect
                  value={status}
                  options={statusOptions}
                  onChange={setStatus}
                  disabled={pending}
                  ariaLabel="Системный этап инициативы"
                />
              </div>
            </div>
          </details>

          {stats ? (
            <details className="wp-sidebar-card" open>
              <summary className="wp-sidebar-card-header">Сводка и обращения</summary>
              <div className="wp-sidebar-card-body">
                <dl className="opendata-summary-list">
                  <div className="opendata-summary-row">
                    <dt>Показатели (на главной)</dt>
                    <dd style={{ margin: 0 }}>
                      <strong>
                        {stats.totalMetrics} ({stats.homepageMetrics}/4)
                      </strong>
                    </dd>
                  </div>
                  <div className="opendata-summary-row">
                    <dt>Категории (на главной)</dt>
                    <dd style={{ margin: 0 }}>
                      <strong>
                        {stats.totalCategories} ({stats.homepageCategories}/6)
                      </strong>
                    </dd>
                  </div>
                  <div className="opendata-summary-row">
                    <dt>Поступления (опубликовано)</dt>
                    <dd style={{ margin: 0 }}>
                      <strong>
                        {stats.totalUpdates} ({stats.publishedUpdates})
                      </strong>
                    </dd>
                  </div>
                </dl>

                <div className="opendata-quick-links">
                  <Link href="/admin/support/open_data_offer" className="opendata-quick-link">
                    <span>
                      <Database size={14} aria-hidden="true" />
                      Предложения данных
                    </span>
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                  <Link href="/admin/support/open_data_request" className="opendata-quick-link">
                    <span>
                      <FileSpreadsheet size={14} aria-hidden="true" />
                      Запросы данных
                    </span>
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </details>
          ) : null}
        </aside>
      </div>
    </form>
  );
}
