"use server";

import { revalidateLocalizedPath as revalidatePath } from "@/lib/i18n/revalidation";
import { redirect } from "next/navigation";
import { purgeDeletedRecordSchema, restoreDeletedRecordSchema } from "@/lib/validation/deleted-records";
import { databaseErrorCode } from "@/lib/security/database-error";
import { canPurgeDeletedRecords, DeletedRecordsService } from "@/server/services/deleted-records.service";
import { getAdminAccess } from "@/server/services/access.service";
import { ArticleService, ArticleServiceError } from "@/server/services/article.service";
import { ScientistService, ScientistServiceError } from "@/server/services/scientist.service";

export async function restoreDeletedRecord(formData: FormData) {
  const parsed = restoreDeletedRecordSchema.safeParse({
    kind: formData.get("kind"), id: formData.get("id"),
    expectedDeletedAt: formData.get("expectedDeletedAt"), confirm: formData.get("confirm"),
  });
  if (!parsed.success) redirect("/admin/deleted?error=validation");
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") redirect("/admin/deleted?error=forbidden");
  const { kind, id, expectedDeletedAt } = parsed.data;
  try {
    if (kind === "article") await new ArticleService().restoreDeleted(result.access, id, expectedDeletedAt);
    else await new ScientistService().restoreDeleted(result.access, id, expectedDeletedAt);
  } catch (error) {
    const reason = error instanceof ArticleServiceError || error instanceof ScientistServiceError ? error.code : "action_failed";
    redirect(`/admin/deleted?kind=${kind}&error=${reason}`);
  }
  revalidatePath("/admin/deleted");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/content/articles", "layout");
  revalidatePath("/admin/science/scientists", "layout");
  // Both sides of editorial/scientific links may change public visibility.
  for (const path of ["/journal", "/scientists", "/projects", "/research", "/events", "/publications", "/mentorship", "/research-program"]) {
    revalidatePath(path, "layout");
  }
  redirect(`/admin/deleted?kind=${kind}&restored=1`);
}

export async function purgeDeletedRecord(formData: FormData) {
  const parsed = purgeDeletedRecordSchema.safeParse({
    kind: formData.get("kind"), id: formData.get("id"),
    expectedDeletedAt: formData.get("expectedDeletedAt"), confirm: formData.get("confirm"),
  });
  if (!parsed.success) redirect("/admin/deleted?error=validation");
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed" || !canPurgeDeletedRecords(result.access)) redirect("/admin/deleted?error=forbidden");
  const { kind } = parsed.data;
  try {
    await new DeletedRecordsService().purge(result.access, parsed.data);
  } catch (error) {
    const reason = databaseErrorCode(error) ?? "action_failed";
    redirect(`/admin/deleted?kind=${kind}&error=${reason}`);
  }
  revalidatePath("/admin/deleted");
  revalidatePath("/admin/audit");
  // Deleted records are already absent from public reads; expire cached links too.
  revalidatePath("/", "layout");
  redirect(`/admin/deleted?kind=${kind}&purged=1`);
}
