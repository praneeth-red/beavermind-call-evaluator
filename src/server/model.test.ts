import { beforeEach, expect, test, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  generateText: vi.fn(),
  isNoObjectGenerated: vi.fn((error: unknown) =>
    Boolean(error && typeof error === "object" && "noObjectGenerated" in error),
  ),
  object: vi.fn(() => "structured-output"),
}));

vi.mock("server-only", () => ({}));
vi.mock("ai", () => ({
  generateText: boundary.generateText,
  NoObjectGeneratedError: { isInstance: boundary.isNoObjectGenerated },
  Output: { object: boundary.object },
}));
vi.mock("./test-mode", () => ({ evaluatorTestModeEnabled: () => false }));

import { requestCandidate } from "./model";

beforeEach(() => {
  vi.clearAllMocks();
  boundary.generateText.mockResolvedValue({ output: { dimensions: [] } });
});

test("requests DeepSeek V4 Flash 0731 through Vercel with maximum reasoning", async () => {
  await requestCandidate("Evaluate this transcript");

  expect(boundary.generateText).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "deepseek/deepseek-v4-flash-0731",
      providerOptions: { gateway: { only: ["fireworks"] } },
      reasoning: "xhigh",
    }),
  );
});

test("rounds shuffled in-range model scores down using their dimension rules", async () => {
  boundary.generateText.mockResolvedValue({
    output: {
      dimensions: [
        { dimension: 9, active: true, score: 6 },
        { dimension: 2, active: true, score: 9 },
      ],
    },
  });

  const result = await requestCandidate("# Kick-off call — scoring rubric") as {
    dimensions: Array<{ score: number }>;
  };

  expect(result.dimensions).toEqual([
    { dimension: 9, active: true, score: 3 },
    { dimension: 2, active: true, score: 7 },
  ]);
});

test("returns fenced JSON for the existing validation repair path when structured output rejects it", async () => {
  boundary.generateText.mockRejectedValue(Object.assign(new Error("No object generated"), {
    noObjectGenerated: true,
    text: '```json\n{"dimensions":[]}\n```',
  }));

  await expect(requestCandidate("# Kick-off call — scoring rubric")).resolves.toEqual({
    dimensions: [],
  });
});
