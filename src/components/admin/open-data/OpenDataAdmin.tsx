import Link from "next/link";
import {
  BarChart3,
  FileSpreadsheet,
  FolderKanban,
  Plus,
  Settings2,
} from "lucide-react";
import type {
  OpenDataCategoryRow,
  OpenDataMetricRow,
  OpenDataSettingsRow,
  OpenDataUpdateWithCategory,
} from "@/types/domain/open-data";
import { openDataErrorMessage } from "@/lib/open-data-constants";
import { OpenDataSettingsForm } from "./OpenDataSettingsForm";
import { OpenDataMetricsManager } from "./OpenDataMetricsManager";
import { OpenDataCategoriesManager } from "./OpenDataCategoriesManager";
import { OpenDataUpdatesManager } from "./OpenDataUpdatesManager";

export type OpenDataAdminTab = "settings" | "metrics" | "categories" | "updates";

export type OpenDataAdminSearchState = {
  tab?: string;
  q?: string;
  status?: string;
  visibility?: string;
  homepage?: string;
  category?: string;
  created?: string;
  saved?: string;
  deleted?: string;
  error?: string;
};

type Props = {
  tab?: string;
  searchState?: OpenDataAdminSearchState;
  settings: OpenDataSettingsRow | null;
  metrics: OpenDataMetricRow[];
  categories: OpenDataCategoryRow[];
  updates: OpenDataUpdateWithCategory[];
};

const basePath = "/admin/science/open-data";

const tabSuccessMessages: Record<
  Exclude<OpenDataAdminTab, "settings">,
  { created: string; saved: string; deleted: string }
> = {
  metrics: {
    created: "Показатель успешно создан.",
    saved: "Изменения показателя сохранены.",
    deleted: "Показатель удалён.",
  },
  categories: {
    created: "Категория данных успешно создана.",
    saved: "Изменения категории сохранены.",
    deleted: "Категория данных удалена.",
  },
  updates: {
    created: "Запись о поступлении данных успешно создана.",
    saved: "Запись о поступлении данных сохранена.",
    deleted: "Запись о поступлении данных удалена.",
  },
};

export function OpenDataAdmin({
  tab = "settings",
  searchState = {},
  settings,
  metrics,
  categories,
  updates,
}: Props) {
  const currentTab: OpenDataAdminTab =
    tab === "metrics" || tab === "categories" || tab === "updates" ? tab : "settings";

  const flashMessages = currentTab === "settings" ? null : tabSuccessMessages[currentTab];

  const stats = {
    totalMetrics: metrics.length,
    homepageMetrics: metrics.filter((m) => m.is_visible && m.show_on_homepage).length,
    totalCategories: categories.length,
    homepageCategories: categories.filter((c) => c.is_visible && c.show_on_homepage).length,
    totalUpdates: updates.length,
    publishedUpdates: updates.filter((u) => u.is_published).length,
  };

  return (
    <div className="content-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <span>Наука</span>
        <span>/</span>
        <strong>Open Data Aktobe</strong>
      </nav>

      <div className="page-heading media-page-heading">
        <div>
          <p className="page-kicker">Научная инфраструктура</p>
          <h1>Open Data Aktobe</h1>
          <p>
            Единая база научных данных Актюбинской области: настройки раздела, показатели,
            направления сбора и последние поступления данных.
          </p>
        </div>
        {currentTab === "metrics" ||
        currentTab === "categories" ||
        (currentTab === "updates" && categories.length > 0) ? (
          <div className="heading-actions">
            {currentTab === "metrics" ? (
              <Link href={`${basePath}/metrics/new`} className="primary-button">
                <Plus size={16} aria-hidden="true" />
                <span>Добавить показатель</span>
              </Link>
            ) : currentTab === "categories" ? (
              <Link href={`${basePath}/categories/new`} className="primary-button">
                <Plus size={16} aria-hidden="true" />
                <span>Добавить категорию</span>
              </Link>
            ) : (
              <Link href={`${basePath}/updates/new`} className="primary-button">
                <Plus size={16} aria-hidden="true" />
                <span>Добавить поступление</span>
              </Link>
            )}
          </div>
        ) : null}
      </div>

      <nav className="opendata-admin-tabs" aria-label="Разделы Open Data">
        <Link
          href={`${basePath}?tab=settings`}
          className="opendata-admin-tab"
          aria-current={currentTab === "settings" ? "page" : undefined}
        >
          <Settings2 size={16} aria-hidden="true" />
          <span>Общие настройки</span>
        </Link>
        <Link
          href={`${basePath}?tab=metrics`}
          className="opendata-admin-tab"
          aria-current={currentTab === "metrics" ? "page" : undefined}
        >
          <BarChart3 size={16} aria-hidden="true" />
          <span>Показатели</span>
          <span className="opendata-admin-tab-count">{metrics.length}</span>
        </Link>
        <Link
          href={`${basePath}?tab=categories`}
          className="opendata-admin-tab"
          aria-current={currentTab === "categories" ? "page" : undefined}
        >
          <FolderKanban size={16} aria-hidden="true" />
          <span>Категории</span>
          <span className="opendata-admin-tab-count">{categories.length}</span>
        </Link>
        <Link
          href={`${basePath}?tab=updates`}
          className="opendata-admin-tab"
          aria-current={currentTab === "updates" ? "page" : undefined}
        >
          <FileSpreadsheet size={16} aria-hidden="true" />
          <span>Поступления данных</span>
          <span className="opendata-admin-tab-count">{updates.length}</span>
        </Link>
      </nav>

      {flashMessages && searchState.created === "1" ? (
        <div role="status" className="notice success-notice">
          {flashMessages.created}
        </div>
      ) : null}
      {flashMessages && searchState.saved === "1" ? (
        <div role="status" className="notice success-notice">
          {flashMessages.saved}
        </div>
      ) : null}
      {flashMessages && searchState.deleted === "1" ? (
        <div role="status" className="notice success-notice">
          {flashMessages.deleted}
        </div>
      ) : null}
      {searchState.error ? (
        <div role="alert" className="notice error-notice">
          {openDataErrorMessage(searchState.error)}
        </div>
      ) : null}

      {currentTab === "settings" ? (
        <OpenDataSettingsForm settings={settings} stats={stats} />
      ) : currentTab === "metrics" ? (
        <OpenDataMetricsManager metrics={metrics} filters={searchState} />
      ) : currentTab === "categories" ? (
        <OpenDataCategoriesManager categories={categories} filters={searchState} />
      ) : (
        <OpenDataUpdatesManager
          updates={updates}
          categories={categories}
          filters={searchState}
        />
      )}
    </div>
  );
}
