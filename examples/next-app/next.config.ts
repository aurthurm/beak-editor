import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
    webpackBuildWorker: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: [
    "@amusendame/beakblock-core",
    "@amusendame/beakblock-react",
    "@amusendame/beakblock-vue",
    "@amusendame/beakblock-schema",
    "@amusendame/beakblock-ir",
    "@amusendame/beakblock-commands",
    "@amusendame/beakblock-permissions",
    "@amusendame/beakblock-review",
    "@amusendame/beakblock-layout",
    "@amusendame/beakblock-export-docx",
    "@amusendame/beakblock-import-docx",
    "@amusendame/beakblock-templates",
    "@amusendame/beakblock-blocks-qms",
    "@amusendame/beakblock-blocks-office",
    "@amusendame/beakblock-blocks-clinical",
    "@amusendame/beakblock-ai",
  ],
};

export default nextConfig;
