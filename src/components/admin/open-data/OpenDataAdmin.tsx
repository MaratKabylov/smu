import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type {
  OpenDataCategoryRow,
  OpenDataMetricRow,
  OpenDataSettingsRow,
  OpenDataUpdateWithCategory,
} from "@/types/domain/open-data";
import { OpenDataSettingsForm } from "./OpenDataSettingsForm";
import { OpenDataMetricsManager } from "./OpenDataMetricsManager";
import { OpenDataCategoriesManager } from "./OpenDataCategoriesManager";
import { OpenDataUpdatesManager } from "./OpenDataUpdatesManager";

type Props = {
  tab?: string;
  settings: OpenDataSettingsRow | null;
  metrics: OpenDataMetricRow[];
  categories: OpenDataCategoryRow[];
  updates: OpenDataUpdateWithCategory[];
};

export function OpenDataAdmin({
  tab = "settings",
  settings,
  metrics,
  categories,
  updates,
}: Props) {
  const currentTab = ["settings", "metrics", "categories", "updates"].includes(tab)
    ? tab
    : "settings";

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
            Единая база научных данных Актюбинской области: управление информационными показателями,
            направлениями сбора данных и последними поступлениями.
          </p>
        </div>
        <div className="heading-actions" style={{ display: "flex", gap: "10px" }}>
          <Link
            href="/ru/open-data"
            target="_blank"
            className="button-secondary"
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <ExternalLink size={14} /> На сайт (RU)
          </Link>
          <Link
            href="/kk/open-data"
            target="_blank"
            className="button-secondary"
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <ExternalLink size={14} /> На сайт (KZ)
          </Link>
        </div>
      </div>

      <nav className="content-page-tabs" aria-label="Разделы Open Data">
        <Link
          href="/admin/science/open-data?tab=settings"
          aria-current={currentTab === "settings" ? "page" : undefined}
        >
          Общие настройки
        </Link>
        <Link
          href="/admin/science/open-data?tab=metrics"
          aria-current={currentTab === "metrics" ? "page" : undefined}
        >
          Показатели ({metrics.length})
        </Link>
        <Link
          href="/admin/science/open-data?tab=categories"
          aria-current={currentTab === "categories" ? "page" : undefined}
        >
          Категории ({categories.length})
        </Link>
        <Link
          href="/admin/science/open-data?tab=updates"
          aria-current={currentTab === "updates" ? "page" : undefined}
        >
          Поступления данных ({updates.length})
        </Link>
      </nav>

      <section className="article-editor-panel content-slot" style={{ marginTop: "20px" }}>
        {currentTab === "settings" ? (
          <OpenDataSettingsForm settings={settings} />
        ) : currentTab === "metrics" ? (
          <OpenDataMetricsManager metrics={metrics} />
        ) : currentTab === "categories" ? (
          <OpenDataCategoriesManager categories={categories} />
        ) : (
          <OpenDataUpdatesManager updates={updates} categories={categories} />
        )}
      </section>
    </div>
  );
}
