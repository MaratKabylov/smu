import Link from "next/link";
import { BarChart3, Plus, Search } from "lucide-react";
import type { OpenDataMetricRow } from "@/types/domain/open-data";
import { OpenDataIcon } from "@/components/open-data/OpenDataIcon";
import type { OpenDataAdminSearchState } from "./OpenDataAdmin";

type Props = {
  metrics: OpenDataMetricRow[];
  filters?: OpenDataAdminSearchState;
};

const basePath = "/admin/science/open-data";
const numberFormatter = new Intl.NumberFormat("ru-RU");

function pluralMetrics(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "показатель";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "показателя";
  return "показателей";
}

export function OpenDataMetricsManager({ metrics, filters = {} }: Props) {
  const query = (filters.q ?? "").trim().toLowerCase();
  const visibilityFilter = filters.visibility ?? "all";
  const homepageFilter = filters.homepage ?? "all";

  const filtered = metrics.filter((item) => {
    if (visibilityFilter === "visible" && !item.is_visible) return false;
    if (visibilityFilter === "hidden" && item.is_visible) return false;
    if (homepageFilter === "yes" && !item.show_on_homepage) return false;
    if (homepageFilter === "no" && item.show_on_homepage) return false;
    if (query) {
      const hay = [
        item.title_ru,
        item.title_kk,
        item.code,
        item.value_text_ru ?? "",
        item.value_text_kk ?? "",
        item.unit_ru,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const hasFilters = Boolean(
    query || visibilityFilter !== "all" || homepageFilter !== "all"
  );
  const homepageCount = metrics.filter((m) => m.is_visible && m.show_on_homepage).length;

  return (
    <>
      <section className="media-toolbar" aria-label="Фильтры показателей">
        <form action={basePath} className="media-filters">
          <input type="hidden" name="tab" value="metrics" />
          <label className="search-field">
            <Search size={16} aria-hidden="true" />
            <span className="visually-hidden">Поиск по названию или коду</span>
            <input
              type="search"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Поиск по названию, коду или значению"
              maxLength={120}
            />
          </label>
          <select
            name="visibility"
            defaultValue={visibilityFilter}
            aria-label="Видимость"
          >
            <option value="all">Вся видимость</option>
            <option value="visible">Виден на /open-data</option>
            <option value="hidden">Скрыт</option>
          </select>
          <select
            name="homepage"
            defaultValue={homepageFilter}
            aria-label="Отображение на главной"
          >
            <option value="all">Все размещения</option>
            <option value="yes">На главной странице</option>
            <option value="no">Только на /open-data</option>
          </select>
          <button type="submit" className="secondary-button">
            Применить
          </button>
        </form>
        <span className="real-count">
          {filtered.length} {pluralMetrics(filtered.length)} · на главной {homepageCount}/4
        </span>
      </section>

      <section className="data-panel" aria-labelledby="metrics-table-title">
        <div className="data-panel-header">
          <div>
            <h2 id="metrics-table-title">Информационные показатели</h2>
            <p>
              Показатели с пустым значением скрываются на публичном сайте. На главной странице
              отображается до 4 отмеченных показателей.
            </p>
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="table-wrap">
            <table className="articles-table">
              <thead>
                <tr>
                  <th style={{ width: "56px" }}>#</th>
                  <th>Показатель (RU / KZ)</th>
                  <th>Код</th>
                  <th>Значение</th>
                  <th>Главная</th>
                  <th>Видимость</th>
                  <th style={{ textAlign: "right" }}>Действие</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((metric) => {
                  const hasValue =
                    metric.value_numeric !== null || Boolean(metric.value_text_ru);
                  const displayValue =
                    metric.value_numeric !== null
                      ? `${numberFormatter.format(metric.value_numeric)} ${metric.unit_ru}`.trim()
                      : metric.value_text_ru
                        ? `${metric.value_text_ru} ${metric.unit_ru}`.trim()
                        : "Не заполнено";

                  return (
                    <tr key={metric.id}>
                      <td>
                        <span className="opendata-muted">{metric.sort_order}</span>
                      </td>
                      <td>
                        <div className="opendata-table-title-cell">
                          <span className="opendata-table-icon">
                            <OpenDataIcon name={metric.icon} size={17} />
                          </span>
                          <div className="opendata-table-title-text">
                            <Link href={`${basePath}/metrics/${metric.id}`}>
                              {metric.title_ru}
                            </Link>
                            <span className="opendata-table-subtitle">{metric.title_kk}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code className="opendata-code-pill">{metric.code}</code>
                      </td>
                      <td>
                        {hasValue ? (
                          <span className="opendata-value-filled">{displayValue}</span>
                        ) : (
                          <span className="opendata-muted">— (не заполнено)</span>
                        )}
                      </td>
                      <td>
                        {metric.show_on_homepage ? (
                          <span className="status-badge opendata-badge-collecting">
                            На главной
                          </span>
                        ) : (
                          <span className="opendata-muted">Нет</span>
                        )}
                      </td>
                      <td>
                        {metric.is_visible ? (
                          <span className="status-badge status-published">Виден</span>
                        ) : (
                          <span className="status-badge status-draft">Скрыт</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <Link
                          href={`${basePath}/metrics/${metric.id}`}
                          className="secondary-button opendata-row-action"
                        >
                          Редактировать
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <BarChart3 aria-hidden="true" />
            </span>
            <h3>
              {hasFilters ? "Показатели не найдены" : "Показатели пока не добавлены"}
            </h3>
            <p>
              {hasFilters
                ? "Измените поисковый запрос или сбросьте фильтры."
                : "Добавьте информационные показатели, чтобы отразить масштаб базы данных."}
            </p>
            <div style={{ marginTop: "16px", display: "flex", gap: "8px", justifyContent: "center" }}>
              {hasFilters ? (
                <Link href={`${basePath}?tab=metrics`} className="secondary-button">
                  Сбросить фильтры
                </Link>
              ) : null}
              <Link href={`${basePath}/metrics/new`} className="primary-button">
                <Plus size={16} aria-hidden="true" />
                <span>Добавить показатель</span>
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
