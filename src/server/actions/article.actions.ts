"use server";

import { revalidateLocalizedPath as revalidatePath } from "@/lib/i18n/revalidation";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  articleInputSchema,
  articleReviewConfigurationSchema,
  articleReviewDecisionSchema,
  articleStatusSchema,
  articleScheduleFormSchema, articleScheduleTimestampSchema,
  taxonomyInputSchema, taxonomyUpdateSchema, articleAuthorInputSchema,
} from "@/lib/validation/article";
import { getAdminAccess } from "@/server/services/access.service";
import {
  ArticleService,
  ArticleServiceError,
} from "@/server/services/article.service";

const articleIdSchema = z.uuid();

function articleInputFromFormData(formData: FormData) {
  function document(field: string) {
    const value = formData.get(field);
    if (!value) return undefined;
    try { return JSON.parse(String(value)); } catch { return null; }
  }
  return articleInputSchema.safeParse({
    expectedVersion: formData.get("expectedVersion") ? Number(formData.get("expectedVersion")) : undefined,
    relations: formData.has("relations") ? document("relations") : undefined,
    contentType: formData.get("contentType"),
    categoryId: formData.get("categoryId") ?? "",
    categoryIds: formData.has("creditsVersion") ? formData.getAll("categoryIds") : undefined,
    authors: formData.has("creditsVersion") ? document("authors") : undefined,
    coverMediaId: formData.get("coverMediaId"),
    tagIds: formData.getAll("tagIds"),
    ru: {
      title: formData.get("titleRu"),
      slug: formData.get("slugRu"),
      excerpt: formData.get("excerptRu"),
      body: formData.get("bodyRu"),
      contentJson: document("contentJsonRu"),
      seoTitle: formData.get("seoTitleRu"),
      seoDescription: formData.get("seoDescriptionRu"),
    },
    kk: {
      title: formData.get("titleKk"),
      slug: formData.get("slugKk"),
      excerpt: formData.get("excerptKk"),
      body: formData.get("bodyKk"),
      contentJson: document("contentJsonKk"),
      seoTitle: formData.get("seoTitleKk"),
      seoDescription: formData.get("seoDescriptionKk"),
    },
  });
}

export async function saveArticleDraft(id: string | null, formData: FormData): Promise<
  { ok: true; id: string; version: number } | { ok: false; error: string }
> {
  if (id !== null && !articleIdSchema.safeParse(id).success) return { ok: false, error: "validation" };
  const input = articleInputFromFormData(formData);
  if (!input.success || (id && !input.data.expectedVersion)) return { ok: false, error: "validation" };
  const result = await getAdminAccess();
  if (result.state !== "allowed") return { ok: false, error: "forbidden" };
  try {
    const service = new ArticleService();
    const version = id ? await service.update(result.access, id, input.data) : 1;
    const savedId = id ?? await service.create(result.access, input.data);
    // Keep the editing form mounted; the client refreshes workflow data only after
    // a save has completed and no further edits are waiting.
    revalidatePath("/journal", "layout");
    for (const path of ["/scientists", "/projects", "/research", "/events", "/publications"]) revalidatePath(path, "layout");
    return { ok: true, id: savedId, version };
  } catch (error) { return { ok: false, error: errorReason(error) }; }
}

async function requireAccess(fallback: string) {
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") redirect(`${fallback}?error=forbidden`);
  return result.access;
}

function errorReason(error: unknown) {
  if (!(error instanceof ArticleServiceError)) return "action_failed";
  return error.code;
}

function invalidateArticles() {
  revalidatePath("/admin/content/articles", "layout");
  revalidatePath("/journal", "layout");
  for (const path of ["/scientists", "/projects", "/research", "/events", "/publications"]) revalidatePath(path, "layout");
}

export async function assignArticleReviewer(id: string, formData: FormData) {
  const parsedId = articleIdSchema.safeParse(id);
  const reviewerId = formData.get("reviewerId");
  if (!parsedId.success || (reviewerId !== "" && !articleIdSchema.safeParse(reviewerId).success)) {
    redirect("/admin/content/articles?error=validation");
  }
  const access = await requireAccess(`/admin/content/articles/${parsedId.data}`);
  try {
    await new ArticleService().assignReviewer(access, parsedId.data, reviewerId === "" ? null : String(reviewerId));
  } catch (error) {
    redirect(`/admin/content/articles/${parsedId.data}?error=${errorReason(error)}`);
  }
  invalidateArticles();
  redirect(`/admin/content/articles/${parsedId.data}?reviewer_saved=1`);
}

