import type { NextConfig } from "next";

import { evaluatorTestModeEnabled } from "./src/server/test-mode";

evaluatorTestModeEnabled();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
