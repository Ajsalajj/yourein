import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 828, 1080, 1280, 1920],
    imageSizes: [160, 240, 320, 480],
  },
};

export default config;
