import Link from "next/link";
import { ExternalLink, FileSpreadsheet, Plus, Search } from "lucide-react";
import type {
  OpenDataCategoryRow,
  OpenDataUpdateWithCategory,
} from "@/types/domain/open-data";
import { OpenDataIcon } from "@/components/open-data/OpenDataIcon";
import type { OpenDataAdminSearchState } from "./OpenDataAdmin";

type Props = {
  updates: OpenDataUpdateWithCategory[];
  categories: OpenDataCategoryRow[];
  filters?: OpenDataAdminSearchState;
};

const basePath = "/admin/science/open-data";
const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function formatReceivedDate(dateStr: string): string {
  try {
    return dateFormatter.format(new Date(`${dateStr}T00:00:00Z`));
  } catch {
    return dateStr;
  }
}

function pluralUpdates(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "запись";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "записи";
  return "записей";
}

export function OpenDataUpdatesManager({
  updates,
  categories,
  filters = {},
}: Props) {
  const query = (filters.q ?? "").trim().toLowerCase();
  const categoryFilter = filters.category ?? "all";
  const statusFilter = filters.status ?? "all";

  const filtered = updates.filter((item) => {
    if (categoryFilter !== "all" && item.category_id !== categoryFilter) return false;
    if (statusFilter === "published" && !item.is_published) return false;
    if (statusFilter === "draft" && item.is_published) return false;
    if (query) {
      const hay = [
        item.title_ru,
        item.title_kk,
        item.description_ru,
        item.source_name,
        item.category?.title_ru ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const hasFilters = Boolean(
    query || categoryFilter !== "all" || statusFilter !== "all"
  );

  return (
    <>
      {categories.length === 0 ? (
        <div className="notice">
          Чтобы добавлять поступления данных, сначала создайте хотя бы одну категорию во вкладке{" "}
          <Link href={`${basePath}?tab=categories`} style={{ fontWeight: 700 }}>
            «Категории»
          </Link>
          .
        </div>
      ) : null}

      <section className="media-toolbar" aria-label="Фильтры поступлений">
        <form action={basePath} className="media-filters">
          <input type="hidden" name="tab" value="updates" />
          <label className="search-field">
            <Search size={16} aria-hidden="true" />
            <span className="visually-hidden">Поиск по названию или источнику</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Поиск по названию набора, описанию или источнику"
              maxLength={120}
            />
          </label>
          <select name="category" defaultValue={categoryFilter} aria-label="Категория">
            <option value="all">Все категории</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.title_ru}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={statusFilter} aria-label="Статус публикации">
            <option value="all">Все статусы</option>
            <option value="published">Опубликовано</option>
            <option value="draft">Черновик</option>
          </select>
          <button type="submit" className="secondary-button">
            Применить
          </button>
        </form>
        <span className="real-count">
          {filtered.length} {pluralUpdates(filtered.length)}
        </span>
      </section>

      <section className="data-panel" aria-labelledby="updates-table-title">
        <div className="data-panel-header">
          <div>
            <h2 id="updates-table-title">Последние поступления данных</h2>
            <p>
              Информационные записи о зарегистрированных наборах данных (до 5 последних
              опубликованных отображаются на странице /open-data).
            </p>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="table-wrap">
            <table className="articles-table">
              <thead>
                <tr>
                  <th>Набор данных (RU / KZ)</th>
                  <th>Категория</th>
                  <th>Источник</th>
                  <th>Период охвата</th>
                  <th>Поступление</th>
                  <th>Статус</th>
                  <th style={{ textAlign: "right" }}>Действие</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((update) => (
                  <tr key={update.id}>
                    <td>
                      <Link href={`${basePath}/updates/${update.id}`}>
                        {update.title_ru}
                      </Link>
                      <small>{update.title_kk}</small>
                    </td>
                    <td>
                      {update.category ? (
                        <span className="opendata-category-chip">
                          <OpenDataIcon name={update.category.icon} size={13} />
                          <span>{update.category.title_ru}</span>
                        </span>
                      ) : (
                        <span className="opendata-muted">—</span>
                      )}
                    </td>
                    <td>
                      {update.source_url ? (
                        <a
                          href={update.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opendata-source-link"
                        >
                          <span>{update.source_name}</span>
                          <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      ) : (
                        <span>{update.source_name}</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {update.period_start || update.period_end ? (
                        <span>
                          {update.period_start ?? "…"} — {update.period_end ?? "…"}
                        </span>
                      ) : (
                        <span className="opendata-muted">—</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatReceivedDate(update.received_at)}
                    </td>
                    <td>
                      {update.is_published ? (
                        <span className="status-badge status-published">Опубликовано</span>
                      ) : (
                        <span className="status-badge status-draft">Черновик</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link
                        href={`${basePath}/updates/${update.id}`}
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
              <FileSpreadsheet aria-hidden="true" />
            </span>
            <h3>
              {hasFilters ? "Поступления не найдены" : "Записей о поступлениях пока нет"}
            </h3>
            <p>
              {hasFilters
                ? "Измените поисковый запрос или сбросьте фильтры."
                : "Добавьте первую запись о поступлении нового научного набора данных."}
            </p>
            <div style={{ marginTop: "16px", display: "flex", gap: "8px", justifyContent: "center" }}>
              {hasFilters ? (
                <Link href={`${basePath}?tab=updates`} className="secondary-button">
                  Сбросить фильтры
                </Link>
              ) : null}
              {categories.length > 0 ? (
                <Link href={`${basePath}/updates/new`} className="primary-button">
                  <Plus size={16} aria-hidden="true" />
                  <span>Добавить поступление</span>
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
