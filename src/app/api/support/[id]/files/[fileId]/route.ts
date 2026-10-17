import { z } from "zod";
import { SupportRequestService } from "@/server/services/support-request.service";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(fileId).success) return new Response(null, { status: 404, headers });
  try {
    const file = await new SupportRequestService().download(id, fileId);
    if (!file) return new Response(null, { status: 404, headers });
    const name = encodeURIComponent(file.name).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16)}`);
    return new Response(file.blob, { headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="attachment.pdf"; filename*=UTF-8''${name}` } });
  } catch { return new Response(null, { status: 404, headers }); }
}
