import "server-only";
import { invalidatePublicContent } from "@/lib/i18n/revalidation";
import { inspectMediaFile } from "@/lib/media/inspect-file";

import {
  canCreateMedia,
  canDeleteMedia,
  canEditMedia,
  canViewMedia,
} from "@/lib/permissions/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import {
  createMediaUploadSchema,
  mediaBucketRules,
  mediaExtensionByMime,
  type CompleteMediaUploadInput,
  type CreateMediaUploadInput,
  type MediaListFilters,
  type MediaMetadataInput,
} from "@/lib/validation/media";
import { AuditRepository } from "@/server/repositories/audit.repository";
import { MediaRepository } from "@/server/repositories/media.repository";
import type { AccessContext } from "@/types/domain/auth";
import type { MediaAsset } from "@/types/domain/media";

type MediaServiceErrorCode =
  | "forbidden"
  | "not_found"
  | "invalid_upload"
  | "storage_error";

export class MediaServiceError extends Error {
  constructor(
    public readonly code: MediaServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MediaServiceError";
  }
}

const publicBuckets = new Set([
  "avatars",
  "organization-logos",
  "article-media",
  "event-media",
]);

export const MEDIA_STAGING_BUCKET = "media-staging";

function assertPermission(allowed: boolean) {
  if (!allowed) {
    throw new MediaServiceError("forbidden", "Недостаточно прав.");
  }
}

