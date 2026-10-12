import { z } from "zod";
import { mediaBuckets, type MediaBucket } from "@/types/domain/media";

export const ARTICLE_MEDIA_MAX_BYTES = 15 * 1024 * 1024;
export const ARTICLE_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const mediaBucketRules: Record<MediaBucket, { label: string; maxBytes: number; mimeTypes: readonly string[] }> = {
  avatars: { label: "Аватары", maxBytes: 5 * 1024 * 1024, mimeTypes: ARTICLE_MEDIA_MIME_TYPES.slice(0, 3) },
  "organization-logos": { label: "Логотипы организаций", maxBytes: 5 * 1024 * 1024, mimeTypes: ARTICLE_MEDIA_MIME_TYPES.slice(0, 3) },
  "article-media": { label: "Изображения статей", maxBytes: ARTICLE_MEDIA_MAX_BYTES, mimeTypes: ARTICLE_MEDIA_MIME_TYPES },
  "event-media": { label: "Медиа мероприятий", maxBytes: 50 * 1024 * 1024, mimeTypes: ["image/jpeg", "image/png", "image/webp", "video/mp4"] },
  "research-files": { label: "Документы и данные исследований (закрытые)", maxBytes: 50 * 1024 * 1024, mimeTypes: ["application/pdf", "text/csv", "application/zip"] },
  "publication-files": { label: "Научные публикации (закрытые)", maxBytes: 50 * 1024 * 1024, mimeTypes: ["application/pdf"] },
  documents: { label: "Документы (закрытые)", maxBytes: 50 * 1024 * 1024, mimeTypes: ["application/pdf", DOCX_MIME] },
  "it-request-files": { label: "Вложения IT-заявок (закрытые)", maxBytes: 50 * 1024 * 1024, mimeTypes: ["application/pdf", "text/csv", "application/zip", ...ARTICLE_MEDIA_MIME_TYPES] },
};
export const mediaExtensionByMime: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"], "image/webp": ["webp"], "image/gif": ["gif"],
  "video/mp4": ["mp4"], "application/pdf": ["pdf"], "text/csv": ["csv"], "application/zip": ["zip"], [DOCX_MIME]: ["docx"],
};
export function isMediaFileAllowed(bucket: MediaBucket, name: string, mime: string, size: number) {
  const rule = mediaBucketRules[bucket];
  return !!rule && !!name.trim() && name.length <= 255 && !/[\x00-\x1f\x7f/\\]/.test(name)
    && Number.isInteger(size) && size > 0 && size <= rule.maxBytes && rule.mimeTypes.includes(mime)
    && !!mediaExtensionByMime[mime]?.includes(name.split(".").at(-1)?.toLowerCase() ?? "");
}

export const createMediaUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  bucket: z.enum(mediaBuckets).default("article-media"),
}).refine(input => isMediaFileAllowed(input.bucket, input.fileName, input.mimeType, input.fileSize), "Недопустимый формат или размер файла для выбранного назначения.");

export const completeMediaUploadSchema = z.object({
  mediaAssetId: z.uuid(),
  width: z.number().int().positive().max(100_000).nullable().optional(),
  height: z.number().int().positive().max(100_000).nullable().optional(),
});

const optionalText = z
  .string()
  .trim()
  .max(2_000)
  .transform((value) => value || null);

const optionalUrl = z
  .union([z.literal(""), z.url().max(2_000)])
  .transform((value) => value || null);

export const mediaMetadataSchema = z.object({
  altRu: optionalText,
  altKk: optionalText,
  altEn: optionalText,
  captionRu: optionalText,
  captionKk: optionalText,
  captionEn: optionalText,
  copyrightHolder: optionalText,
  sourceUrl: optionalUrl,
});

export const mediaListFiltersSchema = z.object({
  query: z.string().trim().max(120).default(""),
  type: z.enum(["all", "image", "video", "document"]).default("all"),
  bucket: z.union([z.literal("all"), z.enum(mediaBuckets)]).default("all"),
});

export type CreateMediaUploadInput = z.infer<
  typeof createMediaUploadSchema
>;
export type CompleteMediaUploadInput = z.infer<
  typeof completeMediaUploadSchema
>;
export type MediaMetadataInput = z.infer<typeof mediaMetadataSchema>;
export type MediaListFilters = Omit<z.infer<typeof mediaListFiltersSchema>, "bucket"> & {
  bucket?: z.infer<typeof mediaListFiltersSchema>["bucket"];
};
