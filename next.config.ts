import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
