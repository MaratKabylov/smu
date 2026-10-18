"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidateLocalizedPath } from "@/lib/i18n/revalidation";
import { databaseErrorCode } from "@/lib/security/database-error";
import { opportunityAdminPath, opportunityInputSchema, opportunityStatuses } from "@/lib/validation/opportunity";
import { getAdminAccess } from "@/server/services/access.service";
import { OpportunityService } from "@/server/services/opportunity.service";

async function access() {
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") redirect("/admin");
  return result.access;
}
function invalidate() {
  revalidateLocalizedPath(opportunityAdminPath, "layout");
  revalidateLocalizedPath("/opportunities", "layout");
  revalidateLocalizedPath("/search", "layout");
}
const deadlineSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .refine(value => z.iso.datetime({ local: true }).safeParse(value + ":00").success)
  .transform(value => new Date(value + ":00+05:00").toISOString());
export async function saveOpportunity(id: string | null, version: number | null, _previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const userAccess = await access();
  const translations = ["ru", "kk", "en"].map(locale => ({ locale, ...Object.fromEntries(
    ["title", "slug", "summary", "description", "organization", "funding"].map(key => [key, String(form.get(key + "_" + locale) ?? "")])) }))
    .filter(t => t.locale !== "en" || Object.entries(t).some(([key, value]) => key !== "locale" && value.trim()));
  const deadline = form.get("deadline") === "" ? { success: true as const, data: null } : deadlineSchema.safeParse(form.get("deadline"));
  if (!deadline.success) return { error: "validation" };
  const parsed = opportunityInputSchema.safeParse({ id, version, translations, type: form.get("type"), country: form.get("country"), sourceUrl: form.get("sourceUrl"), deadline: deadline.data });
  if (!parsed.success) return { error: "validation" };
  let saved: string;
  try { saved = await new OpportunityService().save(userAccess, parsed.data); }
  catch (error) { return { error: databaseErrorCode(error) ?? "action_failed" }; }
  invalidate();
  redirect(opportunityAdminPath + "/" + saved + "?saved=1");
}
export async function changeOpportunityStatus(id: string, version: number, status: string) {
  const userAccess = await access();
  const parsed = z.object({ id: z.uuid(), version: z.number().int().positive(), status: z.enum(opportunityStatuses) }).safeParse({ id, version, status });
  if (!parsed.success) redirect(opportunityAdminPath + "?error=validation");
  try { await new OpportunityService().changeStatus(userAccess, parsed.data.id, parsed.data.version, parsed.data.status); }
  catch (error) { redirect(opportunityAdminPath + "/" + id + "?error=" + (databaseErrorCode(error) ?? "action_failed")); }
  invalidate();
  redirect(opportunityAdminPath + "/" + id + "?saved=1");
}
