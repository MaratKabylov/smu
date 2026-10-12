import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ["/admin/:path*", "/api/:path*", "/:locale(ru|kk|en)/account/:path*"].map(source => ({ source, headers: [
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ...(source.includes("account") ? [{ key: "Cache-Control", value: "private, no-store" }, { key: "Referrer-Policy", value: "no-referrer" }] : []),
    ] }));
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
