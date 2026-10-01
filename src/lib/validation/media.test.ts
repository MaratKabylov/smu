import { describe, expect, it } from "vitest";
import {
  ARTICLE_MEDIA_MAX_BYTES,
  createMediaUploadSchema,
} from "./media";

describe("media upload validation", () => {
  it("accepts supported article images", () => {
    const result = createMediaUploadSchema.safeParse({
      fileName: "research-map.webp",
      fileSize: 1024,
      mimeType: "image/webp",
      bucket: "article-media",
    });

    expect(result.success).toBe(true);
  });

  it("rejects SVG uploads", () => {
    const result = createMediaUploadSchema.safeParse({
      fileName: "unsafe.svg",
      fileSize: 1024,
      mimeType: "image/svg+xml",
      bucket: "article-media",
    });

    expect(result.success).toBe(false);
  });

  it("rejects files above the bucket limit", () => {
    const result = createMediaUploadSchema.safeParse({
      fileName: "oversized.png",
      fileSize: ARTICLE_MEDIA_MAX_BYTES + 1,
      mimeType: "image/png",
      bucket: "article-media",
    });

    expect(result.success).toBe(false);
  });
});
