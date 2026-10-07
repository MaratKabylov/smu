import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RichTextImage } from "@/components/articles/RichTextContent";
import type { RichTextNode } from "@/lib/articles/rich-text";
import type { ArticleLocale } from "@/types/domain/article";

export async function getArticleImages(client: SupabaseClient, content: RichTextNode | null | undefined, locale: ArticleLocale): Promise<RichTextImage[]> {
  const ids = new Set<string>();
  function visit(node: RichTextNode, depth: number) {
    if (depth > 20) return;
    if (node.type === "image" && typeof node.attrs?.mediaId === "string") ids.add(node.attrs.mediaId);
    node.content?.forEach(child => visit(child, depth + 1));
  }
  if (content) visit(content, 0);
  if (!ids.size) return [];
  const { data, error } = await client.from("media_assets")
    .select("id, storage_bucket, storage_path, alt_ru, alt_kk, caption_ru, caption_kk")
    .in("id", [...ids]).eq("storage_bucket", "article-media").eq("status", "ready")
    .like("mime_type", "image/%").is("deleted_at", null);
  if (error) throw error;
  const { data: translated, error: translatedError } = await client.from("media_asset_translations")
    .select("media_asset_id, alt_text, caption").eq("locale", locale).in("media_asset_id", [...ids]);
  if (translatedError) throw translatedError;
  return (data ?? []).map(asset => ({
    id: asset.id,
    url: client.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl,
    alt: translated?.find(item => item.media_asset_id === asset.id)?.alt_text
      ?? (locale === "kk" ? asset.alt_kk : asset.alt_ru) ?? "",
    caption: translated?.find(item => item.media_asset_id === asset.id)?.caption
      ?? (locale === "kk" ? asset.caption_kk : asset.caption_ru),
  }));
}
