import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    dirs: ["src"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.nhle.com",
      },
    ],
  },
};

export default nextConfig;
