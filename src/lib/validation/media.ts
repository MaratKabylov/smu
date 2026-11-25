import { z } from "zod";
import { mediaBuckets } from "@/types/domain/media";
import {
  ARTICLE_MEDIA_MAX_BYTES,
  ARTICLE_MEDIA_MIME_TYPES,
  DOCX_MIME,
  mediaBucketRules,
  mediaExtensionByMime,
  isMediaFileAllowed,
} from "@/lib/media/rules";

export {
  ARTICLE_MEDIA_MAX_BYTES,
  ARTICLE_MEDIA_MIME_TYPES,
  DOCX_MIME,
  mediaBucketRules,
  mediaExtensionByMime,
  isMediaFileAllowed,
};

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
