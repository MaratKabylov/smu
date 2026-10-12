import { NextResponse, type NextRequest } from "next/server";
import { isLocale } from "@/lib/i18n/locales";
import { siteOrigin } from "@/lib/seo/site";
import { AccountService } from "@/server/services/account.service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
  if (!isLocale(locale)) return new NextResponse(null, { status: 404, headers });
  let destination: "account" | "update-password" | null = null;
  try {
    destination = await new AccountService().confirm({ token_hash: request.nextUrl.searchParams.get("token_hash"), type: request.nextUrl.searchParams.get("type") });
  } catch { /* Never return provider errors or tokens to the visitor. */ }
  const path = destination === "account" ? `/${locale}/account` : destination === "update-password" ? `/${locale}/account/update-password` : `/${locale}/account/login?error=confirm`;
  // Fixed destination and configured origin; never trust next/redirect_to/Host.
  return NextResponse.redirect(new URL(path, siteOrigin()), { status: 303, headers });
}
