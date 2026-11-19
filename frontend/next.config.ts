import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.5.94"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
