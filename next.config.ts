import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Product photos load straight from the stores' Shopify CDN
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.shopify.com" }],
  },
  // File tracing copies sharp's JavaScript but not its native binary and libvips,
  // so API routes crash on Vercel with "Could not load the sharp module".
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/@img/**/*"],
  },
};

export default nextConfig;
