"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidateLocalizedPath as revalidatePath } from "@/lib/i18n/revalidation";
import { publicationInputSchema } from "@/lib/validation/publication";
import { getAdminAccess } from "@/server/services/access.service";
import { PublicationService } from "@/server/services/publication.service";
import { ArticleServiceError } from "@/server/services/article.service";
export async function savePublication(formData: FormData) {
  const path = "/admin/science/publications";
  const rawId = formData.get("id");
  const id = rawId ? z.uuid().safeParse(rawId) : null;
  let coauthors: unknown;
  try { coauthors = JSON.parse(String(formData.get("coauthors") ?? "[]")); }
  catch { redirect(`${path}?error=validation`); }
  const input = publicationInputSchema.safeParse({ ...Object.fromEntries(formData), coauthors,
    workIds: formData.getAll("workIds"), expectedUpdatedAt: formData.get("expectedUpdatedAt") || undefined });
  if (!input.success || (id && !id.success)) redirect(`${path}?error=validation`);
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") redirect(`${path}?error=forbidden`);
  let savedId: string;
  try { savedId = await new PublicationService().save(result.access, id?.success ? id.data : null, input.data); }
  catch (error) { redirect(`${path}?${id?.success ? `edit=${id.data}&` : ""}error=${error instanceof ArticleServiceError ? error.code : "action_failed"}`); }
  for (const target of [path, "/publications", "/scientists", "/journal", "/research", "/projects"]) revalidatePath(target, "layout");
  redirect(`${path}?edit=${savedId}&saved=1`);
}
