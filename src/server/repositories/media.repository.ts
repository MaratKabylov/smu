import type { Tables } from "@/types/database.types";
import "server-only";

import type { DatabaseClient } from "@/lib/supabase/database";
import { mediaBuckets, type MediaAsset, type MediaUsage } from "@/types/domain/media";
import { z } from "zod";
import type {
  CreateMediaUploadInput,
  MediaListFilters,
  MediaMetadataInput,
} from "@/lib/validation/media";

type MediaRow = Pick<Tables<"media_assets">, "id" | "storage_bucket" | "storage_path" | "file_name" | "mime_type" | "file_size" | "width" | "height" | "alt_ru" | "alt_kk" | "caption_ru" | "caption_kk" | "copyright_holder" | "source_url" | "uploaded_by" | "status" | "created_at" | "updated_at" | "deleted_at">;

function mapMediaRow(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    storageBucket: z.enum(mediaBuckets).parse(row.storage_bucket),
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    width: row.width,
    height: row.height,
    altRu: row.alt_ru,
    altKk: row.alt_kk,
    altEn: null,
    captionRu: row.caption_ru,
    captionKk: row.caption_kk,
    captionEn: null,
    copyrightHolder: row.copyright_holder,
    sourceUrl: row.source_url,
    uploadedBy: row.uploaded_by,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    usageCount: 0,
    previewUrl: null,
  };
}

export class MediaRepository {
  constructor(private readonly client: DatabaseClient) {}

  async list(filters: MediaListFilters): Promise<MediaAsset[]> {
    let query = this.client
      .from("media_assets")
      .select("*")
      .eq("status", "ready")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(60);

    if (filters.query) query = query.ilike("file_name", `%${filters.query}%`);
    if (filters.type === "image") query = query.like("mime_type", "image/%");
    if (filters.type === "video") query = query.like("mime_type", "video/%");
    if (filters.type === "document") {
      query = query.not("mime_type", "like", "image/%").not("mime_type", "like", "video/%");
    }

    const { data, error } = await query;
    if (error) throw error;

    const assets = await this.withEnglishTranslations(((data ?? [])).map(mapMediaRow));
    if (assets.length === 0) return assets;

    const { data: usages, error: usagesError } = await this.client
      .from("media_usages")
      .select("media_asset_id")
      .in(
        "media_asset_id",
        assets.map((asset) => asset.id),
      );

    if (usagesError) throw usagesError;

    const counts = new Map<string, number>();
    for (const usage of (usages ?? [])) {
      counts.set(usage.media_asset_id, (counts.get(usage.media_asset_id) ?? 0) + 1);
    }

    return assets.map((asset) => ({
      ...asset,
      usageCount: counts.get(asset.id) ?? 0,
    }));
  }

  async getById(id: string): Promise<MediaAsset | null> {
    const { data, error } = await this.client
      .from("media_assets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return (await this.withEnglishTranslations([mapMediaRow(data)]))[0];
  }

  async listUsages(mediaAssetId: string): Promise<MediaUsage[]> {
    const { data, error } = await this.client
      .from("media_usages")
      .select("*")
      .eq("media_asset_id", mediaAssetId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return ((data ?? [])).map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      fieldName: row.field_name,
      createdAt: row.created_at,
    }));
  }

  async createUploading(
    userId: string,
    input: CreateMediaUploadInput,
    storagePath: string,
  ): Promise<MediaAsset> {
    const { data, error } = await this.client
      .from("media_assets")
      .insert({
        storage_bucket: input.bucket,
        storage_path: storagePath,
        file_name: input.fileName,
        mime_type: input.mimeType,
        file_size: input.fileSize,
        uploaded_by: userId,
        status: "uploading",
      })
      .select("*")
      .single();

    if (error) throw error;
    return mapMediaRow(data);
  }

  async markReady(
    id: string,
    actual: { mimeType: string; fileSize: number; width: number | null; height: number | null },
  ) {
    const { error } = await this.client
      .from("media_assets")
      .update({
        mime_type: actual.mimeType,
        file_size: actual.fileSize,
        width: actual.width,
        height: actual.height,
        status: "ready",
      })
      .eq("id", id)
      .eq("status", "uploading");

    if (error) throw error;
  }

  async markFailed(id: string) {
    const { error } = await this.client
      .from("media_assets")
      .update({ status: "failed" })
      .eq("id", id)
      .eq("status", "uploading");

    if (error) throw error;
  }

  async updateMetadata(id: string, input: MediaMetadataInput) {
    const { error } = await this.client.rpc("save_media_metadata", { p_id: id, p_input: input });

    if (error) throw error;
  }

  private async withEnglishTranslations(assets: MediaAsset[]) {
    if (assets.length === 0) return assets;
    const { data, error } = await this.client.from("media_asset_translations")
      .select("media_asset_id, alt_text, caption").eq("locale", "en")
      .in("media_asset_id", assets.map(asset => asset.id));
    if (error) throw error;
    return assets.map(asset => {
      const translation = (data ?? []).find(row => row.media_asset_id === asset.id);
      return { ...asset, altEn: translation?.alt_text ?? null, captionEn: translation?.caption ?? null };
    });
  }

  async softDelete(id: string) {
    const { error } = await this.client
      .from("media_assets")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) throw error;
  }
}
