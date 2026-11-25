import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { canManageOpenData } from "@/lib/permissions/permissions";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { publicCacheSeconds, publicContentTag } from "@/lib/supabase/public-cache";
import type { Locale } from "@/lib/i18n/locales";
import type { AccessContext } from "@/types/domain/auth";
import type {
  OpenDataCategoryRow,
  OpenDataMetricRow,
  OpenDataSettingsRow,
  OpenDataUpdateRow,
  OpenDataUpdateWithCategory,
  PublicOpenDataPayload,
  HomepageOpenDataPayload,
} from "@/types/domain/open-data";
import { OpenDataRepository } from "@/server/repositories/open-data.repository";
import {
  openDataCategoryInputSchema,
  openDataMetricInputSchema,
  openDataSettingsInputSchema,
  openDataUpdateInputSchema,
} from "@/lib/validation/open-data";

function assertOpenDataAccess(access: AccessContext) {
  if (!canManageOpenData(access)) {
    throw new Error("forbidden");
  }
}

async function fetchPublicOpenData(locale: Locale): Promise<PublicOpenDataPayload | null> {
  if (!isSupabaseConfigured()) return null;
  const client = createPublicSupabaseClient();
  return new OpenDataRepository(client).getPublicOverview(locale);
}

async function fetchHomepageOpenData(locale: Locale): Promise<HomepageOpenDataPayload | null> {
  if (!isSupabaseConfigured()) return null;
  const client = createPublicSupabaseClient();
  return new OpenDataRepository(client).getHomepageData(locale);
}

const getCachedPublicOpenData = unstable_cache(
  fetchPublicOpenData,
  ["public-open-data"],
  { revalidate: publicCacheSeconds, tags: [publicContentTag] }
);

const getCachedHomepageOpenData = unstable_cache(
  fetchHomepageOpenData,
  ["homepage-open-data"],
  { revalidate: publicCacheSeconds, tags: [publicContentTag] }
);

export const getPublicOpenData = cache((locale: Locale) => getCachedPublicOpenData(locale));
export const getHomepageOpenData = cache((locale: Locale) => getCachedHomepageOpenData(locale));

export class OpenDataService {
  private async getAdminRepository(access: AccessContext) {
    assertOpenDataAccess(access);
    const client = await createServerSupabaseClient();
    return new OpenDataRepository(client);
  }

  async getAdminData(access: AccessContext): Promise<{
    settings: OpenDataSettingsRow | null;
    metrics: OpenDataMetricRow[];
    categories: OpenDataCategoryRow[];
    updates: OpenDataUpdateWithCategory[];
  }> {
    const repo = await this.getAdminRepository(access);
    const [settings, metrics, categories, updates] = await Promise.all([
      repo.getSettings(),
      repo.listMetrics(),
      repo.listCategories(),
      repo.listUpdates(),
    ]);

    return { settings, metrics, categories, updates };
  }

  async updateSettings(
    access: AccessContext,
    raw: unknown
  ): Promise<OpenDataSettingsRow> {
    assertOpenDataAccess(access);
    const input = openDataSettingsInputSchema.parse(raw);
    const repo = await this.getAdminRepository(access);
    return repo.updateSettings(input);
  }

  async getMetricById(
    access: AccessContext,
    id: string
  ): Promise<OpenDataMetricRow | null> {
    const repo = await this.getAdminRepository(access);
    return repo.getMetricById(id);
  }

  async listMetrics(access: AccessContext): Promise<OpenDataMetricRow[]> {
    const repo = await this.getAdminRepository(access);
    return repo.listMetrics();
  }

  async saveMetric(
    access: AccessContext,
    raw: unknown
  ): Promise<OpenDataMetricRow> {
    assertOpenDataAccess(access);
    const input = openDataMetricInputSchema.parse(raw);
    const repo = await this.getAdminRepository(access);
    return repo.saveMetric(input);
  }

  async deleteMetric(
    access: AccessContext,
    id: string
  ): Promise<void> {
    assertOpenDataAccess(access);
    const repo = await this.getAdminRepository(access);
    return repo.deleteMetric(id);
  }

  async getCategoryById(
    access: AccessContext,
    id: string
  ): Promise<OpenDataCategoryRow | null> {
    const repo = await this.getAdminRepository(access);
    return repo.getCategoryById(id);
  }

  async listCategories(access: AccessContext): Promise<OpenDataCategoryRow[]> {
    const repo = await this.getAdminRepository(access);
    return repo.listCategories();
  }

  async saveCategory(
    access: AccessContext,
    raw: unknown
  ): Promise<OpenDataCategoryRow> {
    assertOpenDataAccess(access);
    const input = openDataCategoryInputSchema.parse(raw);
    const repo = await this.getAdminRepository(access);
    return repo.saveCategory(input);
  }

  async deleteCategory(
    access: AccessContext,
    id: string
  ): Promise<void> {
    assertOpenDataAccess(access);
    const repo = await this.getAdminRepository(access);
    return repo.deleteCategory(id);
  }

  async getUpdateById(
    access: AccessContext,
    id: string
  ): Promise<OpenDataUpdateWithCategory | null> {
    const repo = await this.getAdminRepository(access);
    return repo.getUpdateById(id);
  }

  async saveUpdate(
    access: AccessContext,
    raw: unknown
  ): Promise<OpenDataUpdateRow> {
    assertOpenDataAccess(access);
    const input = openDataUpdateInputSchema.parse(raw);
    const repo = await this.getAdminRepository(access);
    return repo.saveUpdate(input);
  }

  async deleteUpdate(
    access: AccessContext,
    id: string
  ): Promise<void> {
    assertOpenDataAccess(access);
    const repo = await this.getAdminRepository(access);
    return repo.deleteUpdate(id);
  }
}
