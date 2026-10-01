import "server-only";

import {
  canCreateMedia,
  canDeleteMedia,
  canEditMedia,
  canViewMedia,
} from "@/lib/permissions/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import {
  ARTICLE_MEDIA_MAX_BYTES,
  ARTICLE_MEDIA_MIME_TYPES,
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

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function assertPermission(allowed: boolean) {
  if (!allowed) {
    throw new MediaServiceError("forbidden", "Недостаточно прав.");
  }
}

function createStoragePath(input: CreateMediaUploadInput) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const extension = extensionByMimeType[input.mimeType];

  return `${year}/${month}/${crypto.randomUUID()}.${extension}`;
}

function splitStoragePath(path: string) {
  const parts = path.split("/");
  const fileName = parts.pop();

  if (!fileName) {
    throw new MediaServiceError("storage_error", "Некорректный путь файла.");
  }

  return { folder: parts.join("/"), fileName };
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

    const serviceClient = createServiceRoleSupabaseClient();
    const repository = new MediaRepository(serviceClient);
    const storagePath = createStoragePath(input);
    const asset = await repository.createUploading(
      access.userId,
      input,
      storagePath,
    );

    const { data, error } = await serviceClient.storage
      .from(input.bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      await repository.markFailed(asset.id);
      throw new MediaServiceError(
        "storage_error",
        "Не удалось подготовить загрузку.",
      );
    }

    return {
      mediaAssetId: asset.id,
      bucket: input.bucket,
      path: storagePath,
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

    if (!asset || asset.status !== "uploading") {
      throw new MediaServiceError("not_found", "Загрузка не найдена.");
    }

    if (asset.uploadedBy !== access.userId) {
      throw new MediaServiceError("forbidden", "Загрузка принадлежит другому пользователю.");
    }

    const { folder, fileName } = splitStoragePath(asset.storagePath);
    const { data: objects, error: listError } = await serviceClient.storage
      .from(asset.storageBucket)
      .list(folder, { limit: 10, search: fileName });

    if (listError) {
      throw new MediaServiceError("storage_error", "Не удалось проверить файл.");
    }

    const object = objects?.find((item) => item.name === fileName);
    const metadata = object?.metadata as
      | { size?: number | string; mimetype?: string }
      | undefined;
    const actualSize = Number(metadata?.size);
    const actualMimeType = metadata?.mimetype;

    if (
      !object ||
      !Number.isFinite(actualSize) ||
      actualSize <= 0 ||
      actualSize > ARTICLE_MEDIA_MAX_BYTES ||
      !actualMimeType ||
      !ARTICLE_MEDIA_MIME_TYPES.includes(
        actualMimeType as (typeof ARTICLE_MEDIA_MIME_TYPES)[number],
      )
    ) {
      await repository.markFailed(asset.id);
      throw new MediaServiceError(
        "invalid_upload",
        "Файл не прошел проверку типа или размера.",
      );
    }

    await repository.markReady(asset.id, {
      mimeType: actualMimeType,
      fileSize: actualSize,
      width: input.width ?? null,
      height: input.height ?? null,
    });

    await new AuditRepository(serviceClient).create({
      userId: access.userId,
      entityType: "media_asset",
      entityId: asset.id,
      action: "media.upload",
      newData: {
        storageBucket: asset.storageBucket,
        storagePath: asset.storagePath,
        fileName: asset.fileName,
        mimeType: actualMimeType,
        fileSize: actualSize,
      },
    });

    return { mediaAssetId: asset.id };
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
    await new AuditRepository(serviceClient).create({
      userId: access.userId,
      entityType: "media_asset",
      entityId: id,
      action: "media.metadata.update",
      oldData: {
        altRu: asset.altRu,
        altKk: asset.altKk,
        captionRu: asset.captionRu,
        captionKk: asset.captionKk,
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
        if (publicBuckets.has(asset.storageBucket)) {
          const { data } = serviceClient.storage
            .from(asset.storageBucket)
            .getPublicUrl(asset.storagePath);
          return { ...asset, previewUrl: data.publicUrl };
        }

        const { data } = await serviceClient.storage
          .from(asset.storageBucket)
          .createSignedUrl(asset.storagePath, 15 * 60);

        return { ...asset, previewUrl: data?.signedUrl ?? null };
      }),
    );
  }
}
