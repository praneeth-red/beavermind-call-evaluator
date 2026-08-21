import { describe, expect, it } from "vitest";

import { hashClientAddress, parseSubmission } from "./submission";

function form(callType: string, transcript: string) {
  const data = new FormData();
  data.set("callType", callType);
  data.set("transcript", transcript);
  return data;
}

describe("submission boundary", () => {
  it("accepts transcripts far longer than the supplied examples", () => {
    const transcript = "x".repeat(250_000);

    expect(parseSubmission(form("kickoff", transcript))).toEqual({
      callType: "kickoff",
      transcript,
    });
    expect(parseSubmission(form("coaching", "[Coach]: Start here."))).toEqual({
      callType: "coaching",
      transcript: "[Coach]: Start here.",
    });
  });

  it("measures textarea line endings the same way as the browser character counter", () => {
    const browserTranscript = `${"x\n".repeat(500)}${"x".repeat(63_795)}`;
    const serializedTranscript = browserTranscript.replaceAll("\n", "\r\n");

    expect(browserTranscript).toHaveLength(64_795);
    expect(serializedTranscript.length).toBeGreaterThan(65_000);
    expect(parseSubmission(form("coaching", serializedTranscript))).toEqual({
      callType: "coaching",
      transcript: browserTranscript,
    });
  });

  it.each([
    ["sales", "[Coach]: Hello", "Choose kick-off or coaching."],
    ["kickoff", "   ", "Paste a transcript to evaluate."],
    ["coaching", "x".repeat(500_001), "Transcript is too large for one evaluation."],
  ])("rejects invalid form input", (callType, transcript, message) => {
    expect(() => parseSubmission(form(callType, transcript))).toThrow(message);
  });

  it("creates a stable one-way HMAC without retaining the address", () => {
    const hash = hashClientAddress("203.0.113.8", "test-salt");

    expect(hash).toBe(
      "197c084abed824babbc2505344fd93df2b9dc2bedd30cb050d4a2cf6e7dd09a7",
    );
    expect(hash).not.toContain("203.0.113.8");
  });
});