export async function scheduleArticle(id: string, expectedVersion: number, expectedScheduledAt: string | null, formData: FormData) {
  const parsedId = articleIdSchema.safeParse(id);
  const version = z.number().int().positive().safeParse(expectedVersion);
  const previousTime = articleScheduleTimestampSchema.nullable().safeParse(expectedScheduledAt);
  const cancel = formData.get("intent") === "cancel";
  const time = cancel ? { success: true as const, data: null } : articleScheduleFormSchema.safeParse(formData.get("scheduledAt"));
  if (!parsedId.success || !version.success || !previousTime.success || !time.success) {
    redirect("/admin/content/articles?error=validation");
  }
  const access = await requireAccess(`/admin/content/articles/${parsedId.data}`);
  try {
    await new ArticleService().schedule(access, parsedId.data, {
      expectedVersion: version.data, expectedScheduledAt: previousTime.data, scheduledAt: time.data,
    });
  } catch (error) {
    redirect(`/admin/content/articles/${parsedId.data}?error=${errorReason(error)}`);
  }
  invalidateArticles();
  redirect(`/admin/content/articles/${parsedId.data}?schedule_saved=1`);
}

export async function configureArticleReview(id: string, formData: FormData) {
  const parsedId = articleIdSchema.safeParse(id);
  const input = articleReviewConfigurationSchema.safeParse({
    requiresScientificReview: formData.get("requiresScientificReview") === "yes",
    reviewerId: formData.get("reviewerId") ?? "",
  });
  if (!parsedId.success || !input.success) {
    redirect(`/admin/content/articles/${id}?error=validation`);
  }
  const access = await requireAccess(`/admin/content/articles/${parsedId.data}`);
  try {
    await new ArticleService().configureReview(access, parsedId.data, input.data);
  } catch (error) {
    redirect(`/admin/content/articles/${parsedId.data}?error=${errorReason(error)}`);
  }
  invalidateArticles();
  redirect(`/admin/content/articles/${parsedId.data}?reviewer_saved=1`);
}

export async function submitArticleReview(id: string, expectedVersion: number, formData: FormData) {
  const parsedId = articleIdSchema.safeParse(id);
  const version = z.number().int().positive().safeParse(expectedVersion);
  const input = articleReviewDecisionSchema.safeParse({
    decision: formData.get("decision"),
    comment: formData.get("comment"),
  });
  if (!parsedId.success || !version.success || !input.success) {
    redirect(`/admin/content/articles/${id}?error=validation`);
  }
  const access = await requireAccess(`/admin/content/articles/${parsedId.data}`);
  try {
    await new ArticleService().submitReview(access, parsedId.data, version.data, input.data);
  } catch (error) {
    redirect(`/admin/content/articles/${parsedId.data}?error=${errorReason(error)}`);
  }
  invalidateArticles();
  revalidatePath(`/admin/content/articles/${parsedId.data}`);
  redirect(`/admin/content/articles/${parsedId.data}?review_saved=1`);
}

export async function createArticle(formData: FormData) {
  const input = articleInputFromFormData(formData);
  if (!input.success) redirect("/admin/content/articles/new?error=validation");
  const access = await requireAccess("/admin/content/articles/new");

  let articleId: string;
  try {
    articleId = await new ArticleService().create(access, input.data);
  } catch (error) {
    redirect(
      `/admin/content/articles/new?error=${errorReason(error)}`,
    );
  }
  invalidateArticles();
  redirect(`/admin/content/articles/${articleId}?created=1`);
}

export async function updateArticle(id: string, formData: FormData) {
  const parsedId = articleIdSchema.safeParse(id);
  const input = articleInputFromFormData(formData);
  if (!parsedId.success || !input.success) {
    redirect(`/admin/content/articles/${id}?error=validation`);
  }
  const access = await requireAccess(`/admin/content/articles/${id}`);

  try {
    await new ArticleService().update(access, parsedId.data, input.data);
  } catch (error) {
    redirect(
      `/admin/content/articles/${parsedId.data}?error=${errorReason(error)}`,
    );
  }
  invalidateArticles();
  revalidatePath(`/admin/content/articles/${parsedId.data}`);
  redirect(`/admin/content/articles/${parsedId.data}?saved=1`);
}

