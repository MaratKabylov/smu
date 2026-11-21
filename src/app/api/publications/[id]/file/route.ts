import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { isSupabaseConfigured } from "@/lib/env";

const headers = {
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
  "X-Robots-Tag": "noindex",
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || !isSupabaseConfigured()) {
    return new Response(null, { status: 404, headers });
  }

  const client = await createServerSupabaseClient();
  const { data: pub, error: pubError } = await client
    .from("publications")
    .select("id, status, deleted_at, published_at, file_media_id")
    .eq("id", id)
    .maybeSingle();

  if (pubError || !pub || pub.status !== "published" || pub.deleted_at || !pub.file_media_id) {
    return new Response(null, { status: 404, headers });
  }

  if (pub.published_at && new Date(pub.published_at) > new Date()) {
    return new Response(null, { status: 404, headers });
  }

  const serviceClient = createServiceRoleSupabaseClient();
  const { data: asset, error: assetError } = await serviceClient
    .from("media_assets")
    .select("storage_bucket, storage_path, file_name, mime_type")
    .eq("id", pub.file_media_id)
    .eq("status", "ready")
    .is("deleted_at", null)
    .maybeSingle();

  if (assetError || !asset) {
    return new Response(null, { status: 404, headers });
  }

  const url = new URL(request.url);
  const isDownload = url.searchParams.get("download") === "1";

  const { data: signed, error: signError } = await serviceClient.storage
    .from(asset.storage_bucket)
    .createSignedUrl(
      asset.storage_path,
      300,
      isDownload ? { download: asset.file_name } : undefined
    );

  if (signError || !signed?.signedUrl) {
    return new Response(null, { status: 503, headers });
  }

  return new Response(null, {
    status: 302,
    headers: {
      ...headers,
      Location: signed.signedUrl,
    },
  });
}
