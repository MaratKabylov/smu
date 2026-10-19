"use server";

import { revalidatePath } from "next/cache";
import { invalidatePublicContent } from "@/lib/i18n/revalidation";
import { locales } from "@/lib/i18n/locales";
import { databaseErrorCode } from "@/lib/security/database-error";
import { saveSiteContentSchema } from "@/lib/validation/site-content";
import { getAdminAccess } from "@/server/services/access.service";
import { SiteContentService } from "@/server/services/site-content.service";

export async function saveSiteContent(value: unknown): Promise<{ error?: string; version?: number }> {
  const access = await getAdminAccess();
  if (access.state !== "allowed") return { error: "forbidden" };
  const parsed = saveSiteContentSchema.safeParse(value);
  if (!parsed.success) return { error: "invalid_input" };
  let version: number;
  try { version = await new SiteContentService().save(access.access, parsed.data); }
  catch (error) { return { error: databaseErrorCode(error) ?? "save_failed" }; }
  invalidatePublicContent();
  revalidatePath("/admin/content/pages");
  revalidatePath("/admin/content/homepage");
  revalidatePath("/admin/system/settings");
  for (const locale of locales) revalidatePath(`/${locale}`, "layout");
  return { version };
}
