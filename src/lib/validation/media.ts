import { z } from "zod";

export const ARTICLE_MEDIA_MAX_BYTES = 15 * 1024 * 1024;
export const ARTICLE_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const createMediaUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(ARTICLE_MEDIA_MAX_BYTES),
  mimeType: z.enum(ARTICLE_MEDIA_MIME_TYPES),
  bucket: z.literal("article-media").default("article-media"),
});

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
});

export type CreateMediaUploadInput = z.infer<
  typeof createMediaUploadSchema
>;
export type CompleteMediaUploadInput = z.infer<
  typeof completeMediaUploadSchema
>;
export type MediaMetadataInput = z.infer<typeof mediaMetadataSchema>;
export type MediaListFilters = z.infer<typeof mediaListFiltersSchema>;
