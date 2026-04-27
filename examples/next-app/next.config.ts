import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
    webpackBuildWorker: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    "@amusendame/beakblock-core",
    "@amusendame/beakblock-react",
    "@amusendame/beakblock-vue",
  ],
};

export default nextConfig;
