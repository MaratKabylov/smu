"use server";

import { revalidatePath } from "next/cache";
import { invalidatePublicContent } from "@/lib/i18n/revalidation";
import { locales } from "@/lib/i18n/locales";
import { databaseErrorCode } from "@/lib/security/database-error";
import { getAdminAccess } from "@/server/services/access.service";
import { OpenDataService } from "@/server/services/open-data.service";

function revalidateAllOpenData() {
  invalidatePublicContent();
  revalidatePath("/admin/science/open-data");
  for (const locale of locales) {
    revalidatePath(`/${locale}`, "layout");
    revalidatePath(`/${locale}/open-data`, "layout");
  }
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
    return { error: databaseErrorCode(error) ?? (error instanceof Error ? error.message : "action_failed") };
  }
}

export async function saveOpenDataMetricAction(
  data: unknown
): Promise<{ success?: boolean; error?: string }> {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return { error: "forbidden" };

  try {
    const service = new OpenDataService();
    await service.saveMetric(access.access, data);
    revalidateAllOpenData();
    return { success: true };
  } catch (error) {
    return { error: databaseErrorCode(error) ?? (error instanceof Error ? error.message : "action_failed") };
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
    return { error: databaseErrorCode(error) ?? (error instanceof Error ? error.message : "action_failed") };
  }
}

export async function saveOpenDataCategoryAction(
  data: unknown
): Promise<{ success?: boolean; error?: string }> {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return { error: "forbidden" };

  try {
    const service = new OpenDataService();
    await service.saveCategory(access.access, data);
    revalidateAllOpenData();
    return { success: true };
  } catch (error) {
    return { error: databaseErrorCode(error) ?? (error instanceof Error ? error.message : "action_failed") };
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
    return { error: databaseErrorCode(error) ?? (error instanceof Error ? error.message : "action_failed") };
  }
}

export async function saveOpenDataUpdateAction(
  data: unknown
): Promise<{ success?: boolean; error?: string }> {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return { error: "forbidden" };

  try {
    const service = new OpenDataService();
    await service.saveUpdate(access.access, data);
    revalidateAllOpenData();
    return { success: true };
  } catch (error) {
    return { error: databaseErrorCode(error) ?? (error instanceof Error ? error.message : "action_failed") };
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
    return { error: databaseErrorCode(error) ?? (error instanceof Error ? error.message : "action_failed") };
  }
}