export async function changeArticleStatus(
  id: string,
  status: string,
  expectedVersion: number,
) {
  const parsedId = articleIdSchema.safeParse(id);
  const parsedStatus = articleStatusSchema.safeParse(status);
  const version = z.number().int().positive().safeParse(expectedVersion);
  if (!parsedId.success || !parsedStatus.success || !version.success) {
    redirect(`/admin/content/articles/${id}?error=invalid_transition`);
  }
  const access = await requireAccess(`/admin/content/articles/${id}`);

  try {
    await new ArticleService().changeStatus(
      access,
      parsedId.data,
      parsedStatus.data,
      version.data,
    );
  } catch (error) {
    redirect(
      `/admin/content/articles/${parsedId.data}?error=${errorReason(error)}`,
    );
  }
  invalidateArticles();
  revalidatePath(`/admin/content/articles/${parsedId.data}`);
  redirect(`/admin/content/articles/${parsedId.data}?status_changed=1`);
}

export async function softDeleteArticle(id: string, formData: FormData) {
  const parsedId = articleIdSchema.safeParse(id);
  if (!parsedId.success || formData.get("confirm") !== "yes") {
    redirect(`/admin/content/articles/${id}?error=confirm_delete`);
  }
  const access = await requireAccess(`/admin/content/articles/${id}`);
  try {
    await new ArticleService().softDelete(access, parsedId.data);
  } catch (error) {
    redirect(
      `/admin/content/articles/${parsedId.data}?error=${errorReason(error)}`,
    );
  }
  invalidateArticles();
  redirect("/admin/content/articles?deleted=1");
}

export async function createArticleTaxonomy(formData: FormData) {
  const input = taxonomyInputSchema.safeParse({
    kind: formData.get("kind"),
    slug: formData.get("slug"),
    nameRu: formData.get("nameRu"),
    nameKk: formData.get("nameKk"),
  });
  if (!input.success) {
    redirect("/admin/content/articles/taxonomy?error=validation");
  }
  const access = await requireAccess("/admin/content/articles/taxonomy");
  try {
    await new ArticleService().createTaxonomyItem(access, input.data);
  } catch (error) {
    redirect(
      `/admin/content/articles/taxonomy?error=${errorReason(error)}`,
    );
  }
  revalidatePath("/admin/content/articles/taxonomy");
  revalidatePath("/admin/content/articles/new");
  redirect("/admin/content/articles/taxonomy?created=1");
}

export async function updateArticleTaxonomy(formData: FormData) {
  const input = taxonomyUpdateSchema.safeParse({
    id: formData.get("id"), kind: formData.get("kind"), slug: formData.get("slug"),
    nameRu: formData.get("nameRu"), nameKk: formData.get("nameKk"), isActive: formData.get("isActive") === "yes",
  });
  if (!input.success) redirect("/admin/content/articles/taxonomy?error=validation");
  const access = await requireAccess("/admin/content/articles/taxonomy");
  try { await new ArticleService().updateTaxonomyItem(access, input.data); }
  catch (error) { redirect(`/admin/content/articles/taxonomy?error=${errorReason(error)}`); }
  invalidateArticles();
  redirect("/admin/content/articles/taxonomy?saved=1");
}

export async function saveArticleAuthor(formData: FormData) {
  const rawId = formData.get("id");
  const id = rawId ? articleIdSchema.safeParse(rawId) : null;
  const input = articleAuthorInputSchema.safeParse({
    profileId: formData.get("profileId") ?? "", nameRu: formData.get("nameRu"), nameKk: formData.get("nameKk"),
    bioRu: formData.get("bioRu"), bioKk: formData.get("bioKk"), organization: formData.get("organization"),
    position: formData.get("position"), websiteUrl: formData.get("websiteUrl"), isActive: formData.get("isActive") === "yes",
  });
  if (!input.success || (id && !id.success)) redirect("/admin/content/articles/taxonomy?error=validation");
  const access = await requireAccess("/admin/content/articles/taxonomy");
  try { await new ArticleService().saveAuthor(access, id?.success ? id.data : null, input.data); }
  catch (error) { redirect(`/admin/content/articles/taxonomy?error=${errorReason(error)}`); }
  invalidateArticles();
  redirect("/admin/content/articles/taxonomy?saved=1");
}
