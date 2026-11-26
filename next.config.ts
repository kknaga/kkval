import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/stock/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=86400, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/:locale(es|ko|pt|ja|zh-tw|de)/stock/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=86400, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/compare/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=86400, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/screen/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=43200, stale-while-revalidate=43200",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
