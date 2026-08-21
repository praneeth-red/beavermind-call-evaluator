import { beforeEach, expect, test, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  generateText: vi.fn(),
  object: vi.fn(() => "structured-output"),
}));

vi.mock("server-only", () => ({}));
vi.mock("ai", () => ({
  generateText: boundary.generateText,
  Output: { object: boundary.object },
}));
vi.mock("./test-mode", () => ({ evaluatorTestModeEnabled: () => false }));

import { requestCandidate } from "./model";

beforeEach(() => {
  vi.clearAllMocks();
  boundary.generateText.mockResolvedValue({ output: { accepted: true } });
});

test("requests GPT-5.6 Luna with the AI SDK maximum reasoning level", async () => {
  await requestCandidate("Evaluate this transcript");

  expect(boundary.generateText).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "openai/gpt-5.6-luna",
      reasoning: "xhigh",
    }),
  );
});
