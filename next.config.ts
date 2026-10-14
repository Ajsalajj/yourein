import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  async headers() {
    // Belt and braces for pages that must never be listed: the same directive as their metadata, sent as a header.
    const noindexFollow = [{ key: "X-Robots-Tag", value: "noindex, follow" }];
    const noindex = [{ key: "X-Robots-Tag", value: "noindex" }];
    return [
      { source: "/i/:path*", headers: noindexFollow },
      ...["dashboard", "invites", "guests", "account", "edit", "pay", "success", "start", "signin", "reset", "shot"].map((p) => ({ source: `/${p}/:path*`, headers: noindex })),
      { source: "/signin", headers: noindex },
      { source: "/dashboard", headers: noindex },
      { source: "/invites", headers: noindex },
      { source: "/guests", headers: noindex },
      { source: "/account", headers: noindex },
      { source: "/reset", headers: noindex },
    ];
  },
  async redirects() {
    // /templates has no page of its own: the catalog is /create.
    return [{ source: "/templates", destination: "/create", permanent: true }];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 828, 1080, 1280, 1920],
    imageSizes: [160, 240, 320, 480],
  },
};

export default config;
