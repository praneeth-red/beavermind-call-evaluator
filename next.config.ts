import type { NextConfig } from "next";

import { evaluatorTestModeEnabled } from "./src/server/test-mode";

evaluatorTestModeEnabled();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
