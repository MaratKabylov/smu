import { isLocale } from "@/lib/i18n/locales";
import { rssFeed } from "@/lib/seo/xml";
import { SeoService } from "@/server/services/seo.service";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  const items = await new SeoService().feed(locale);
  return new Response(rssFeed(locale, items), { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "no-store" } });
}
