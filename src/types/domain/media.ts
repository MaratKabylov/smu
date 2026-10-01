export const mediaBuckets = [
  "avatars",
  "organization-logos",
  "article-media",
  "research-files",
  "publication-files",
  "event-media",
  "documents",
  "it-request-files",
] as const;

export type MediaBucket = (typeof mediaBuckets)[number];
export type MediaAssetStatus = "uploading" | "ready" | "failed";

export type MediaAsset = {
  id: string;
  storageBucket: MediaBucket;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  altRu: string | null;
  altKk: string | null;
  captionRu: string | null;
  captionKk: string | null;
  copyrightHolder: string | null;
  sourceUrl: string | null;
  uploadedBy: string;
  status: MediaAssetStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  usageCount: number;
  previewUrl: string | null;
};

export type MediaUsage = {
  id: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  createdAt: string;
};
