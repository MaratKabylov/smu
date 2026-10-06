import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateLocalizedPath as revalidatePath } from "@/lib/i18n/revalidation";
import { ArticleSchedulingService } from "@/server/services/article-scheduling.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };
const digest = (value: string) => createHash("sha256").update(value).digest();

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    return Response.json({ error: "cron_not_configured" }, { status: 503, headers });
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }
  try {
    const result = await new ArticleSchedulingService().publishDue();
    // Always invalidate on an authorized successful run: a prior request may
    // have committed in the DB and lost its HTTP response before invalidation.
    revalidatePath("/admin/content/articles", "layout");
    for (const path of ["/journal", "/scientists", "/projects", "/research", "/events", "/publications"]) {
      revalidatePath(path, "layout");
    }
    return Response.json(result, { headers });
  } catch {
    // Do not send database details or secrets to the caller/log output.
    console.error("Scheduled article publishing failed.");
    return Response.json({ error: "publishing_failed" }, { status: 500, headers });
  }
}

// Next would otherwise derive HEAD from GET, which would mutate the database.
export function HEAD() {
  return new Response(null, { status: 405, headers: { ...headers, Allow: "GET" } });
}
