import { z } from "zod";
import { getAdminAccess } from "@/server/services/access.service";
import { canViewMedia } from "@/lib/permissions/permissions";
import { MediaService } from "@/server/services/media.service";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response(null, { status: 404, headers });
  const result = await getAdminAccess();
  if (result.state === "unauthenticated") return new Response(null, { status: 401, headers });
  if (result.state !== "allowed" || !canViewMedia(result.access)) return new Response(null, { status: 403, headers });
  try {
    const url = await new MediaService().download(result.access, id);
    return new Response(null, { status: url ? 302 : 404, headers: url ? { ...headers, Location: url } : headers });
  } catch { return new Response(null, { status: 503, headers }); }
}
