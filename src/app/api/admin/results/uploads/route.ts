import type { NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { OUTPUT_FILE_MAX_BYTES } from "@/lib/validation/research-output";
import { getAdminAccess } from "@/server/services/access.service";
import { canEditOutputs, ResearchOutputService } from "@/server/services/research-output.service";
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return Response.json({ error: "invalid_origin" }, { status: 403 });
  const access = await getAdminAccess();
  if (access.state === "unauthenticated") return Response.json({ error: "unauthenticated" }, { status: 401 });
  if (access.state !== "allowed" || !canEditOutputs(access.access)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (Number(request.headers.get("content-length")) > OUTPUT_FILE_MAX_BYTES + 65536) return Response.json({ error: "invalid_file" }, { status: 413 });
  // Bound the actual body too; Content-Length is optional and untrusted.
  const limit = OUTPUT_FILE_MAX_BYTES + 65536;
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "invalid_file" }, { status: 400 });
  const body = new Uint8Array(limit);
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (length + chunk.value.length > limit) {
        await reader.cancel();
        return Response.json({ error: "invalid_file" }, { status: 413 });
      }
      body.set(chunk.value, length); length += chunk.value.length;
    }
  } catch { return Response.json({ error: "invalid_file" }, { status: 400 }); }
  finally { reader.releaseLock(); }
  const form = await new Response(body.buffer.slice(0, length), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size > OUTPUT_FILE_MAX_BYTES) return Response.json({ error: "invalid_file" }, { status: 400 });
  try { return Response.json(await new ResearchOutputService().upload(access.access, file), { status: 201 }); }
  catch (error) { return Response.json({ error: "upload_failed" }, { status: error instanceof Error && error.message === "invalid_file" ? 400 : 500 }); }
}
