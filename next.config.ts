import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.igdb.com",
        pathname: "/igdb/image/upload/**"
      },
      {
        protocol: "https",
        hostname: "shared.cloudflare.steamstatic.com",
        pathname: "/store_item_assets/steam/apps/**"
      }
    ]
  }
};

export default nextConfig;
