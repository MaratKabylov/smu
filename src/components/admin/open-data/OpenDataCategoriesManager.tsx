import Link from "next/link";
import { FolderKanban, Plus, Search } from "lucide-react";
import type { OpenDataCategoryRow } from "@/types/domain/open-data";
import {
  openDataCategoryStatuses,
  openDataCategoryStatusLabels,
} from "@/lib/open-data-constants";
import { OpenDataIcon } from "@/components/open-data/OpenDataIcon";
import type { OpenDataAdminSearchState } from "./OpenDataAdmin";

type Props = {
  categories: OpenDataCategoryRow[];
  filters?: OpenDataAdminSearchState;
};

const basePath = "/admin/science/open-data";
const numberFormatter = new Intl.NumberFormat("ru-RU");

function pluralCategories(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "категория";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "категории";
  return "категорий";
}

export function OpenDataCategoriesManager({ categories, filters = {} }: Props) {
  const query = (filters.q ?? "").trim().toLowerCase();
  const statusFilter = filters.status ?? "all";
  const visibilityFilter = filters.visibility ?? "all";

  const filtered = categories.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (visibilityFilter === "visible" && !item.is_visible) return false;
    if (visibilityFilter === "hidden" && item.is_visible) return false;
    if (visibilityFilter === "homepage" && !item.show_on_homepage) return false;
    if (query) {
      const hay = [
        item.title_ru,
        item.title_kk,
        item.slug,
        item.description_ru,
        item.description_kk,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const hasFilters = Boolean(
    query || statusFilter !== "all" || visibilityFilter !== "all"
  );
  const homepageCount = categories.filter((c) => c.is_visible && c.show_on_homepage).length;

  return (
    <>
      <section className="media-toolbar" aria-label="Фильтры категорий">
        <form action={basePath} className="media-filters">
          <input type="hidden" name="tab" value="categories" />
          <label className="search-field">
            <Search size={16} aria-hidden="true" />
            <span className="visually-hidden">Поиск по названию или slug</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Поиск по названию, описанию или slug"
              maxLength={120}
            />
          </label>
          <select name="status" defaultValue={statusFilter} aria-label="Статус сбора">
            <option value="all">Все статусы сбора</option>
            {openDataCategoryStatuses.map((status) => (
              <option key={status} value={status}>
                {openDataCategoryStatusLabels.ru[status]}
              </option>
            ))}
          </select>
          <select
            name="visibility"
            defaultValue={visibilityFilter}
            aria-label="Размещение"
          >
            <option value="all">Все категории</option>
            <option value="visible">Видны на /open-data</option>
            <option value="homepage">На главной странице</option>
            <option value="hidden">Скрыты</option>
          </select>
          <button type="submit" className="secondary-button">
            Применить
          </button>
        </form>
        <span className="real-count">
          {filtered.length} {pluralCategories(filtered.length)} · на главной {homepageCount}/6
        </span>
      </section>

      <section className="data-panel" aria-labelledby="categories-table-title">
        <div className="data-panel-header">
          <div>
            <h2 id="categories-table-title">Категории данных</h2>
            <p>
              Тематические направления сбора данных. На главной странице выводится до 6 выбранных
              категорий.
            </p>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="table-wrap">
            <table className="articles-table">
              <thead>
                <tr>
                  <th style={{ width: "56px" }}>#</th>
                  <th>Категория (RU / KZ)</th>
                  <th>Slug</th>
                  <th>Наборов</th>
                  <th>Статус сбора</th>
                  <th>Главная</th>
                  <th>Видимость</th>
                  <th style={{ textAlign: "right" }}>Действие</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <span className="opendata-muted">{category.sort_order}</span>
                    </td>
                    <td>
                      <div className="opendata-table-title-cell">
                        <span className="opendata-table-icon">
                          <OpenDataIcon name={category.icon} size={17} />
                        </span>
                        <div className="opendata-table-title-text">
                          <Link href={`${basePath}/categories/${category.id}`}>
                            {category.title_ru}
                          </Link>
                          <span className="opendata-table-subtitle">{category.title_kk}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code className="opendata-code-pill">{category.slug}</code>
                    </td>
                    <td>
                      {category.dataset_count !== null ? (
                        <span className="opendata-value-filled">
                          {numberFormatter.format(category.dataset_count)}
                        </span>
                      ) : (
                        <span className="opendata-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge opendata-badge-${category.status}`}>
                        {openDataCategoryStatusLabels.ru[category.status] ?? category.status}
                      </span>
                    </td>
                    <td>
                      {category.show_on_homepage ? (
                        <span className="status-badge opendata-badge-collecting">
                          На главной
                        </span>
                      ) : (
                        <span className="opendata-muted">Нет</span>
                      )}
                    </td>
                    <td>
                      {category.is_visible ? (
                        <span className="status-badge status-published">Видна</span>
                      ) : (
                        <span className="status-badge status-draft">Скрыта</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link
                        href={`${basePath}/categories/${category.id}`}
                        className="secondary-button opendata-row-action"
                      >
                        Редактировать
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <FolderKanban aria-hidden="true" />
            </span>
            <h3>
              {hasFilters ? "Категории не найдены" : "Категории пока не добавлены"}
            </h3>
            <p>
              {hasFilters
                ? "Измените поисковый запрос или сбросьте выбранные фильтры."
                : "Создайте тематические направления сбора научных данных региона."}
            </p>
            <div style={{ marginTop: "16px", display: "flex", gap: "8px", justifyContent: "center" }}>
              {hasFilters ? (
                <Link href={`${basePath}?tab=categories`} className="secondary-button">
                  Сбросить фильтры
                </Link>
              ) : null}
              <Link href={`${basePath}/categories/new`} className="primary-button">
                <Plus size={16} aria-hidden="true" />
                <span>Добавить категорию</span>
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
