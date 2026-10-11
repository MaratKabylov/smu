import { z } from "zod";
import { ResearchOutputService } from "@/server/services/research-output.service";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  const version = z.coerce.number().int().positive().safeParse(new URL(request.url).searchParams.get("version"));
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(fileId).success || !version.success) return new Response(null, { status: 404, headers });
  try {
    const url = await new ResearchOutputService().download(id, version.data, fileId);
    return url ? new Response(null, { status: 302, headers: { ...headers, Location: url } }) : new Response(null, { status: 404, headers });
  } catch { return new Response(null, { status: 503, headers }); }
}
