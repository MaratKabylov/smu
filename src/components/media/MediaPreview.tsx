import { FileArchive, FileText, Film, ImageIcon } from "lucide-react";
import type { MediaAsset } from "@/types/domain/media";

export function MediaPreview({
  asset,
  large = false,
}: {
  asset: MediaAsset;
  large?: boolean;
}) {
  if (asset.mimeType.startsWith("image/") && asset.previewUrl) {
    return (
      <div className={`media-preview${large ? " is-large" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.previewUrl} alt={asset.altRu ?? ""} />
      </div>
    );
  }

  const Icon = asset.mimeType.startsWith("video/")
    ? Film
    : asset.mimeType.includes("zip")
      ? FileArchive
      : asset.mimeType.startsWith("image/")
        ? ImageIcon
        : FileText;

  return (
    <div className={`media-preview file-preview${large ? " is-large" : ""}`}>
      <Icon aria-hidden="true" />
      <span>{asset.mimeType.split("/").at(-1)?.toUpperCase()}</span>
    </div>
  );
}
