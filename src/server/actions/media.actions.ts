"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  canDeleteMedia,
  canEditMedia,
} from "@/lib/permissions/permissions";
import { mediaMetadataSchema } from "@/lib/validation/media";
import { getAdminAccess } from "@/server/services/access.service";
import {
  MediaService,
  MediaServiceError,
} from "@/server/services/media.service";

const mediaIdSchema = z.uuid();

export async function updateMediaMetadata(id: string, formData: FormData) {
  const parsedId = mediaIdSchema.safeParse(id);
  const input = mediaMetadataSchema.safeParse({
    altRu: formData.get("altRu"),
    altKk: formData.get("altKk"),
    altEn: formData.get("altEn"),
    captionRu: formData.get("captionRu"),
    captionKk: formData.get("captionKk"),
    captionEn: formData.get("captionEn"),
    copyrightHolder: formData.get("copyrightHolder"),
    sourceUrl: formData.get("sourceUrl"),
  });

  if (!parsedId.success || !input.success) {
    redirect(`/admin/content/media/${id}?error=validation`);
  }

  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed" || !canEditMedia(result.access)) {
    redirect(`/admin/content/media/${id}?error=forbidden`);
  }

  try {
    await new MediaService().updateMetadata(
      result.access,
      parsedId.data,
      input.data,
    );
  } catch {
    redirect(`/admin/content/media/${parsedId.data}?error=action_failed`);
  }
  revalidatePath("/admin/content/media");
  revalidatePath(`/admin/content/media/${parsedId.data}`);
  redirect(`/admin/content/media/${parsedId.data}?saved=1`);
}

export async function softDeleteMedia(id: string, formData: FormData) {
  const parsedId = mediaIdSchema.safeParse(id);
  const confirmed = formData.get("confirm") === "yes";
  if (!parsedId.success || !confirmed) {
    redirect(`/admin/content/media/${id}?error=confirm_delete`);
  }

  const result = await getAdminAccess();
  if (result.state === "unauthenticated") redirect("/admin/login");
  if (result.state !== "allowed" || !canDeleteMedia(result.access)) {
    redirect(`/admin/content/media/${id}?error=forbidden`);
  }

  try {
    await new MediaService().softDelete(result.access, parsedId.data);
  } catch (error) {
    const reason =
      error instanceof MediaServiceError && error.code === "invalid_upload"
        ? "in_use"
        : "action_failed";
    redirect(`/admin/content/media/${parsedId.data}?error=${reason}`);
  }
  revalidatePath("/admin/content/media");
  redirect("/admin/content/media?deleted=1");
}
