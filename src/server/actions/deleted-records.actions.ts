"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { restoreDeletedRecordSchema } from "@/lib/validation/deleted-records";
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
  revalidatePath("/admin/content/articles", "layout");
  revalidatePath("/admin/science/scientists", "layout");
  // Both sides of editorial/scientific links may change public visibility.
  for (const path of ["/journal", "/scientists", "/projects", "/research", "/events", "/publications", "/mentorship", "/research-program"]) {
    revalidatePath(path, "layout");
  }
  redirect(`/admin/deleted?kind=${kind}&restored=1`);
}
