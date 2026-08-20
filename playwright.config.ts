import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { defineConfig, devices } from "@playwright/test";

const testStore = join(
  tmpdir(),
  `beavermind-call-evaluator-${randomUUID()}.json`,
);
process.env.EVALUATOR_TEST_STORE = testStore;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 15_000 },
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      CLIENT_HASH_SALT: "local-e2e-only-salt",
      EVALUATOR_TEST_STORE: testStore,
      EVALUATOR_TEST_MODE: "1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
