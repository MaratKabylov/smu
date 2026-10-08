import { connection } from "next/server";
import sitemap from "@/lib/seo/sitemap";
import { sitemapXml } from "@/lib/seo/xml";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!/^(0|[1-9][0-9]*)\.xml$/.test(id)) return new Response("Not found", { status: 404 });
  const entries = await sitemap({ id: Promise.resolve(id.slice(0, -4)) });
  return new Response(sitemapXml(entries), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" } });
}
