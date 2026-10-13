import type { NextConfig } from "next";

const deploymentId = (
  process.env.COMMIT_REF ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.DEPLOY_ID ||
  process.env.NEXT_PUBLIC_APP_VERSION ||
  ""
).slice(0, 32) || undefined;

const nextConfig: NextConfig = {
  deploymentId,
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      {
        source: "/downloads/thodenngay.json",
        destination: "https://github.com/hoaitv86/thodenngay/releases/latest/download/latest.json",
        permanent: false,
      },
      {
        source: "/downloads/thodenngay.apk",
        destination: "https://github.com/hoaitv86/thodenngay/releases/latest/download/thodenngay.apk",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/offline-sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
