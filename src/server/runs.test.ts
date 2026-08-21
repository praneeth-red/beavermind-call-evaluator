import { describe, expect, it } from "vitest";

import type { EvaluationResult, RunRecord } from "../domain/types";
import {
  STALE_RUN_ERROR,
  createInMemoryRunRepository,
} from "./runs";

const submission = {
  callType: "kickoff" as const,
  transcript: "[Coach]: What would make this call useful?",
  clientHash: "a".repeat(64),
};

function evaluationResult(): EvaluationResult {
  return {
    coachSpeaker: "Coach",
    scoringSignals: {
      diagnosticsApplicable: {
        value: true,
        reasoning: "The coach asks diagnostic questions.",
        evidence: [{ turn: 1, quote: "What would make this call useful?" }],
      },
      movementCoachingOccurred: {
        value: false,
        reasoning: "This is a kick-off call.",
        evidence: [],
      },
      nextCallBookedLive: {
        value: false,
        reasoning: "No live booking is observed.",
        evidence: [],
      },
      followUpQuestionsAsked: { value: true, reasoning: "A follow-up question was asked.", evidence: [{ turn: 1, quote: "What would make this call useful?" }] },
      unresolvedClientConfusion: { value: false, reasoning: "No unresolved confusion.", evidence: [] },
      northStarConstructed: { value: true, reasoning: "A North Star was constructed.", evidence: [{ turn: 1, quote: "What would make this call useful?" }] },
      structuredRecapDelivered: { value: true, reasoning: "A recap was delivered.", evidence: [{ turn: 1, quote: "What would make this call useful?" }] },
      longTermVisionConnected: { value: false, reasoning: "Not used for kick-off calls.", evidence: [] },
      concreteAccountabilityCommitment: { value: false, reasoning: "Not used for kick-off calls.", evidence: [] },
      clientStrugglePresent: { value: false, reasoning: "No struggle was present.", evidence: [] },
      clientStruggleHandled: { value: false, reasoning: "No struggle required handling.", evidence: [] },
      actionStepsStated: { value: false, reasoning: "Not used for kick-off calls.", evidence: [] },
    },
    oneThing: {
      improvement: "Confirm the next step.",
      explanation: "A clear close removes ambiguity.",
      projectedScore: 80,
    },
    brief: "A structured call with a weak close.",
    redFlags: [],
    rawScore: 0,
    activeMaximum: 100,
    normalizedScore: 0,
    grade: "FAIL",
    dimensions: Array.from({ length: 12 }, (_, index) => ({
      dimension: index + 1,
      name: `Dimension ${index + 1}`,
      score: 0,
      maximum: 10,
      active: true,
      band: "Developing",
      reasoning: "The behavior is partly demonstrated.",
      evidence: [],
      missingBehavior: "A stronger observable behavior.",
      quickFix: "Use one specific follow-up question.",
    })),
    appliedDimensionCaps: [],
    appliedTotalCaps: [],
    assumptions: [],
  };
}

function controllableClock(iso = "2026-08-21T10:00:00.000Z") {
  let value = new Date(iso);

  return {
    now: () => new Date(value),
    advance(milliseconds: number) {
      value = new Date(value.getTime() + milliseconds);
    },
  };
}

