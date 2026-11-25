"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Calendar, Globe, Save } from "lucide-react";
import type {
  OpenDataCategoryRow,
  OpenDataUpdateWithCategory,
} from "@/types/domain/open-data";
import { openDataErrorMessage } from "@/lib/open-data-constants";
import { CustomSelect } from "@/components/articles/CustomSelect";
import {
  deleteOpenDataUpdateAction,
  saveOpenDataUpdateAction,
} from "@/server/actions/open-data.actions";
import { OpenDataDeleteZone } from "./OpenDataDeleteZone";

type Props = {
  update?: OpenDataUpdateWithCategory | null;
  categories: OpenDataCategoryRow[];
};

export function OpenDataUpdateForm({ update, categories }: Props) {
  const router = useRouter();
  const [activeLocale, setActiveLocale] = useState<"ru" | "kk">("ru");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [titles, setTitles] = useState({
    ru: update?.title_ru ?? "",
    kk: update?.title_kk ?? "",
  });
  const [descriptions, setDescriptions] = useState({
    ru: update?.description_ru ?? "",
    kk: update?.description_kk ?? "",
  });
  const [categoryId, setCategoryId] = useState(
    update?.category_id ?? categories[0]?.id ?? ""
  );
  const [sourceName, setSourceName] = useState(update?.source_name ?? "");
  const [sourceUrl, setSourceUrl] = useState(update?.source_url ?? "");
  const [periodStart, setPeriodStart] = useState(update?.period_start ?? "");
  const [periodEnd, setPeriodEnd] = useState(update?.period_end ?? "");
  const [receivedAt, setReceivedAt] = useState(
    update?.received_at ?? new Date().toISOString().split("T")[0]
  );
  const [isPublished, setIsPublished] = useState(update?.is_published ?? true);

  const categoryOptions = categories.map((cat) => ({
    value: cat.id,
    label: `${cat.title_ru} / ${cat.title_kk}`,
  }));

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);

    if (!titles.ru.trim()) {
      setActiveLocale("ru");
      setErrorMsg("Укажите название набора данных на русском языке (RU).");
      return;
    }
    if (!titles.kk.trim()) {
      setActiveLocale("kk");
      setErrorMsg("Укажите название набора данных на казахском языке (KZ).");
      return;
    }
    if (!categoryId) {
      setErrorMsg("Выберите категорию данных.");
      return;
    }
    if (!sourceName.trim()) {
      setErrorMsg("Укажите название источника данных.");
      return;
    }
    if (sourceUrl.trim() && !/^https?:\/\//i.test(sourceUrl.trim())) {
      setErrorMsg("Ссылка на источник должна начинаться с https:// или http://.");
      return;
    }

    const payload = {
      id: update?.id,
      category_id: categoryId,
      title_ru: titles.ru.trim(),
      title_kk: titles.kk.trim(),
      description_ru: descriptions.ru.trim(),
      description_kk: descriptions.kk.trim(),
      source_name: sourceName.trim(),
      source_url: sourceUrl.trim() || null,
      period_start: periodStart.trim() || null,
      period_end: periodEnd.trim() || null,
      received_at: receivedAt,
      is_published: isPublished,
    };

    startTransition(async () => {
      const result = await saveOpenDataUpdateAction(payload);
      if (result.error) {
        setErrorMsg(openDataErrorMessage(result.error));
        return;
      }
      const flag = update ? "saved=1" : "created=1";
      router.push(`/admin/science/open-data?tab=updates&${flag}`);
      router.refresh();
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="article-form wp-editor-form">
        {errorMsg ? (
          <div role="alert" className="notice error-notice" style={{ marginBottom: 0 }}>
            {errorMsg}
          </div>
        ) : null}

        {/* TOPBAR */}
        <div className="wp-editor-topbar">
          <div className="wp-topbar-left">
            <div className="wp-lang-tabs" role="tablist" aria-label="Языковые версии поступления">
              <button
                type="button"
                role="tab"
                disabled={isPending}
                aria-selected={activeLocale === "ru"}
                className={`wp-lang-tab ${activeLocale === "ru" ? "is-active" : ""}`}
                onClick={() => setActiveLocale("ru")}
              >
                <span className={`wp-tab-dot ${titles.ru.trim() ? "is-filled" : ""}`} />
                Русский
              </button>
              <button
                type="button"
                role="tab"
                disabled={isPending}
                aria-selected={activeLocale === "kk"}
                className={`wp-lang-tab ${activeLocale === "kk" ? "is-active" : ""}`}
                onClick={() => setActiveLocale("kk")}
              >
                <span className={`wp-tab-dot ${titles.kk.trim() ? "is-filled" : ""}`} />
                Қазақша
              </button>
            </div>
          </div>

          <div className="wp-topbar-right">
            <span className={`status-badge ${isPublished ? "status-published" : "status-draft"}`}>
              {isPublished ? "Опубликовано" : "Черновик"}
            </span>
            <button
              type="submit"
              className="primary-button wp-submit-btn"
              disabled={isPending || categories.length === 0}
            >
              <Save size={16} aria-hidden="true" />
              <span>
                {isPending
                  ? "Сохранение…"
                  : update
                    ? "Сохранить запись"
                    : "Создать запись"}
              </span>
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
                  style={{ display: activeLocale === locale ? "block" : "none" }}
                >
                  <div className="wp-editor-content-box">
                    <div className="wp-title-section">
                      <div className="opendata-field-header">
                        <label className="wp-field-label" htmlFor={`upd-title-${locale}`}>
                          Название набора данных ({langLabel}){" "}
                          <span className="opendata-required-star">*</span>
                        </label>
                        <span className="opendata-field-counter">
                          {titles[locale].length} / 300
                        </span>
                      </div>
                      <input
                        id={`upd-title-${locale}`}
                        name={`title_${locale}`}
                        value={titles[locale]}
                        maxLength={300}
                        className="wp-title-input"
                        disabled={isPending}
                        placeholder={
                          locale === "ru"
                            ? "Например: Мониторинг качества атмосферного воздуха Актобе"
                            : "Мысалы: Ақтөбе қаласының атмосфералық ауа сапасының мониторингі"
                        }
                        onChange={(e) =>
                          setTitles((prev) => ({ ...prev, [locale]: e.target.value }))
                        }
                      />
                    </div>

                    <div className="wp-excerpt-section" style={{ marginTop: "18px" }}>
                      <label htmlFor={`upd-desc-${locale}`}>
                        <div className="opendata-field-header">
                          <span className="wp-field-label">
                            Краткое описание набора данных ({langLabel})
                          </span>
                          <span className="opendata-field-counter">
                            {descriptions[locale].length} / 2000
                          </span>
                        </div>
                        <textarea
                          id={`upd-desc-${locale}`}
                          name={`description_${locale}`}
                          rows={5}
                          maxLength={2000}
                          className="wp-excerpt-textarea"
                          disabled={isPending}
                          value={descriptions[locale]}
                          placeholder={
                            locale === "ru"
                              ? "Состав данных, единицы наблюдения, методика сбора или формат..."
                              : "Деректер құрамы, бақылау бірліктері, жинау әдістемесі..."
                          }
                          onChange={(e) =>
                            setDescriptions((prev) => ({
                              ...prev,
                              [locale]: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}

            <details className="wp-metabox-card" open>
              <summary className="wp-metabox-header">Источник и период охвата</summary>
              <div className="wp-metabox-content">
                <div className="opendata-two-cols">
                  <div className="opendata-field-block">
                    <label className="wp-field-label" htmlFor="upd-source-name">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <Building2 size={13} aria-hidden="true" />
                        Источник данных <span className="opendata-required-star">*</span>
                      </span>
                    </label>
                    <input
                      id="upd-source-name"
                      name="source_name"
                      value={sourceName}
                      maxLength={200}
                      required
                      disabled={isPending}
                      className="opendata-field-input"
                      placeholder="Казгидромет, Бюро нацстатистики…"
                      onChange={(e) => setSourceName(e.target.value)}
                    />
                  </div>

                  <div className="opendata-field-block">
                    <label className="wp-field-label" htmlFor="upd-source-url">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <Globe size={13} aria-hidden="true" />
                        Ссылка на источник (URL)
                      </span>
                    </label>
                    <input
                      id="upd-source-url"
                      type="url"
                      name="source_url"
                      value={sourceUrl}
                      maxLength={500}
                      disabled={isPending}
                      className="opendata-field-input"
                      placeholder="https://..."
                      onChange={(e) => setSourceUrl(e.target.value)}
                    />
                  </div>
                </div>

                <div className="opendata-two-cols">
                  <div className="opendata-field-block">
                    <label className="wp-field-label" htmlFor="upd-period-start">
                      Период охвата (начало)
                    </label>
                    <input
                      id="upd-period-start"
                      name="period_start"
                      value={periodStart}
                      maxLength={50}
                      disabled={isPending}
                      className="opendata-field-input"
                      placeholder="2020, 01.2023…"
                      onChange={(e) => setPeriodStart(e.target.value)}
                    />
                  </div>

                  <div className="opendata-field-block">
                    <label className="wp-field-label" htmlFor="upd-period-end">
                      Период охвата (конец)
                    </label>
                    <input
                      id="upd-period-end"
                      name="period_end"
                      value={periodEnd}
                      maxLength={50}
                      disabled={isPending}
                      className="opendata-field-input"
                      placeholder="2026, текущее время…"
                      onChange={(e) => setPeriodEnd(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </details>
          </div>

          {/* SIDEBAR */}
          <aside className="wp-editor-sidebar">
            <details className="wp-sidebar-card" open>
              <summary className="wp-sidebar-card-header">Публикация</summary>
              <div className="wp-sidebar-card-body">
                <label
                  className={`wp-public-toggle-card ${isPublished ? "is-public" : "is-private"}`}
                >
                  <input
                    type="checkbox"
                    name="is_published"
                    checked={isPublished}
                    disabled={isPending}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="visually-hidden"
                  />
                  <span className="wp-public-toggle-indicator" aria-hidden="true" />
                  <span className="wp-public-toggle-text">
                    <strong>Опубликовать на /open-data</strong>
                    <small>
                      {isPublished
                        ? "Запись участвует в ленте последних поступлений (до 5 записей)."
                        : "Черновик виден только в панели администратора."}
                    </small>
                  </span>
                </label>

                <button
                  type="submit"
                  className="primary-button wp-submit-btn"
                  style={{ width: "100%", justifyContent: "center" }}
                  disabled={isPending || categories.length === 0}
                >
                  <Save size={15} aria-hidden="true" />
                  <span>
                    {isPending
                      ? "Сохранение…"
                      : update
                        ? "Сохранить запись"
                        : "Создать запись"}
                  </span>
                </button>
              </div>
            </details>

            <details className="wp-sidebar-card" open>
              <summary className="wp-sidebar-card-header">Классификация и дата</summary>
              <div className="wp-sidebar-card-body">
                <div className="wp-field-group">
                  <span className="wp-field-label">
                    Категория данных <span className="opendata-required-star">*</span>
                  </span>
                  <CustomSelect
                    name="category_id"
                    value={categoryId}
                    options={categoryOptions}
                    onChange={setCategoryId}
                    disabled={isPending || categories.length === 0}
                    placeholder="Выберите категорию"
                    ariaLabel="Категория данных"
                  />
                </div>

                <div className="wp-field-group">
                  <label className="wp-field-label" htmlFor="upd-received-at">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <Calendar size={13} aria-hidden="true" />
                      Дата поступления <span className="opendata-required-star">*</span>
                    </span>
                  </label>
                  <input
                    id="upd-received-at"
                    type="date"
                    name="received_at"
                    value={receivedAt}
                    required
                    disabled={isPending}
                    className="opendata-field-input"
                    onChange={(e) => setReceivedAt(e.target.value)}
                  />
                </div>
              </div>
            </details>
          </aside>
        </div>
      </form>

      {update ? (
        <OpenDataDeleteZone
          title="Удалить запись о поступлении"
          description="Запись будет удалена из админки и ленты последних поступлений на странице /open-data."
          confirmLabel={`Подтверждаю удаление записи «${update.title_ru}»`}
          buttonLabel="Удалить запись"
          redirectTo="/admin/science/open-data?tab=updates&deleted=1"
          onDelete={() => deleteOpenDataUpdateAction(update.id)}
        />
      ) : null}
    </>
  );
}
