import { createHash, timingSafeEqual } from "node:crypto";
import { EmailService } from "@/server/services/email.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const digest = (value: string) => createHash("sha256").update(value).digest();

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "email_not_configured" }, { status: 503, headers });
  const authorization = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return Response.json({ error: "email_not_configured" }, { status: 503, headers });
  try { return Response.json(await new EmailService().process(20), { headers }); }
  catch { console.error("Email queue processing failed."); return Response.json({ error: "email_processing_failed" }, { status: 500, headers }); }
}
export function HEAD() { return new Response(null, { status: 405, headers: { ...headers, Allow: "GET" } }); }
