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
  return (data ?? []).map(asset => ({
    id: asset.id,
    url: client.storage.from(asset.storage_bucket).getPublicUrl(asset.storage_path).data.publicUrl,
    alt: (locale === "ru" ? asset.alt_ru : asset.alt_kk) ?? "",
    caption: locale === "ru" ? asset.caption_ru : asset.caption_kk,
  }));
}