function createStoragePath(input: CreateMediaUploadInput) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const extension = mediaExtensionByMime[input.mimeType][0];

  return `${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

export class MediaService {
  async list(access: AccessContext, filters: MediaListFilters) {
    assertPermission(canViewMedia(access));

    const userClient = await createServerSupabaseClient();
    const assets = await new MediaRepository(userClient).list(filters);

    return this.addPreviewUrls(assets);
  }

  async getById(access: AccessContext, id: string) {
    assertPermission(canViewMedia(access));

    const userClient = await createServerSupabaseClient();
    const repository = new MediaRepository(userClient);
    const asset = await repository.getById(id);

    if (!asset) return null;

    const [withPreview] = await this.addPreviewUrls([asset]);
    const usages = await repository.listUsages(id);

    return { asset: withPreview, usages };
  }

  async createUpload(access: AccessContext, input: CreateMediaUploadInput) {
    assertPermission(canCreateMedia(access));
    input = createMediaUploadSchema.parse(input);

    const serviceClient = createServiceRoleSupabaseClient();
    const repository = new MediaRepository(serviceClient);
    const storagePath = createStoragePath(input);
    const asset = await repository.createUploading(
      access.userId,
      input,
      storagePath,
    );

    const { data, error } = await serviceClient.storage
      .from(MEDIA_STAGING_BUCKET)
      .createSignedUploadUrl(`${access.userId}/${asset.id}`, { upsert: false });

    if (error || !data) {
      await repository.markFailed(asset.id);
      throw new MediaServiceError(
        "storage_error",
        "Не удалось подготовить загрузку.",
      );
    }

    return {
      mediaAssetId: asset.id,
      bucket: MEDIA_STAGING_BUCKET,
      path: `${access.userId}/${asset.id}`,
      token: data.token,
    };
  }

  async completeUpload(
    access: AccessContext,
    input: CompleteMediaUploadInput,
  ) {
    assertPermission(canCreateMedia(access));

    const serviceClient = createServiceRoleSupabaseClient();
    const repository = new MediaRepository(serviceClient);
    const asset = await repository.getById(input.mediaAssetId);

    if (!asset || asset.status !== "uploading" || asset.deletedAt) {
      throw new MediaServiceError("not_found", "Загрузка не найдена.");
    }

    if (asset.uploadedBy !== access.userId) {
      throw new MediaServiceError("forbidden", "Загрузка принадлежит другому пользователю.");
    }

    const stagingPath = `${access.userId}/${asset.id}`;
    const staging = serviceClient.storage.from(MEDIA_STAGING_BUCKET);
    const { data: objects, error: listError } = await staging
      .list(access.userId, { limit: 10, search: asset.id });

    if (listError) {
      throw new MediaServiceError("storage_error", "Не удалось проверить файл.");
    }

    const object = objects?.find((item) => item.name === asset.id);
    const metadata = object?.metadata as
      | { size?: number | string; mimetype?: string }
      | undefined;
    const actualSize = Number(metadata?.size);
    const actualMimeType = metadata?.mimetype;

    if (
      !object ||
      !Number.isFinite(actualSize) ||
      actualSize <= 0 ||
      actualSize !== asset.fileSize ||
      actualSize > mediaBucketRules[asset.storageBucket].maxBytes ||
      actualMimeType !== asset.mimeType
    ) {
      await repository.markFailed(asset.id);
      await staging.remove([stagingPath]);
      throw new MediaServiceError(
        "invalid_upload",
        "Файл не прошел проверку типа или размера.",
      );
    }

    const downloaded = await staging.download(stagingPath);
    if (downloaded.error || !downloaded.data) {
      throw new MediaServiceError("storage_error", "Не удалось прочитать файл для проверки.");
    }
    let dimensions: { width: number | null; height: number | null };
    let bytes: Uint8Array;
    try {
      if (downloaded.data.size !== actualSize) throw new Error("invalid_file");
      bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      dimensions = await inspectMediaFile(asset.storageBucket, asset.fileName, asset.mimeType, bytes);
    } catch {
      await repository.markFailed(asset.id);
      await staging.remove([stagingPath]);
      throw new MediaServiceError("invalid_upload", "Содержимое файла не соответствует формату или размеру.");
    }
    const target = serviceClient.storage.from(asset.storageBucket);
    const stored = await target.upload(asset.storagePath, bytes, { contentType: asset.mimeType, upsert: false, cacheControl: "3600" });
    if (stored.error) throw new MediaServiceError("storage_error", "Не удалось сохранить проверенный файл.");
    try {
      // Metadata, readiness and audit commit atomically. The RPC is restricted
      // to service_role and repeats current actor/permission/state checks.
      await repository.finalizeUpload(asset.id, access.userId, { mimeType: asset.mimeType, fileSize: bytes.length, ...dimensions });
    } catch (error) {
      await target.remove([asset.storagePath]);
      throw error;
    }
    invalidatePublicContent();
    await staging.remove([stagingPath]);

    return { mediaAssetId: asset.id };
  }

  async download(access: AccessContext, id: string) {
    assertPermission(canViewMedia(access));
    const asset = await new MediaRepository(await createServerSupabaseClient()).getById(id);
    if (!asset || asset.status !== "ready" || asset.deletedAt) return null;
    const { data, error } = await createServiceRoleSupabaseClient().storage.from(asset.storageBucket)
      .createSignedUrl(asset.storagePath, 60, { download: asset.fileName });
    if (error) throw error;
    return data?.signedUrl ?? null;
  }

  async updateMetadata(
    access: AccessContext,
    id: string,
    input: MediaMetadataInput,
  ) {
    assertPermission(canEditMedia(access));

    const serviceClient = createServiceRoleSupabaseClient();
    const repository = new MediaRepository(serviceClient);
    const asset = await repository.getById(id);
    if (!asset || asset.deletedAt) {
      throw new MediaServiceError("not_found", "Медиафайл не найден.");
    }

    await repository.updateMetadata(id, input);
    invalidatePublicContent();
    await new AuditRepository(serviceClient).create({
      userId: access.userId,
      entityType: "media_asset",
      entityId: id,
      action: "media.metadata.update",
      oldData: {
        altRu: asset.altRu,
        altKk: asset.altKk,
        altEn: asset.altEn,
        captionRu: asset.captionRu,
        captionKk: asset.captionKk,
        captionEn: asset.captionEn,
        copyrightHolder: asset.copyrightHolder,
        sourceUrl: asset.sourceUrl,
      },
      newData: input,
    });
  }

  async softDelete(access: AccessContext, id: string) {
    assertPermission(canDeleteMedia(access));

    const serviceClient = createServiceRoleSupabaseClient();
    const repository = new MediaRepository(serviceClient);
    const asset = await repository.getById(id);
    if (!asset || asset.deletedAt) {
      throw new MediaServiceError("not_found", "Медиафайл не найден.");
    }

    const usages = await repository.listUsages(id);
    if (usages.length > 0) {
      throw new MediaServiceError(
        "invalid_upload",
        "Нельзя удалить файл, который используется в материалах.",
      );
    }

    await repository.softDelete(id);
    invalidatePublicContent();
    await new AuditRepository(serviceClient).create({
      userId: access.userId,
      entityType: "media_asset",
      entityId: id,
      action: "media.soft_delete",
      oldData: {
        storageBucket: asset.storageBucket,
        storagePath: asset.storagePath,
        fileName: asset.fileName,
      },
      newData: { deletedAt: new Date().toISOString() },
    });
  }

  private async addPreviewUrls(assets: MediaAsset[]) {
    const serviceClient = createServiceRoleSupabaseClient();

    return Promise.all(
      assets.map(async (asset) => {
        if (asset.status !== "ready" || asset.deletedAt) return { ...asset, previewUrl: null };
        if (publicBuckets.has(asset.storageBucket)) {
          const { data } = serviceClient.storage
            .from(asset.storageBucket)
            .getPublicUrl(asset.storagePath);
          return { ...asset, previewUrl: data.publicUrl };
        }

        return { ...asset, previewUrl: `/api/admin/media/${asset.id}/download` };
      }),
    );
  }
}
