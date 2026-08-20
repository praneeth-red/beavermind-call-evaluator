import type { NextConfig } from "next";

import { evaluatorTestModeEnabled } from "./src/server/test-mode";

evaluatorTestModeEnabled();

const nextConfig: NextConfig = {};

export default nextConfig;
