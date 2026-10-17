import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseEnv, isSupabaseConfigured } from "@/lib/env";
import { legacyPublicUrl } from "@/lib/i18n/locales";
import type { Database } from "@/types/database.types";

export async function proxy(request: NextRequest) {
  const legacy = legacyPublicUrl(new URL(request.url));
  if (legacy) return NextResponse.redirect(legacy, 308);

  let response = NextResponse.next({ request });

  // Catalogues stay anonymous. Support submission uses optional verified ownership.
  const accountRoute = /^\/(ru|kk|en)\/account(?:\/|$)/.test(request.nextUrl.pathname);
  const supportRoute = /^\/(ru|kk|en)\/support(?:\/|$)/.test(request.nextUrl.pathname) || request.nextUrl.pathname.startsWith("/api/support/");
  const needsSession = accountRoute || supportRoute || request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/") || request.nextUrl.pathname.startsWith("/api/admin/");
  if (!needsSession || !isSupabaseConfigured()) {
    return response;
  }

  const env = getPublicSupabaseEnv();
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!api/cron(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
