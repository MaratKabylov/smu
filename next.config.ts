import type { NextConfig } from "next";

function supabaseImageRemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const patterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [
    { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" },
  ];
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (raw) {
    try {
      const url = new URL(raw);
      if (url.protocol === "https:" || url.protocol === "http:") {
        patterns.unshift({
          protocol: url.protocol === "http:" ? "http" : "https",
          hostname: url.hostname,
          port: url.port,
          pathname: "/storage/v1/object/public/**",
        });
      }
    } catch {
      // Ignore malformed env at config load; runtime validation handles it.
    }
  }
  return patterns;
}

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    remotePatterns: supabaseImageRemotePatterns(),
  },
  async headers() {
    return [
      {
        source: "/images/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" },
        ],
      },
      ...["/admin/:path*", "/api/:path*", "/:locale(ru|kk|en)/account/:path*"].map(source => ({ source, headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ...(source.includes("account") ? [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }] : []),
      ] })),
      { source: "/:locale(ru|kk|en)/mentorship/legacy/:path*", headers: [
        { key: "Cache-Control", value: "private, no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ] },
      ...["/:locale(ru|kk|en)/support/:path*", "/api/support/:path*"].map(source => ({ source, headers: [
        { key: "Cache-Control", value: "private, no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ] })),
    ];
  },
  experimental: {
    serverActions: {
      // Two translations carry both bounded JSON and derived plain text.
      bodySizeLimit: "4mb",
    },
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
