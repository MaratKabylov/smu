import type { NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { createMediaUploadSchema } from "@/lib/validation/media";
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

  const payload = createMediaUploadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!payload.success) {
    return Response.json({ error: "invalid_file" }, { status: 400 });
  }

  try {
    const upload = await new MediaService().createUpload(
      accessResult.access,
      payload.data,
    );
    return Response.json(upload, { status: 201 });
  } catch (error) {
    if (error instanceof MediaServiceError && error.code === "forbidden") {
      return Response.json({ error: error.code }, { status: 403 });
    }
    return Response.json({ error: "upload_initialization_failed" }, { status: 500 });
  }
}
