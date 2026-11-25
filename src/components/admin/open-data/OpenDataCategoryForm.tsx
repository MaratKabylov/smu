"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save } from "lucide-react";
import type { OpenDataCategoryRow, OpenDataCategoryStatus } from "@/types/domain/open-data";
import { generateSlug } from "@/lib/articles/slug";
import {
  openDataCategoryStatuses,
  openDataCategoryStatusLabels,
  openDataErrorMessage,
} from "@/lib/open-data-constants";
import { CustomSelect } from "@/components/articles/CustomSelect";
import {
  deleteOpenDataCategoryAction,
  saveOpenDataCategoryAction,
} from "@/server/actions/open-data.actions";
import { OpenDataIconPicker } from "./OpenDataIconPicker";
import { OpenDataDeleteZone } from "./OpenDataDeleteZone";

type Props = {
  category?: OpenDataCategoryRow | null;
  defaultSortOrder?: number;
};

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function OpenDataCategoryForm({ category, defaultSortOrder = 1 }: Props) {
  const router = useRouter();
  const [activeLocale, setActiveLocale] = useState<"ru" | "kk">("ru");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [titles, setTitles] = useState({
    ru: category?.title_ru ?? "",
    kk: category?.title_kk ?? "",
  });
  const [descriptions, setDescriptions] = useState({
    ru: category?.description_ru ?? "",
    kk: category?.description_kk ?? "",
  });
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category?.slug));
  const [status, setStatus] = useState<OpenDataCategoryStatus>(
    category?.status ?? "collecting"
  );
  const [datasetCount, setDatasetCount] = useState(
    category?.dataset_count !== null && category?.dataset_count !== undefined
      ? String(category.dataset_count)
      : ""
  );
  const [icon, setIcon] = useState(category?.icon ?? "folder");
  const [sortOrder, setSortOrder] = useState(
    String(category?.sort_order ?? defaultSortOrder)
  );
  const [isVisible, setIsVisible] = useState(category?.is_visible ?? true);
  const [showOnHomepage, setShowOnHomepage] = useState(
    category?.show_on_homepage ?? false
  );

  const statusOptions = openDataCategoryStatuses.map((value) => ({
    value,
    label: openDataCategoryStatusLabels.ru[value],
  }));

  const handleTitleChange = (locale: "ru" | "kk", nextVal: string) => {
    setTitles((prev) => ({ ...prev, [locale]: nextVal }));
    if (locale === "ru" && !slugTouched && nextVal.trim()) {
      setSlug(generateSlug(nextVal).slice(0, 100));
    }
  };

  const handleRegenerateSlug = () => {
    if (!titles.ru.trim()) return;
    setSlug(generateSlug(titles.ru).slice(0, 100));
    setSlugTouched(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg(null);

    if (!titles.ru.trim()) {
      setActiveLocale("ru");
      setErrorMsg("Укажите название категории на русском языке (RU).");
      return;
    }
    if (!titles.kk.trim()) {
      setActiveLocale("kk");
      setErrorMsg("Укажите название категории на казахском языке (KZ).");
      return;
    }

    const cleanSlug = slug.trim();
    if (cleanSlug.length < 2 || !slugRegex.test(cleanSlug)) {
      setErrorMsg(
        "Slug должен содержать строчные латинские буквы, цифры и дефисы (от 2 символов)."
      );
      return;
    }

    const trimmedCount = datasetCount.trim();
    const parsedCount = trimmedCount === "" ? null : Number(trimmedCount);
    if (
      parsedCount !== null &&
      (!Number.isInteger(parsedCount) || parsedCount < 0)
    ) {
      setErrorMsg("Количество наборов данных должно быть целым неотрицательным числом.");
      return;
    }

    const payload = {
      id: category?.id,
      slug: cleanSlug,
      title_ru: titles.ru.trim(),
      title_kk: titles.kk.trim(),
      description_ru: descriptions.ru.trim(),
      description_kk: descriptions.kk.trim(),
      icon: icon.trim() || "folder",
      dataset_count: parsedCount,
      status,
      sort_order: Number(sortOrder) || 0,
      is_visible: isVisible,
      show_on_homepage: showOnHomepage,
    };

    startTransition(async () => {
      const result = await saveOpenDataCategoryAction(payload);
      if (result.error) {
        setErrorMsg(openDataErrorMessage(result.error));
        return;
      }
      const flag = category ? "saved=1" : "created=1";
      router.push(`/admin/science/open-data?tab=categories&${flag}`);
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
            <div className="wp-lang-tabs" role="tablist" aria-label="Языковые версии категории">
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
            <span className={`status-badge opendata-badge-${status}`}>
              {openDataCategoryStatusLabels.ru[status]}
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
                  : category
                    ? "Сохранить категорию"
                    : "Создать категорию"}
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
                        <label className="wp-field-label" htmlFor={`cat-title-${locale}`}>
                          Название категории ({langLabel}){" "}
                          <span className="opendata-required-star">*</span>
                        </label>
                        <span className="opendata-field-counter">
                          {titles[locale].length} / 200
                        </span>
                      </div>
                      <input
                        id={`cat-title-${locale}`}
                        name={`title_${locale}`}
                        value={titles[locale]}
                        maxLength={200}
                        className="wp-title-input"
                        disabled={isPending}
                        placeholder={
                          locale === "ru"
                            ? "Например: Экология и окружающая среда"
                            : "Мысалы: Экология және қоршаған орта"
                        }
                        onChange={(e) => handleTitleChange(locale, e.target.value)}
                      />
                    </div>

                    <div className="wp-permalink-bar" style={{ marginTop: "14px" }}>
                      <span className="wp-permalink-prefix">open-data / category /</span>
                      <input
                        name={locale === "ru" ? "slug" : undefined}
                        value={slug}
                        maxLength={100}
                        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                        placeholder="ecology-water"
                        className="wp-permalink-input"
                        disabled={isPending}
                        onChange={(e) => {
                          setSlug(e.target.value);
                          setSlugTouched(true);
                        }}
                      />
                      {titles.ru.trim() ? (
                        <button
                          type="button"
                          className="wp-permalink-refresh-btn"
                          onClick={handleRegenerateSlug}
                          title="Сгенерировать slug из русского названия"
                          disabled={isPending}
                        >
                          <RotateCcw size={12} aria-hidden="true" />
                          <span>Обновить</span>
                        </button>
                      ) : null}
                    </div>

                    <div className="wp-excerpt-section" style={{ marginTop: "18px" }}>
                      <label htmlFor={`cat-desc-${locale}`}>
                        <div className="opendata-field-header">
                          <span className="wp-field-label">
                            Краткое описание направления ({langLabel})
                          </span>
                          <span className="opendata-field-counter">
                            {descriptions[locale].length} / 1000
                          </span>
                        </div>
                        <textarea
                          id={`cat-desc-${locale}`}
                          name={`description_${locale}`}
                          rows={4}
                          maxLength={1000}
                          className="wp-excerpt-textarea"
                          disabled={isPending}
                          value={descriptions[locale]}
                          placeholder={
                            locale === "ru"
                              ? "Какие именно региональные данные собираются в этом направлении..."
                              : "Бұл бағытта қандай өңірлік деректер жиналатынын сипаттаңыз..."
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
          </div>

          {/* SIDEBAR */}
          <aside className="wp-editor-sidebar">
            <details className="wp-sidebar-card" open>
              <summary className="wp-sidebar-card-header">Статус и публикация</summary>
              <div className="wp-sidebar-card-body">
                <div className="wp-field-group">
                  <span className="wp-field-label">
                    Статус сбора данных <span className="opendata-required-star">*</span>
                  </span>
                  <CustomSelect
                    name="status"
                    value={status}
                    options={statusOptions}
                    onChange={(next) => setStatus(next as OpenDataCategoryStatus)}
                    disabled={isPending}
                    ariaLabel="Статус сбора данных"
                  />
                </div>

                <div className="wp-field-group">
                  <label className="wp-field-label" htmlFor="cat-dataset-count">
                    Количество наборов данных
                  </label>
                  <input
                    id="cat-dataset-count"
                    type="number"
                    min="0"
                    step="1"
                    name="dataset_count"
                    value={datasetCount}
                    disabled={isPending}
                    className="opendata-field-input"
                    placeholder="Пусто, если ещё не подсчитано"
                    onChange={(e) => setDatasetCount(e.target.value)}
                  />
                  <p className="opendata-field-hint">
                    Используется для расчёта относительной шкалы наполнения категорий на сайте.
                  </p>
                </div>

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
                        ? "Категория отображается в каталоге направлений."
                        : "Категория скрыта с публичной страницы."}
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
                    <small>На главной отображается до 6 отмеченных категорий.</small>
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
                      : category
                        ? "Сохранить категорию"
                        : "Создать категорию"}
                  </span>
                </button>
              </div>
            </details>

            <details className="wp-sidebar-card" open>
              <summary className="wp-sidebar-card-header">Иконка и сортировка</summary>
              <div className="wp-sidebar-card-body">
                <div className="wp-field-group">
                  <span className="wp-field-label">Иконка категории</span>
                  <OpenDataIconPicker
                    value={icon}
                    onChange={setIcon}
                    disabled={isPending}
                  />
                </div>

                <div className="wp-field-group">
                  <label className="wp-field-label" htmlFor="cat-sort-order">
                    Порядок сортировки
                  </label>
                  <input
                    id="cat-sort-order"
                    type="number"
                    name="sort_order"
                    value={sortOrder}
                    disabled={isPending}
                    className="opendata-field-input"
                    onChange={(e) => setSortOrder(e.target.value)}
                  />
                </div>
              </div>
            </details>
          </aside>
        </div>
      </form>

      {category ? (
        <OpenDataDeleteZone
          title="Удалить категорию данных"
          description="Внимание: вместе с категорией будут безвозвратно удалены все связанные записи о поступлениях данных."
          confirmLabel={`Подтверждаю удаление категории «${category.title_ru}» и её поступлений`}
          buttonLabel="Удалить категорию"
          redirectTo="/admin/science/open-data?tab=categories&deleted=1"
          onDelete={() => deleteOpenDataCategoryAction(category.id)}
        />
      ) : null}
    </>
  );
}