describe("run lifecycle", () => {
  it("creates a queued run with private submission data", async () => {
    const clock = controllableClock();
    const runs = createInMemoryRunRepository({ now: clock.now });

    const run = await runs.createRun(submission);

    expect(run).toMatchObject({
      callType: "kickoff",
      transcript: submission.transcript,
      clientHash: submission.clientHash,
      status: "queued",
      result: null,
      publicError: null,
      createdAt: "2026-08-21T10:00:00.000Z",
      startedAt: null,
      finishedAt: null,
    });
    expect(run.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("atomically limits concurrent submissions per hash using an exclusive cutoff", async () => {
    const clock = controllableClock();
    const runs = createInMemoryRunRepository({ now: clock.now });

    await runs.createRun(submission);
    clock.advance(60 * 60_000);
    const cutoff = new Date("2026-08-21T10:00:00.000Z");
    const attempts = await Promise.allSettled(
      Array.from({ length: 11 }, () =>
        runs.createLimitedRun(submission, cutoff, 10),
      ),
    );

    expect(attempts.filter(({ status }) => status === "fulfilled")).toHaveLength(10);
    expect(attempts.filter(({ status }) => status === "rejected")).toHaveLength(1);
    await expect(
      runs.createLimitedRun(
        { ...submission, clientHash: "b".repeat(64) },
        cutoff,
        10,
      ),
    ).resolves.toMatchObject({ status: "queued" });
    expect(runs.size).toBe(12);
  });

  it.each([
    { ...submission, transcript: "" },
    { ...submission, transcript: "x".repeat(500_001) },
    { ...submission, callType: "sales" },
  ])("rejects an invalid submission: $callType", async (input) => {
    const runs = createInMemoryRunRepository();

    await expect(runs.createRun(input as typeof submission)).rejects.toThrow(
      /invalid run submission/i,
    );
  });

  it("accepts the 500,000-character ceiling through limited run creation", async () => {
    const runs = createInMemoryRunRepository();

    await expect(
      runs.createLimitedRun(
        { ...submission, transcript: "x".repeat(500_000) },
        new Date("2026-08-21T09:00:00.000Z"),
        10,
      ),
    ).resolves.toMatchObject({ status: "queued" });
  });

  it("claims and completes a queued run", async () => {
    const clock = controllableClock();
    const runs = createInMemoryRunRepository({ now: clock.now });
    const created = await runs.createRun(submission);

    clock.advance(1_000);
    const claimed = await runs.claimRun(created.id);

    expect(claimed).toMatchObject({
      status: "processing",
      startedAt: "2026-08-21T10:00:01.000Z",
      finishedAt: null,
    });

    const result = evaluationResult();
    clock.advance(1_000);
    await runs.completeRun(created.id, result);

    await expect(runs.getPublicRun(created.id)).resolves.toMatchObject({
      id: created.id,
      status: "completed",
      result: expect.objectContaining({
        rawScore: 0,
        activeMaximum: 100,
        normalizedScore: 0,
        grade: "FAIL",
      }),
      publicError: null,
      finishedAt: "2026-08-21T10:00:02.000Z",
    });
  });

  it("returns transcript evidence only after a run completes", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);

    await expect(runs.getCompletedRunTranscript(created.id)).resolves.toBeNull();
    await runs.claimRun(created.id);
    await expect(runs.getCompletedRunTranscript(created.id)).resolves.toBeNull();
    await runs.completeRun(created.id, evaluationResult());

    await expect(runs.getCompletedRunTranscript(created.id)).resolves.toBe(
      submission.transcript,
    );
    await expect(runs.getPublicRun(created.id)).resolves.not.toHaveProperty(
      "transcript",
    );
  });

  it("preserves canonical caps and assumptions across complete and read", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);
    await runs.claimRun(created.id);
    const maxima = [10, 10, 5, 15, 10, 10, 5, 10, 10, 5, 5, 5];
    const canonicalResult: EvaluationResult = {
      ...evaluationResult(),
      dimensions: evaluationResult().dimensions.map((dimension, index) => ({
        ...dimension,
        maximum: maxima[index],
      })),
      appliedTotalCaps: [
        {
          maximum: 80,
          reason: "Estimated coach word share exceeded 70%.",
        },
      ],
      assumptions: [
        "The model-identified coach speaker is measured by word share as a talk-time estimate because transcripts have no timestamps.",
      ],
    };

    await runs.completeRun(created.id, canonicalResult);
    const publicRun = await runs.getPublicRun(created.id);

    expect(publicRun?.result).toEqual(canonicalResult);
  });

  it("rejects a malformed result before writing it", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);
    await runs.claimRun(created.id);
    const malformed = {
      ...evaluationResult(),
      transcript: "must stay private",
      rawError: "must stay server-side",
    } as unknown as EvaluationResult;

    await expect(runs.completeRun(created.id, malformed)).rejects.toThrow();
    await expect(runs.getPublicRun(created.id)).resolves.toMatchObject({
      status: "processing",
      result: null,
    });
  });

  it("rejects a malformed stored result instead of returning its extra keys", async () => {
    const id = crypto.randomUUID();
    const storedRun: RunRecord = {
      id,
      ...submission,
      status: "completed",
      result: {
        ...evaluationResult(),
        clientHash: "must stay private",
        rawError: "must stay server-side",
      } as unknown as EvaluationResult,
      publicError: null,
      createdAt: "2026-08-21T10:00:00.000Z",
      startedAt: "2026-08-21T10:00:01.000Z",
      finishedAt: "2026-08-21T10:00:02.000Z",
    };
    const runs = createInMemoryRunRepository({
      initialRuns: [storedRun],
    });

    await expect(runs.getPublicRun(id)).rejects.toThrow();
  });

  it("allows exactly one concurrent claim", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);

    const claims = await Promise.all(
      Array.from({ length: 8 }, () => runs.claimRun(created.id)),
    );

    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.filter((claim) => claim === null)).toHaveLength(7);
  });

  it("rejects invalid transitions from terminal states", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);
    await runs.claimRun(created.id);
    await runs.completeRun(created.id, evaluationResult());

    await expect(runs.completeRun(created.id, evaluationResult())).rejects.toThrow(
      /invalid run transition/i,
    );
    await expect(runs.failRun(created.id, "Please try again.")).rejects.toThrow(
      /invalid run transition/i,
    );
    await expect(runs.claimRun(created.id)).resolves.toBeNull();
  });

  it("returns only a safe public failure", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);
    await runs.claimRun(created.id);

    await runs.failRun(
      created.id,
      "The evaluation could not be completed. Please try again.",
    );

    const publicRun = await runs.getPublicRun(created.id);
    expect(publicRun).toMatchObject({
      status: "failed",
      result: null,
      publicError: "The evaluation could not be completed. Please try again.",
    });
    expect(publicRun).not.toHaveProperty("transcript");
    expect(publicRun).not.toHaveProperty("clientHash");
  });

  it("rejects carriage returns in public error messages", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);
    await runs.claimRun(created.id);

    await expect(
      runs.failRun(created.id, "Please try again.\rraw detail"),
    ).rejects.toThrow(/single-line/i);
    await expect(runs.getPublicRun(created.id)).resolves.toMatchObject({
      status: "processing",
      publicError: null,
    });
  });

  it.each(["queued", "processing"] as const)(
    "turns stale %s work into a terminal safe failure",
    async (status) => {
      const clock = controllableClock();
      const runs = createInMemoryRunRepository({
        now: clock.now,
        staleAfterMs: 60_000,
      });
      const created = await runs.createRun(submission);
      if (status === "processing") await runs.claimRun(created.id);

      clock.advance(60_001);
      const publicRun = await runs.getPublicRun(created.id);

      expect(publicRun).toMatchObject({
        status: "failed",
        result: null,
        publicError: STALE_RUN_ERROR,
        finishedAt: "2026-08-21T10:01:00.001Z",
      });
      await expect(runs.claimRun(created.id)).resolves.toBeNull();
    },
  );

  it("keeps max-reasoning model work alive beyond five minutes", async () => {
    const clock = controllableClock();
    const runs = createInMemoryRunRepository({ now: clock.now });
    const created = await runs.createRun(submission);
    await runs.claimRun(created.id);

    clock.advance(5 * 60_000 + 1);
    await expect(runs.getPublicRun(created.id)).resolves.toMatchObject({
      status: "processing",
    });

    clock.advance(7 * 60_000);
    await expect(runs.getPublicRun(created.id)).resolves.toMatchObject({
      status: "failed",
      publicError: STALE_RUN_ERROR,
    });
  });

  it("does not fail a run freshly claimed after a stale queued snapshot", async () => {
    let currentTime = new Date("2026-08-21T10:00:00.000Z");
    let nowCalls = 0;
    let runId = "";
    let runs!: ReturnType<typeof createInMemoryRunRepository>;
    const now = () => {
      nowCalls += 1;
      if (nowCalls === 2) void runs.claimRun(runId);
      return new Date(currentTime);
    };
    runs = createInMemoryRunRepository({ now, staleAfterMs: 60_000 });
    runId = (await runs.createRun(submission)).id;
    currentTime = new Date("2026-08-21T10:01:00.001Z");

    await expect(runs.getPublicRun(runId)).resolves.toMatchObject({
      status: "processing",
      publicError: null,
      startedAt: "2026-08-21T10:01:00.001Z",
      finishedAt: null,
    });
  });

  it("reads without creating or restarting work", async () => {
    const clock = controllableClock();
    const runs = createInMemoryRunRepository({
      now: clock.now,
      staleAfterMs: 60_000,
    });
    const created = await runs.createRun(submission);

    clock.advance(30_000);
    const firstRead = await runs.getPublicRun(created.id);
    const secondRead = await runs.getPublicRun(created.id);

    expect(firstRead).toMatchObject({ status: "queued", startedAt: null });
    expect(secondRead).toEqual(firstRead);
    await expect(runs.getPublicRun(crypto.randomUUID())).resolves.toBeNull();
    expect(runs.size).toBe(1);
  });
});
