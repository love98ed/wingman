import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Product photos load straight from the stores' Shopify CDN
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.shopify.com" }],
  },
};

export default nextConfig;
