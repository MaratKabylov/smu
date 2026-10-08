import { connection } from "next/server";
import { sitemapIds } from "@/lib/seo/sitemap";
import { sitemapIndex } from "@/lib/seo/xml";
export async function GET() {
  await connection();
  const maps = await sitemapIds();
  return new Response(sitemapIndex(maps.map(map => map.id)), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" } });
}
