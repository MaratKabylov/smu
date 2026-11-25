"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hash, RotateCcw, Save } from "lucide-react";
import type { OpenDataMetricRow } from "@/types/domain/open-data";
import { generateSlug } from "@/lib/articles/slug";
import { openDataErrorMessage } from "@/lib/open-data-constants";
import {
  deleteOpenDataMetricAction,
  saveOpenDataMetricAction,
} from "@/server/actions/open-data.actions";
import { OpenDataIconPicker } from "./OpenDataIconPicker";
import { OpenDataDeleteZone } from "./OpenDataDeleteZone";

type Props = {
  metric?: OpenDataMetricRow | null;
  defaultSortOrder?: number;
};

const codeRegex = /^[a-z0-9_-]+$/i;

export function OpenDataMetricForm({ metric, defaultSortOrder = 1 }: Props) {
  const router = useRouter();
  const [activeLocale, setActiveLocale] = useState<"ru" | "kk">("ru");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [titles, setTitles] = useState({
    ru: metric?.title_ru ?? "",
    kk: metric?.title_kk ?? "",
  });
  const [units, setUnits] = useState({
    ru: metric?.unit_ru ?? "",
    kk: metric?.unit_kk ?? "",
  });
  const [valueTexts, setValueTexts] = useState({
    ru: metric?.value_text_ru ?? "",
    kk: metric?.value_text_kk ?? "",
  });
  const [code, setCode] = useState(metric?.code ?? "");
  const [codeTouched, setCodeTouched] = useState(Boolean(metric?.code));
  const [valueNumeric, setValueNumeric] = useState(
    metric?.value_numeric !== null && metric?.value_numeric !== undefined
      ? String(metric.value_numeric)
      : ""
  );
  const [icon, setIcon] = useState(metric?.icon ?? "database");
  const [sortOrder, setSortOrder] = useState(
    String(metric?.sort_order ?? defaultSortOrder)
  );
  const [isVisible, setIsVisible] = useState(metric?.is_visible ?? true);
  const [showOnHomepage, setShowOnHomepage] = useState(metric?.show_on_homepage ?? false);

  const generateCodeFromTitle = (rawTitle: string) =>
    generateSlug(rawTitle).replace(/-/g, "_").slice(0, 80);

  const handleTitleChange = (locale: "ru" | "kk", nextVal: string) => {
    setTitles((prev) => ({ ...prev, [locale]: nextVal }));
    if (locale === "ru" && !codeTouched && nextVal.trim()) {
      setCode(generateCodeFromTitle(nextVal));
    }
  };

  const handleRegenerateCode = () => {
    if (!titles.ru.trim()) return;
    setCode(generateCodeFromTitle(titles.ru));
    setCodeTouched(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);

    if (!titles.ru.trim()) {
      setActiveLocale("ru");
      setErrorMsg("Укажите название показателя на русском языке (RU).");
      return;
    }
    if (!titles.kk.trim()) {
      setActiveLocale("kk");
      setErrorMsg("Укажите название показателя на казахском языке (KZ).");
      return;
    }
    const cleanCode = code.trim();
    if (cleanCode.length < 2 || !codeRegex.test(cleanCode)) {
      setErrorMsg(
        "Код показателя должен содержать не менее 2 символов: латинские буквы, цифры, дефис или подчёркивание."
      );
      return;
    }

    const trimmedNum = valueNumeric.trim();
    const parsedNum = trimmedNum === "" ? null : Number(trimmedNum);
    if (parsedNum !== null && (Number.isNaN(parsedNum) || parsedNum < 0)) {
      setErrorMsg("Числовое значение должно быть неотрицательным числом.");
      return;
    }

    const payload = {
      id: metric?.id,
      code: cleanCode,
      title_ru: titles.ru.trim(),
      title_kk: titles.kk.trim(),
      value_numeric: parsedNum,
      value_text_ru: valueTexts.ru.trim() || null,
      value_text_kk: valueTexts.kk.trim() || null,
      unit_ru: units.ru.trim(),
      unit_kk: units.kk.trim(),
      icon: icon.trim() || "database",
      sort_order: Number(sortOrder) || 0,
      is_visible: isVisible,
      show_on_homepage: showOnHomepage,
    };

    startTransition(async () => {
      const result = await saveOpenDataMetricAction(payload);
      if (result.error) {
        setErrorMsg(openDataErrorMessage(result.error));
        return;
      }
      const flag = metric ? "saved=1" : "created=1";
      router.push(`/admin/science/open-data?tab=metrics&${flag}`);
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
            <div className="wp-lang-tabs" role="tablist" aria-label="Языковые версии показателя">
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
            <span className={`status-badge ${isVisible ? "status-published" : "status-draft"}`}>
              {isVisible ? "Виден" : "Скрыт"}
            </span>
            <button
              type="submit"
              className="primary-button wp-submit-btn"
              disabled={isPending}
            >
              <Save size={16} aria-hidden="true" />
              <span>
                {isPending
                  ? "Сохранение…"
                  : metric
                    ? "Сохранить показатель"
                    : "Создать показатель"}
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
                        <label className="wp-field-label" htmlFor={`metric-title-${locale}`}>
                          Название показателя ({langLabel}){" "}
                          <span className="opendata-required-star">*</span>
                        </label>
                        <span className="opendata-field-counter">
                          {titles[locale].length} / 200
                        </span>
                      </div>
                      <input
                        id={`metric-title-${locale}`}
                        name={`title_${locale}`}
                        value={titles[locale]}
                        maxLength={200}
                        className="wp-title-input"
                        disabled={isPending}
                        placeholder={
                          locale === "ru"
                            ? "Например: Количество наборов данных"
                            : "Мысалы: Деректер жиынтығының саны"
                        }
                        onChange={(e) => handleTitleChange(locale, e.target.value)}
                      />
                    </div>

                    <div className="opendata-two-cols" style={{ marginTop: "20px" }}>
                      <div className="opendata-field-block">
                        <label className="wp-field-label" htmlFor={`metric-unit-${locale}`}>
                          Единица измерения ({langLabel})
                        </label>
                        <input
                          id={`metric-unit-${locale}`}
                          name={`unit_${locale}`}
                          value={units[locale]}
                          maxLength={50}
                          className="opendata-field-input"
                          disabled={isPending}
                          placeholder={
                            locale === "ru" ? "ГБ, шт., записей, млн…" : "ГБ, дана, жазба…"
                          }
                          onChange={(e) =>
                            setUnits((prev) => ({ ...prev, [locale]: e.target.value }))
                          }
                        />
                      </div>

                      <div className="opendata-field-block">
                        <label className="wp-field-label" htmlFor={`metric-text-${locale}`}>
                          Текстовое значение ({langLabel})
                        </label>
                        <input
                          id={`metric-text-${locale}`}
                          name={`value_text_${locale}`}
                          value={valueTexts[locale]}
                          maxLength={200}
                          className="opendata-field-input"
                          disabled={isPending}
                          placeholder={
                            locale === "ru"
                              ? "Например: Актюбинская область, 2020–2026"
                              : "Мысалы: Ақтөбе облысы, 2020–2026"
                          }
                          onChange={(e) =>
                            setValueTexts((prev) => ({ ...prev, [locale]: e.target.value }))
                          }
                        />
                      </div>
                    </div>

                    <p className="opendata-field-hint" style={{ marginTop: "10px" }}>
                      Текстовое значение используется, если числовое значение не указано (например,
                      для географического или временного охвата).
                    </p>
                  </div>
                </div>
              );
            })}

            <details className="wp-metabox-card" open>
              <summary className="wp-metabox-header">
                Числовое значение и системный код
              </summary>
              <div className="wp-metabox-content">
                <div className="opendata-two-cols">
                  <div className="opendata-field-block">
                    <label className="wp-field-label" htmlFor="metric-value-numeric">
                      Числовое значение
                    </label>
                    <input
                      id="metric-value-numeric"
                      type="number"
                      min="0"
                      step="any"
                      name="value_numeric"
                      value={valueNumeric}
                      disabled={isPending}
                      className="opendata-field-input"
                      placeholder="Оставьте пустым, если не заполнено"
                      onChange={(e) => setValueNumeric(e.target.value)}
                    />
                    <p className="opendata-field-hint">
                      Ноль (0) отображается как реальное значение; пустое поле скрывает показатель
                      на публичном сайте (если не задан текст).
                    </p>
                  </div>

                  <div className="opendata-field-block">
                    <div className="opendata-field-header">
                      <label className="wp-field-label" htmlFor="metric-code">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Hash size={13} aria-hidden="true" />
                          Уникальный код <span className="opendata-required-star">*</span>
                        </span>
                      </label>
                      {titles.ru.trim() ? (
                        <button
                          type="button"
                          className="wp-permalink-refresh-btn"
                          onClick={handleRegenerateCode}
                          disabled={isPending}
                          title="Сгенерировать код из русского названия"
                        >
                          <RotateCcw size={11} aria-hidden="true" />
                          <span>Обновить</span>
                        </button>
                      ) : null}
                    </div>
                    <input
                      id="metric-code"
                      name="code"
                      value={code}
                      maxLength={80}
                      pattern="[A-Za-z0-9_-]+"
                      required
                      disabled={isPending}
                      className="opendata-field-input"
                      style={{ fontFamily: "ui-monospace, monospace" }}
                      placeholder="datasets_count"
                      onChange={(e) => {
                        setCode(e.target.value);
                        setCodeTouched(true);
                      }}
                    />
                    <p className="opendata-field-hint">
                      Латинские буквы, цифры, дефис или подчёркивание.
                    </p>
                  </div>
                </div>
              </div>
            </details>
          </div>

          {/* SIDEBAR */}
          <aside className="wp-editor-sidebar">
            <details className="wp-sidebar-card" open>
              <summary className="wp-sidebar-card-header">Публикация и размещение</summary>
              <div className="wp-sidebar-card-body">
                <label
                  className={`wp-public-toggle-card ${isVisible ? "is-public" : "is-private"}`}
                >
                  <input
                    type="checkbox"
                    name="is_visible"
                    checked={isVisible}
                    disabled={isPending}
                    onChange={(e) => setIsVisible(e.target.checked)}
                    className="visually-hidden"
                  />
                  <span className="wp-public-toggle-indicator" aria-hidden="true" />
                  <span className="wp-public-toggle-text">
                    <strong>Видимость на /open-data</strong>
                    <small>
                      {isVisible
                        ? "Показатель участвует в отображении на странице Open Data."
                        : "Показатель скрыт на публичном сайте."}
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
                    disabled={isPending}
                    onChange={(e) => setShowOnHomepage(e.target.checked)}
                    className="visually-hidden"
                  />
                  <span className="wp-public-toggle-indicator" aria-hidden="true" />
                  <span className="wp-public-toggle-text">
                    <strong>На главной странице</strong>
                    <small>На главной выводится до 4 отмеченных показателей по порядку.</small>
                  </span>
                </label>

                <button
                  type="submit"
                  className="primary-button wp-submit-btn"
                  style={{ width: "100%", justifyContent: "center" }}
                  disabled={isPending}
                >
                  <Save size={15} aria-hidden="true" />
                  <span>
                    {isPending
                      ? "Сохранение…"
                      : metric
                        ? "Сохранить показатель"
                        : "Создать показатель"}
                  </span>
                </button>
              </div>
            </details>

            <details className="wp-sidebar-card" open>
              <summary className="wp-sidebar-card-header">Оформление и порядок</summary>
              <div className="wp-sidebar-card-body">
                <div className="wp-field-group">
                  <span className="wp-field-label">Иконка показателя</span>
                  <OpenDataIconPicker
                    value={icon}
                    onChange={setIcon}
                    disabled={isPending}
                  />
                </div>

                <div className="wp-field-group">
                  <label className="wp-field-label" htmlFor="metric-sort-order">
                    Порядок сортировки
                  </label>
                  <input
                    id="metric-sort-order"
                    type="number"
                    name="sort_order"
                    value={sortOrder}
                    disabled={isPending}
                    className="opendata-field-input"
                    onChange={(e) => setSortOrder(e.target.value)}
                  />
                  <p className="opendata-field-hint">
                    Меньшее число выводится раньше в сетке показателей.
                  </p>
                </div>
              </div>
            </details>
          </aside>
        </div>
      </form>

      {metric ? (
        <OpenDataDeleteZone
          title="Удалить показатель"
          description="Показатель будет удалён из админки, страницы /open-data и блока на главной."
          confirmLabel={`Подтверждаю удаление показателя «${metric.title_ru}»`}
          buttonLabel="Удалить показатель"
          redirectTo="/admin/science/open-data?tab=metrics&deleted=1"
          onDelete={() => deleteOpenDataMetricAction(metric.id)}
        />
      ) : null}
    </>
  );
}
