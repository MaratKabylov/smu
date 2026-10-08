import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ["/admin/:path*", "/api/:path*"].map(source => ({ source, headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }));
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
