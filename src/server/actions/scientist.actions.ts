"use server";

import { revalidateLocalizedPath as revalidatePath } from "@/lib/i18n/revalidation";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  scientistInputSchema,
  scientistStatusSchema,
  scientistTaxonomyInputSchema,
} from "@/lib/validation/scientist";
import { getAdminAccess } from "@/server/services/access.service";
import { ScientistService, ScientistServiceError } from "@/server/services/scientist.service";

const idSchema = z.uuid();

function inputFromFormData(formData: FormData) {
  const translation = (suffix: "Ru" | "Kk" | "En") => ({
    fullName: formData.get(`fullName${suffix}`), slug: formData.get(`slug${suffix}`),
    position: formData.get(`position${suffix}`), academicDegree: formData.get(`academicDegree${suffix}`),
    shortBio: formData.get(`shortBio${suffix}`), biography: formData.get(`biography${suffix}`),
  });
  const en = translation("En");
  const hasEnglish = Object.values(en).some(value => String(value ?? "").trim().length > 0);
  return scientistInputSchema.safeParse({
    organizationId: formData.get("organizationId"),
    avatarMediaId: formData.get("avatarMediaId"),
    fieldIds: formData.getAll("fieldIds"),
    publicEmail: formData.get("publicEmail"),
    orcid: formData.get("orcid"),
    scholarUrl: formData.get("scholarUrl"),
    ru: {
      fullName: formData.get("fullNameRu"),
      slug: formData.get("slugRu"),
      position: formData.get("positionRu"),
      academicDegree: formData.get("academicDegreeRu"),
      shortBio: formData.get("shortBioRu"),
      biography: formData.get("biographyRu"),
    },
    kk: {
      fullName: formData.get("fullNameKk"),
      slug: formData.get("slugKk"),
      position: formData.get("positionKk"),
      academicDegree: formData.get("academicDegreeKk"),
      shortBio: formData.get("shortBioKk"),
      biography: formData.get("biographyKk"),
    },
    ...(hasEnglish ? { en } : {}),
  });
}

async function requireAccess(fallback: string) {
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed") redirect(`${fallback}?error=forbidden`);
  return result.access;
}

function errorReason(error: unknown) {
  if (!(error instanceof ScientistServiceError)) return "action_failed";
  return error.code;
}

export async function createScientist(formData: FormData) {
  const input = inputFromFormData(formData);
  if (!input.success) redirect("/admin/science/scientists/new?error=validation");
  const access = await requireAccess("/admin/science/scientists/new");
  let id: string;
  try {
    id = await new ScientistService().create(access, input.data);
  } catch (error) {
    redirect(`/admin/science/scientists/new?error=${errorReason(error)}`);
  }
  revalidatePath("/admin/science/scientists");
  revalidatePath("/scientists");
  redirect(`/admin/science/scientists/${id}?created=1`);
}

export async function updateScientist(id: string, formData: FormData) {
  const parsedId = idSchema.safeParse(id);
  const input = inputFromFormData(formData);
  if (!parsedId.success || !input.success) redirect(`/admin/science/scientists/${id}?error=validation`);
  const access = await requireAccess(`/admin/science/scientists/${id}`);
  try {
    await new ScientistService().update(access, parsedId.data, input.data);
  } catch (error) {
    redirect(`/admin/science/scientists/${parsedId.data}?error=${errorReason(error)}`);
  }
  revalidatePath("/admin/science/scientists");
  revalidatePath("/scientists");
  redirect(`/admin/science/scientists/${parsedId.data}?saved=1`);
}

export async function changeScientistStatus(id: string, status: string) {
  const parsedId = idSchema.safeParse(id);
  const parsedStatus = scientistStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) redirect(`/admin/science/scientists/${id}?error=invalid_transition`);
  const access = await requireAccess(`/admin/science/scientists/${id}`);
  try {
    await new ScientistService().changeStatus(access, parsedId.data, parsedStatus.data);
  } catch (error) {
    redirect(`/admin/science/scientists/${parsedId.data}?error=${errorReason(error)}`);
  }
  revalidatePath("/admin/science/scientists");
  revalidatePath("/scientists");
  redirect(`/admin/science/scientists/${parsedId.data}?status_changed=1`);
}

export async function softDeleteScientist(id: string, formData: FormData) {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success || formData.get("confirm") !== "yes") redirect(`/admin/science/scientists/${id}?error=confirm_delete`);
  const access = await requireAccess(`/admin/science/scientists/${id}`);
  try {
    await new ScientistService().softDelete(access, parsedId.data);
  } catch (error) {
    redirect(`/admin/science/scientists/${parsedId.data}?error=${errorReason(error)}`);
  }
  revalidatePath("/admin/science/scientists");
  revalidatePath("/scientists");
  redirect("/admin/science/scientists?deleted=1");
}

export async function createScientistTaxonomy(formData: FormData) {
  const kind = formData.get("kind");
  const input = scientistTaxonomyInputSchema.safeParse({
    kind,
    slug: formData.get("slug"),
    nameRu: formData.get("nameRu"),
    nameKk: formData.get("nameKk"),
    nameEn: formData.get("nameEn"),
    ...(kind === "organization" ? {
      cityRu: formData.get("cityRu"),
      cityKk: formData.get("cityKk"),
      cityEn: formData.get("cityEn"),
      websiteUrl: formData.get("websiteUrl"),
    } : {}),
  });
  if (!input.success) redirect("/admin/science/scientists/taxonomy?error=validation");
  const access = await requireAccess("/admin/science/scientists/taxonomy");
  try {
    await new ScientistService().createTaxonomyItem(access, input.data);
  } catch (error) {
    redirect(`/admin/science/scientists/taxonomy?error=${errorReason(error)}`);
  }
  revalidatePath("/admin/science/scientists/taxonomy");
  revalidatePath("/admin/science/scientists/new");
  revalidatePath("/scientists");
  redirect("/admin/science/scientists/taxonomy?created=1");
}
