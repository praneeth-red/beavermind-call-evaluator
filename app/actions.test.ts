import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  after: vi.fn(),
  createLimitedRun: vi.fn(),
  evaluateRun: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: boundary.headers }));
vi.mock("next/navigation", () => ({ redirect: boundary.redirect }));
vi.mock("next/server", () => ({ after: boundary.after }));
vi.mock("../src/server/evaluate-run", () => ({
  evaluateRun: boundary.evaluateRun,
}));
vi.mock("../src/server/env", () => ({ getClientHashSalt: () => "test-salt" }));
vi.mock("../src/server/runs", () => ({
  createLimitedRun: boundary.createLimitedRun,
  isSubmissionLimitError: (error: unknown) =>
    error instanceof Error && error.message === "SUBMISSION_LIMIT_REACHED",
}));

import { submitTranscript } from "./actions";

function submission(transcript = "[Coach]: Keep this pasted transcript.") {
  const formData = new FormData();
  formData.set("callType", "kickoff");
  formData.set("transcript", transcript);
  return formData;
}

describe("submitTranscript", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.headers.mockResolvedValue(
      new Headers({ "x-real-ip": "203.0.113.8" }),
    );
  });

  it("returns a safe rate-limit state without redirecting or scheduling work", async () => {
    const formData = submission();
    boundary.createLimitedRun.mockRejectedValue(
      new Error("SUBMISSION_LIMIT_REACHED"),
    );

    await expect(
      submitTranscript({ error: null }, formData),
    ).resolves.toEqual({
      error:
        "You have reached 10 evaluations in the last hour. Try again when the oldest submission reaches one hour.",
    });
    expect(formData.get("transcript")).toBe(
      "[Coach]: Keep this pasted transcript.",
    );
    expect(boundary.after).not.toHaveBeenCalled();
    expect(boundary.redirect).not.toHaveBeenCalled();
  });

  it("schedules evaluation before redirecting after a successful create", async () => {
    boundary.createLimitedRun.mockResolvedValue({ id: "run-id" });

    await submitTranscript({ error: null }, submission());

    expect(boundary.after).toHaveBeenCalledOnce();
    expect(boundary.redirect).toHaveBeenCalledWith("/runs/run-id");
    expect(boundary.after.mock.invocationCallOrder[0]).toBeLessThan(
      boundary.redirect.mock.invocationCallOrder[0],
    );
  });
});
