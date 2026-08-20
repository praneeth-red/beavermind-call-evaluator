import { describe, expect, it } from "vitest";

import { evaluatorTestModeEnabled } from "./test-mode";

describe("evaluatorTestModeEnabled", () => {
  it("allows explicit local test mode and leaves normal runtime disabled", () => {
    expect(evaluatorTestModeEnabled({ NODE_ENV: "development", EVALUATOR_TEST_MODE: "1" })).toBe(true);
    expect(evaluatorTestModeEnabled({ NODE_ENV: "development" })).toBe(false);
  });

  it.each([
    { NODE_ENV: "production", EVALUATOR_TEST_MODE: "1" },
    { NODE_ENV: "development", VERCEL_ENV: "production", EVALUATOR_TEST_MODE: "1" },
  ])("refuses test mode in production", (environment) => {
    expect(() => evaluatorTestModeEnabled(environment)).toThrow(
      "Evaluator test mode is refused in production.",
    );
  });
});
