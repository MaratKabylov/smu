import type { NextRequest } from "next/server";

export function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const trustedOrigins = new Set([request.nextUrl.origin]);
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;

  if (configuredOrigin) {
    try {
      trustedOrigins.add(new URL(configuredOrigin).origin);
    } catch {
      return false;
    }
  }

  return trustedOrigins.has(origin);
}
