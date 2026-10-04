"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminAccess } from "@/server/services/access.service";
import { ArticleServiceError } from "@/server/services/article.service";
import { ArticleRevisionService } from "@/server/services/article-revision.service";

const idSchema = z.uuid();
const versionSchema = z.number().int().positive();
async function requireAccess(path: string) {
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") redirect(`${path}?error=forbidden`);
  return result.access;
}
function errorReason(error: unknown) {
  return error instanceof ArticleServiceError ? error.code : "action_failed";
}

export async function createArticleRevision(id: string, expectedVersion: number) {
  if (!idSchema.safeParse(id).success || !versionSchema.safeParse(expectedVersion).success) {
    redirect("/admin/content/articles?error=validation");
  }
  const path = `/admin/content/articles/${id}/revisions`;
  const access = await requireAccess(path);
  let revisionId: string;
  try { revisionId = await new ArticleRevisionService().create(access, id, expectedVersion); }
  catch (error) { redirect(`${path}?error=${errorReason(error)}`); }
  revalidatePath(path);
  redirect(`${path}?revision=${revisionId}&created=1`);
}

export async function restoreArticleRevision(id: string, revisionId: string, expectedVersion: number, formData: FormData) {
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(revisionId).success || !versionSchema.safeParse(expectedVersion).success) {
    redirect("/admin/content/articles?error=validation");
  }
  const path = `/admin/content/articles/${id}/revisions`;
  if (formData.get("confirm") !== "yes") redirect(`${path}?revision=${revisionId}&error=confirm_restore`);
  const access = await requireAccess(path);
  try { await new ArticleRevisionService().restore(access, id, revisionId, expectedVersion); }
  catch (error) { redirect(`${path}?revision=${revisionId}&error=${errorReason(error)}`); }
  revalidatePath("/admin/content/articles", "layout");
  revalidatePath("/journal", "layout");
  redirect(`/admin/content/articles/${id}?restored=1`);
}
