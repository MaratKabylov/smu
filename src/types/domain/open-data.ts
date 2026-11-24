import type { Database } from "@/types/database.types";

export type OpenDataCategoryStatus = "planned" | "collecting" | "processing" | "collected";

export const openDataCategoryStatuses: readonly OpenDataCategoryStatus[] = [
  "planned",
  "collecting",
  "processing",
  "collected",
] as const;

export type OpenDataSettingsRow = Database["public"]["Tables"]["open_data_settings"]["Row"];
export type OpenDataMetricRow = Database["public"]["Tables"]["open_data_metrics"]["Row"];
export type OpenDataCategoryRow = Database["public"]["Tables"]["open_data_categories"]["Row"];
export type OpenDataUpdateRow = Database["public"]["Tables"]["open_data_updates"]["Row"];

export type OpenDataUpdateWithCategory = OpenDataUpdateRow & {
  category?: {
    id: string;
    slug: string;
    title_ru: string;
    title_kk: string;
    icon: string;
  } | null;
};

export type PublicOpenDataMetric = {
  id: string;
  code: string;
  title: string;
  valueNumeric: number | null;
  valueText: string | null;
  unit: string;
  icon: string;
  sortOrder: number;
};

export type PublicOpenDataCategory = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  datasetCount: number | null;
  status: OpenDataCategoryStatus;
  statusLabel: string;
  relativeShare: number; // 0 to 100 for relative comparison bar
  sortOrder: number;
};

export type PublicOpenDataUpdate = {
  id: string;
  categoryId: string;
  categoryTitle: string;
  categoryIcon: string;
  title: string;
  description: string;
  sourceName: string;
  sourceUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  receivedAt: string;
};

export type PublicOpenDataPayload = {
  isPublished: boolean;
  showOnHomepage: boolean;
  title: string;
  subtitle: string;
  shortDescription: string;
  description: string;
  status: string;
  statusText: string;
  collaborationText: string;
  dataUpdatedAt: string;
  metrics: PublicOpenDataMetric[];
  categories: PublicOpenDataCategory[];
  latestUpdates: PublicOpenDataUpdate[];
  hasFilledMetrics: boolean;
};

export type HomepageOpenDataPayload = {
  isPublished: boolean;
  showOnHomepage: boolean;
  title: string;
  subtitle: string;
  shortDescription: string;
  statusText: string;
  metrics: PublicOpenDataMetric[];
  categories: PublicOpenDataCategory[];
  hasFilledMetrics: boolean;
};
