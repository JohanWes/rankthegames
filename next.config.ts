import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    imageSizes: [48, 96, 220, 320, 440, 520],
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
