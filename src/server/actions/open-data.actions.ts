"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { invalidatePublicContent } from "@/lib/i18n/revalidation";
import { locales } from "@/lib/i18n/locales";
import { databaseErrorCode } from "@/lib/security/database-error";
import { getAdminAccess } from "@/server/services/access.service";
import { OpenDataService } from "@/server/services/open-data.service";

function revalidateAllOpenData() {
  invalidatePublicContent();
  revalidatePath("/admin/science/open-data", "layout");
  for (const locale of locales) {
    revalidatePath(`/${locale}`, "layout");
    revalidatePath(`/${locale}/open-data`, "layout");
  }
}

function normalizeOpenDataError(error: unknown): string {
  if (error instanceof ZodError) return "validation";
  const dbCode = databaseErrorCode(error);
  if (dbCode === "23505" || dbCode === "slug_conflict") return "duplicate";
  if (dbCode) return dbCode;
  if (error instanceof Error && ["forbidden", "validation", "not_found", "duplicate"].includes(error.message)) {
    return error.message;
  }
  return "action_failed";
}

export async function saveOpenDataSettingsAction(
  data: unknown
): Promise<{ success?: boolean; error?: string }> {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return { error: "forbidden" };

  try {
    const service = new OpenDataService();
    await service.updateSettings(access.access, data);
    revalidateAllOpenData();
    return { success: true };
  } catch (error) {
    return { error: normalizeOpenDataError(error) };
  }
}

export async function saveOpenDataMetricAction(
  data: unknown
): Promise<{ success?: boolean; id?: string; error?: string }> {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return { error: "forbidden" };

  try {
    const service = new OpenDataService();
    const saved = await service.saveMetric(access.access, data);
    revalidateAllOpenData();
    return { success: true, id: saved.id };
  } catch (error) {
    return { error: normalizeOpenDataError(error) };
  }
}

export async function deleteOpenDataMetricAction(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return { error: "forbidden" };

  try {
    const service = new OpenDataService();
    await service.deleteMetric(access.access, id);
    revalidateAllOpenData();
    return { success: true };
  } catch (error) {
    return { error: normalizeOpenDataError(error) };
  }
}

export async function saveOpenDataCategoryAction(
  data: unknown
): Promise<{ success?: boolean; id?: string; error?: string }> {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return { error: "forbidden" };

  try {
    const service = new OpenDataService();
    const saved = await service.saveCategory(access.access, data);
    revalidateAllOpenData();
    return { success: true, id: saved.id };
  } catch (error) {
    return { error: normalizeOpenDataError(error) };
  }
}

export async function deleteOpenDataCategoryAction(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return { error: "forbidden" };

  try {
    const service = new OpenDataService();
    await service.deleteCategory(access.access, id);
    revalidateAllOpenData();
    return { success: true };
  } catch (error) {
    return { error: normalizeOpenDataError(error) };
  }
}

export async function saveOpenDataUpdateAction(
  data: unknown
): Promise<{ success?: boolean; id?: string; error?: string }> {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return { error: "forbidden" };

  try {
    const service = new OpenDataService();
    const saved = await service.saveUpdate(access.access, data);
    revalidateAllOpenData();
    return { success: true, id: saved.id };
  } catch (error) {
    return { error: normalizeOpenDataError(error) };
  }
}

export async function deleteOpenDataUpdateAction(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return { error: "forbidden" };

  try {
    const service = new OpenDataService();
    await service.deleteUpdate(access.access, id);
    revalidateAllOpenData();
    return { success: true };
  } catch (error) {
    return { error: normalizeOpenDataError(error) };
  }
}
