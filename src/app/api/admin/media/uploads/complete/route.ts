import type { NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { completeMediaUploadSchema } from "@/lib/validation/media";
import { getAdminAccess } from "@/server/services/access.service";
import {
  MediaService,
  MediaServiceError,
} from "@/server/services/media.service";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "invalid_origin" }, { status: 403 });
  }

  const accessResult = await getAdminAccess();
  if (accessResult.state === "unauthenticated") {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (accessResult.state !== "allowed") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = completeMediaUploadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!payload.success) {
    return Response.json({ error: "invalid_upload" }, { status: 400 });
  }

  try {
    const completed = await new MediaService().completeUpload(
      accessResult.access,
      payload.data,
    );
    return Response.json(completed);
  } catch (error) {
    if (error instanceof MediaServiceError) {
      const status = error.code === "forbidden" ? 403 : 400;
      return Response.json({ error: error.code }, { status });
    }
    return Response.json({ error: "upload_completion_failed" }, { status: 500 });
  }
}
