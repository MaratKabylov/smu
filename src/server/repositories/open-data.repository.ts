import "server-only";
import type { DatabaseClient } from "@/lib/supabase/database";
import type { Locale } from "@/lib/i18n/locales";
import type {
  OpenDataSettingsRow,
  OpenDataMetricRow,
  OpenDataCategoryRow,
  OpenDataUpdateRow,
  OpenDataUpdateWithCategory,
  PublicOpenDataPayload,
  HomepageOpenDataPayload,
  PublicOpenDataMetric,
  PublicOpenDataCategory,
  PublicOpenDataUpdate,
} from "@/types/domain/open-data";
import {
  openDataCategoryStatusLabels,
  type OpenDataCategoryInput,
  type OpenDataMetricInput,
  type OpenDataSettingsInput,
  type OpenDataUpdateInput,
} from "@/lib/validation/open-data";

type JoinedUpdateRow = OpenDataUpdateRow & {
  open_data_categories?: {
    id: string;
    slug: string;
    title_ru: string;
    title_kk: string;
    icon: string;
  } | null;
};

export class OpenDataRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getSettings(): Promise<OpenDataSettingsRow | null> {
    const { data, error } = await this.client
      .from("open_data_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async updateSettings(input: OpenDataSettingsInput): Promise<OpenDataSettingsRow> {
    const existing = await this.getSettings();
    if (!existing) {
      const { data, error } = await this.client
        .from("open_data_settings")
        .insert({
          title_ru: input.title_ru,
          title_kk: input.title_kk,
          subtitle_ru: input.subtitle_ru,
          subtitle_kk: input.subtitle_kk,
          short_description_ru: input.short_description_ru,
          short_description_kk: input.short_description_kk,
          description_ru: input.description_ru,
          description_kk: input.description_kk,
          status: input.status,
          status_text_ru: input.status_text_ru,
          status_text_kk: input.status_text_kk,
          collaboration_text_ru: input.collaboration_text_ru,
          collaboration_text_kk: input.collaboration_text_kk,
          is_published: input.is_published,
          show_on_homepage: input.show_on_homepage,
          data_updated_at: input.data_updated_at,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await this.client
      .from("open_data_settings")
      .update({
        title_ru: input.title_ru,
        title_kk: input.title_kk,
        subtitle_ru: input.subtitle_ru,
        subtitle_kk: input.subtitle_kk,
        short_description_ru: input.short_description_ru,
        short_description_kk: input.short_description_kk,
        description_ru: input.description_ru,
        description_kk: input.description_kk,
        status: input.status,
        status_text_ru: input.status_text_ru,
        status_text_kk: input.status_text_kk,
        collaboration_text_ru: input.collaboration_text_ru,
        collaboration_text_kk: input.collaboration_text_kk,
        is_published: input.is_published,
        show_on_homepage: input.show_on_homepage,
        data_updated_at: input.data_updated_at,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async listMetrics(): Promise<OpenDataMetricRow[]> {
    const { data, error } = await this.client
      .from("open_data_metrics")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async getMetricById(id: string): Promise<OpenDataMetricRow | null> {
    const { data, error } = await this.client
      .from("open_data_metrics")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async saveMetric(input: OpenDataMetricInput): Promise<OpenDataMetricRow> {
    if (input.id) {
      const { data, error } = await this.client
        .from("open_data_metrics")
        .update({
          code: input.code,
          title_ru: input.title_ru,
          title_kk: input.title_kk,
          value_numeric: input.value_numeric,
          value_text_ru: input.value_text_ru,
          value_text_kk: input.value_text_kk,
          unit_ru: input.unit_ru,
          unit_kk: input.unit_kk,
          icon: input.icon,
          sort_order: input.sort_order,
          is_visible: input.is_visible,
          show_on_homepage: input.show_on_homepage,
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await this.client
      .from("open_data_metrics")
      .insert({
        code: input.code,
        title_ru: input.title_ru,
        title_kk: input.title_kk,
        value_numeric: input.value_numeric,
        value_text_ru: input.value_text_ru,
        value_text_kk: input.value_text_kk,
        unit_ru: input.unit_ru,
        unit_kk: input.unit_kk,
        icon: input.icon,
        sort_order: input.sort_order,
        is_visible: input.is_visible,
        show_on_homepage: input.show_on_homepage,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteMetric(id: string): Promise<void> {
    const { error } = await this.client
      .from("open_data_metrics")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }

  async listCategories(): Promise<OpenDataCategoryRow[]> {
    const { data, error } = await this.client
      .from("open_data_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async getCategoryById(id: string): Promise<OpenDataCategoryRow | null> {
    const { data, error } = await this.client
      .from("open_data_categories")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async saveCategory(input: OpenDataCategoryInput): Promise<OpenDataCategoryRow> {
    if (input.id) {
      const { data, error } = await this.client
        .from("open_data_categories")
        .update({
          slug: input.slug,
          title_ru: input.title_ru,
          title_kk: input.title_kk,
          description_ru: input.description_ru,
          description_kk: input.description_kk,
          icon: input.icon,
          dataset_count: input.dataset_count,
          status: input.status,
          sort_order: input.sort_order,
          is_visible: input.is_visible,
          show_on_homepage: input.show_on_homepage,
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await this.client
      .from("open_data_categories")
      .insert({
        slug: input.slug,
        title_ru: input.title_ru,
        title_kk: input.title_kk,
        description_ru: input.description_ru,
        description_kk: input.description_kk,
        icon: input.icon,
        dataset_count: input.dataset_count,
        status: input.status,
        sort_order: input.sort_order,
        is_visible: input.is_visible,
        show_on_homepage: input.show_on_homepage,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await this.client
      .from("open_data_categories")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }

  async listUpdates(): Promise<OpenDataUpdateWithCategory[]> {
    const { data, error } = await this.client
      .from("open_data_updates")
      .select("*, open_data_categories(id, slug, title_ru, title_kk, icon)")
      .order("received_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return ((data ?? []) as unknown as JoinedUpdateRow[]).map(row => ({
      ...row,
      category: row.open_data_categories,
    }));
  }

  async getUpdateById(id: string): Promise<OpenDataUpdateWithCategory | null> {
    const { data, error } = await this.client
      .from("open_data_updates")
      .select("*, open_data_categories(id, slug, title_ru, title_kk, icon)")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as JoinedUpdateRow;
    return {
      ...row,
      category: row.open_data_categories,
    };
  }

  async saveUpdate(input: OpenDataUpdateInput): Promise<OpenDataUpdateRow> {
    if (input.id) {
      const { data, error } = await this.client
        .from("open_data_updates")
        .update({
          category_id: input.category_id,
          title_ru: input.title_ru,
          title_kk: input.title_kk,
          description_ru: input.description_ru,
          description_kk: input.description_kk,
          source_name: input.source_name,
          source_url: input.source_url,
          period_start: input.period_start,
          period_end: input.period_end,
          received_at: input.received_at,
          is_published: input.is_published,
        })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await this.client
      .from("open_data_updates")
      .insert({
        category_id: input.category_id,
        title_ru: input.title_ru,
        title_kk: input.title_kk,
        description_ru: input.description_ru,
        description_kk: input.description_kk,
        source_name: input.source_name,
        source_url: input.source_url,
        period_start: input.period_start,
        period_end: input.period_end,
        received_at: input.received_at,
        is_published: input.is_published,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteUpdate(id: string): Promise<void> {
    const { error } = await this.client
      .from("open_data_updates")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }

  async getPublicOverview(locale: Locale): Promise<PublicOpenDataPayload | null> {
    const settings = await this.getSettings();
    if (!settings || !settings.is_published) {
      return null;
    }

    const [metricsRes, categoriesRes, updatesRes] = await Promise.all([
      this.client
        .from("open_data_metrics")
        .select("*")
        .eq("is_visible", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      this.client
        .from("open_data_categories")
        .select("*")
        .eq("is_visible", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      this.client
        .from("open_data_updates")
        .select("*, open_data_categories(id, slug, title_ru, title_kk, icon)")
        .eq("is_published", true)
        .order("received_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (metricsRes.error) throw metricsRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (updatesRes.error) throw updatesRes.error;

    const rawMetrics: OpenDataMetricRow[] = metricsRes.data ?? [];
    const rawCategories: OpenDataCategoryRow[] = categoriesRes.data ?? [];
    const rawUpdates = (updatesRes.data ?? []) as unknown as JoinedUpdateRow[];

    const isKk = locale === "kk";

    // Filter metrics with filled values (per TZ 5.2 & 10: missing values not displayed)
    const filledMetrics = rawMetrics.filter(
      (m) => m.value_numeric !== null || (isKk ? m.value_text_kk : m.value_text_ru) !== null
    );

    const publicMetrics: PublicOpenDataMetric[] = filledMetrics.map((m) => ({
      id: m.id,
      code: m.code,
      title: isKk ? m.title_kk : m.title_ru,
      valueNumeric: m.value_numeric,
      valueText: isKk ? m.value_text_kk : m.value_text_ru,
      unit: isKk ? m.unit_kk : m.unit_ru,
      icon: m.icon,
      sortOrder: m.sort_order,
    }));

    // Find max dataset count for relative indicators
    let maxDatasetCount = 0;
    for (const c of rawCategories) {
      if (c.dataset_count !== null && c.dataset_count > maxDatasetCount) {
        maxDatasetCount = c.dataset_count;
      }
    }

    const publicCategories: PublicOpenDataCategory[] = rawCategories.map((c) => {
      const count = c.dataset_count;
      const relativeShare =
        maxDatasetCount > 0 && count !== null
          ? Math.round((count / maxDatasetCount) * 100)
          : 0;

      const statusLabels = openDataCategoryStatusLabels[locale] ?? openDataCategoryStatusLabels.ru;
      return {
        id: c.id,
        slug: c.slug,
        title: isKk ? c.title_kk : c.title_ru,
        description: isKk ? c.description_kk : c.description_ru,
        icon: c.icon,
        datasetCount: count,
        status: c.status,
        statusLabel: statusLabels[c.status] ?? c.status,
        relativeShare,
        sortOrder: c.sort_order,
      };
    });

    const publicUpdates: PublicOpenDataUpdate[] = rawUpdates.map((u) => {
      const cat = u.open_data_categories;
      return {
        id: u.id,
        categoryId: u.category_id,
        categoryTitle: cat ? (isKk ? cat.title_kk : cat.title_ru) : "",
        categoryIcon: cat?.icon ?? "folder",
        title: isKk ? u.title_kk : u.title_ru,
        description: isKk ? u.description_kk : u.description_ru,
        sourceName: u.source_name,
        sourceUrl: u.source_url,
        periodStart: u.period_start,
        periodEnd: u.period_end,
        receivedAt: u.received_at,
      };
    });

    return {
      isPublished: settings.is_published,
      showOnHomepage: settings.show_on_homepage,
      title: isKk ? settings.title_kk : settings.title_ru,
      subtitle: isKk ? settings.subtitle_kk : settings.subtitle_ru,
      shortDescription: isKk ? settings.short_description_kk : settings.short_description_ru,
      description: isKk ? settings.description_kk : settings.description_ru,
      status: settings.status,
      statusText: isKk ? settings.status_text_kk : settings.status_text_ru,
      collaborationText: isKk ? settings.collaboration_text_kk : settings.collaboration_text_ru,
      dataUpdatedAt: settings.data_updated_at,
      metrics: publicMetrics,
      categories: publicCategories,
      latestUpdates: publicUpdates,
      hasFilledMetrics: publicMetrics.length > 0,
    };
  }

  async getHomepageData(locale: Locale): Promise<HomepageOpenDataPayload | null> {
    const [settingsRes, metricsRes, categoriesRes] = await Promise.all([
      this.client
        .from("open_data_settings")
        .select("is_published, show_on_homepage, title_ru, title_kk, subtitle_ru, subtitle_kk, short_description_ru, short_description_kk, status_text_ru, status_text_kk")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      this.client
        .from("open_data_metrics")
        .select("id, code, title_ru, title_kk, value_numeric, value_text_ru, value_text_kk, unit_ru, unit_kk, icon, sort_order")
        .eq("is_visible", true)
        .eq("show_on_homepage", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(4),
      this.client
        .from("open_data_categories")
        .select("id, slug, title_ru, title_kk, description_ru, description_kk, icon, dataset_count, status, sort_order")
        .eq("is_visible", true)
        .eq("show_on_homepage", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(6),
    ]);

    if (settingsRes.error) throw settingsRes.error;
    const settings = settingsRes.data;
    if (!settings || !settings.is_published || !settings.show_on_homepage) {
      return null;
    }

    if (metricsRes.error) throw metricsRes.error;
    if (categoriesRes.error) throw categoriesRes.error;

    const isKk = locale === "kk";
    const rawMetrics = metricsRes.data ?? [];
    const rawCategories = categoriesRes.data ?? [];

    const filledMetrics = rawMetrics.filter(
      (m) => m.value_numeric !== null || (isKk ? m.value_text_kk : m.value_text_ru) !== null
    );

    const publicMetrics: PublicOpenDataMetric[] = filledMetrics.map((m) => ({
      id: m.id,
      code: m.code,
      title: isKk ? m.title_kk : m.title_ru,
      valueNumeric: m.value_numeric,
      valueText: isKk ? m.value_text_kk : m.value_text_ru,
      unit: isKk ? m.unit_kk : m.unit_ru,
      icon: m.icon,
      sortOrder: m.sort_order,
    }));

    let maxDatasetCount = 0;
    for (const c of rawCategories) {
      if (c.dataset_count !== null && c.dataset_count > maxDatasetCount) {
        maxDatasetCount = c.dataset_count;
      }
    }

    const publicCategories: PublicOpenDataCategory[] = rawCategories.map((c) => {
      const count = c.dataset_count;
      const relativeShare =
        maxDatasetCount > 0 && count !== null
          ? Math.round((count / maxDatasetCount) * 100)
          : 0;

      const statusLabels = openDataCategoryStatusLabels[locale] ?? openDataCategoryStatusLabels.ru;
      return {
        id: c.id,
        slug: c.slug,
        title: isKk ? c.title_kk : c.title_ru,
        description: isKk ? c.description_kk : c.description_ru,
        icon: c.icon,
        datasetCount: count,
        status: c.status,
        statusLabel: statusLabels[c.status] ?? c.status,
        relativeShare,
        sortOrder: c.sort_order,
      };
    });

    return {
      isPublished: settings.is_published,
      showOnHomepage: settings.show_on_homepage,
      title: isKk ? settings.title_kk : settings.title_ru,
      subtitle: isKk ? settings.subtitle_kk : settings.subtitle_ru,
      shortDescription: isKk ? settings.short_description_kk : settings.short_description_ru,
      statusText: isKk ? settings.status_text_kk : settings.status_text_ru,
      metrics: publicMetrics,
      categories: publicCategories,
      hasFilledMetrics: publicMetrics.length > 0,
    };
  }
}
