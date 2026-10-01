"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  articleInputSchema,
  articleStatusSchema,
  taxonomyInputSchema,
} from "@/lib/validation/article";
import { getAdminAccess } from "@/server/services/access.service";
import {
  ArticleService,
  ArticleServiceError,
} from "@/server/services/article.service";

const articleIdSchema = z.uuid();

function articleInputFromFormData(formData: FormData) {
  return articleInputSchema.safeParse({
    contentType: formData.get("contentType"),
    categoryId: formData.get("categoryId"),
    coverMediaId: formData.get("coverMediaId"),
    tagIds: formData.getAll("tagIds"),
    ru: {
      title: formData.get("titleRu"),
      slug: formData.get("slugRu"),
      excerpt: formData.get("excerptRu"),
      body: formData.get("bodyRu"),
      seoTitle: formData.get("seoTitleRu"),
      seoDescription: formData.get("seoDescriptionRu"),
    },
    kk: {
      title: formData.get("titleKk"),
      slug: formData.get("slugKk"),
      excerpt: formData.get("excerptKk"),
      body: formData.get("bodyKk"),
      seoTitle: formData.get("seoTitleKk"),
      seoDescription: formData.get("seoDescriptionKk"),
    },
  });
}

async function requireAccess(fallback: string) {
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") redirect(`${fallback}?error=forbidden`);
  return result.access;
}

function errorReason(error: unknown) {
  if (!(error instanceof ArticleServiceError)) return "action_failed";
  if (error.code === "forbidden") return "forbidden";
  if (error.code === "invalid_transition") return "invalid_transition";
  if (error.code === "invalid_reference") return "invalid_reference";
  return "action_failed";
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
  revalidatePath("/admin/content/articles");
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
  revalidatePath("/admin/content/articles");
  revalidatePath(`/admin/content/articles/${parsedId.data}`);
  redirect(`/admin/content/articles/${parsedId.data}?saved=1`);
}

export async function changeArticleStatus(
  id: string,
  status: string,
) {
  const parsedId = articleIdSchema.safeParse(id);
  const parsedStatus = articleStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    redirect(`/admin/content/articles/${id}?error=invalid_transition`);
  }
  const access = await requireAccess(`/admin/content/articles/${id}`);

  try {
    await new ArticleService().changeStatus(
      access,
      parsedId.data,
      parsedStatus.data,
    );
  } catch (error) {
    redirect(
      `/admin/content/articles/${parsedId.data}?error=${errorReason(error)}`,
    );
  }
  revalidatePath("/admin/content/articles");
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
  revalidatePath("/admin/content/articles");
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
