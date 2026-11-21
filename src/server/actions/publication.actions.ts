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
  try {
    coauthors = JSON.parse(String(formData.get("coauthors") ?? "[]"));
  } catch {
    redirect(`${path}?error=validation`);
  }

  // Parse translations if present
  const translations: Array<{ locale: "ru" | "kk" | "en"; slug: string; title: string; summary: string }> = [];

  const titleRu = String(formData.get("titleRu") || formData.get("title") || "").trim();
  const slugRu = String(formData.get("slugRu") || "").trim();
  const summaryRu = String(formData.get("summaryRu") || "").trim();
  if (titleRu) {
    translations.push({
      locale: "ru",
      title: titleRu,
      slug: slugRu || `pub-${Date.now().toString(36)}`,
      summary: summaryRu,
    });
  }

  const titleKk = String(formData.get("titleKk") || "").trim();
  const slugKk = String(formData.get("slugKk") || "").trim();
  const summaryKk = String(formData.get("summaryKk") || "").trim();
  if (titleKk) {
    translations.push({
      locale: "kk",
      title: titleKk,
      slug: slugKk || `pub-kk-${Date.now().toString(36)}`,
      summary: summaryKk,
    });
  }

  const titleEn = String(formData.get("titleEn") || "").trim();
  const slugEn = String(formData.get("slugEn") || "").trim();
  const summaryEn = String(formData.get("summaryEn") || "").trim();
  if (titleEn) {
    translations.push({
      locale: "en",
      title: titleEn,
      slug: slugEn || `pub-en-${Date.now().toString(36)}`,
      summary: summaryEn,
    });
  }

  const rawFileMediaId = formData.get("fileMediaId");
  const fileMediaId = rawFileMediaId ? String(rawFileMediaId) : null;

  const input = publicationInputSchema.safeParse({
    ...Object.fromEntries(formData),
    title: titleRu || String(formData.get("title") || ""),
    fileMediaId: fileMediaId || null,
    coauthors,
    translations: translations.length > 0 ? translations : undefined,
    workIds: formData.getAll("workIds"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt") || undefined,
  });

  if (!input.success || (id && !id.success)) redirect(`${path}?error=validation`);
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") redirect(`${path}?error=forbidden`);
  let savedId: string;
  try {
    savedId = await new PublicationService().save(result.access, id?.success ? id.data : null, input.data);
  } catch (error) {
    redirect(`${path}?${id?.success ? `edit=${id.data}&` : ""}error=${error instanceof ArticleServiceError ? error.code : "action_failed"}`);
  }
  for (const target of [path, "/publications", "/scientists", "/journal", "/research", "/projects"]) {
    revalidatePath(target, "layout");
  }
  redirect(`${path}?edit=${savedId}&saved=1`);
}
