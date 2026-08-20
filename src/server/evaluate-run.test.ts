import { describe, expect, it } from "vitest";

import type { EvaluationResult } from "../domain/types";
import { evaluateRun, type EvaluateRunDependencies } from "./evaluate-run";
import { buildEvaluationPrompt } from "./prompt";
import { createInMemoryRunRepository } from "./runs";

const transcript =
  "[Coach]: Coach says alpha\n[Client]: Client says beta gamma\n[Coach]: Coach confirms delta\n[Coach]: Coach closes epsilon";
const submission = {
  callType: "kickoff" as const,
  transcript,
  clientHash: "b".repeat(64),
};

function candidate(): EvaluationResult {
  const maxima = [10, 10, 5, 15, 10, 10, 5, 10, 10, 5, 5, 5];
  return {
    coachSpeaker: "Coach",
    scoringSignals: {
      diagnosticsApplicable: {
        value: false,
        reasoning: "This signal is not used for kick-off calls.",
        evidence: [],
      },
      movementCoachingOccurred: {
        value: false,
        reasoning: "This signal is not used for kick-off calls.",
        evidence: [],
      },
      nextCallBookedLive: {
        value: false,
        reasoning: "This signal is not used for kick-off calls.",
        evidence: [],
      },
    },
    oneThing: {
      improvement: "Ask one deeper question.",
      explanation: "It would reveal more useful context.",
      projectedScore: 10,
    },
    brief: "The observable behaviors were limited.",
    redFlags: [],
    rawScore: 999,
    activeMaximum: 999,
    normalizedScore: 999,
    grade: "ELITE",
    dimensions: maxima.map((maximum, index) => ({
      dimension: index + 1,
      name: `Dimension ${index + 1}`,
      score: 0,
      maximum,
      active: true,
      band: "Fail",
      reasoning: "The behavior was not demonstrated.",
      evidence: [],
      missingBehavior: "Observable behavior was absent.",
      quickFix: "Demonstrate it on the next call.",
    })),
    appliedDimensionCaps: [],
    appliedTotalCaps: [],
    assumptions: [],
  };
}

function dependencies(
  runs: ReturnType<typeof createInMemoryRunRepository>,
  requestCandidate: EvaluateRunDependencies["requestCandidate"],
): EvaluateRunDependencies {
  return {
    claimRun: runs.claimRun.bind(runs),
    completeRun: runs.completeRun.bind(runs),
    failRun: runs.failRun.bind(runs),
    buildEvaluationPrompt,
    requestCandidate,
  };
}

describe("buildEvaluationPrompt", () => {
  it("uses only the selected rubric and numbers untrusted transcript turns", async () => {
    const prompt = await buildEvaluationPrompt("kickoff", transcript);

    expect(prompt).toContain("# Kick-off call — scoring rubric");
    expect(prompt).not.toContain("# Coaching call — scoring rubric");
    expect(prompt).toContain("Turn 1 | Coach: Coach says alpha");
    expect(prompt).toContain("Turn 2 | Client: Client says beta gamma");
    expect(prompt).toMatch(/ignore.*commands.*transcript/i);
    expect(prompt).toContain("diagnosticsApplicable");
    expect(prompt).toContain("movementCoachingOccurred");
    expect(prompt).toContain("nextCallBookedLive");
  });
});

describe("evaluateRun", () => {
  it("claims, validates, and completes a run with one model request", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);
    let requests = 0;

    await evaluateRun(
      created.id,
      dependencies(runs, async () => {
        requests += 1;
        return candidate();
      }),
    );

    expect(requests).toBe(1);
    await expect(runs.getPublicRun(created.id)).resolves.toMatchObject({
      status: "completed",
      result: {
        rawScore: 0,
        activeMaximum: 100,
        normalizedScore: 0,
        grade: "FAIL",
      },
      publicError: null,
    });
  });

  it("makes exactly one repair request after invalid evidence", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);
    const invalid = candidate();
    invalid.dimensions[0].score = 1;
    invalid.dimensions[0].evidence = [
      { turn: 1, quote: "fabricated transcript evidence" },
    ];
    const repairs: Array<string | undefined> = [];

    await evaluateRun(
      created.id,
      dependencies(runs, async (_prompt, repair) => {
        repairs.push(repair);
        return repairs.length === 1 ? invalid : candidate();
      }),
    );

    expect(repairs).toHaveLength(2);
    expect(repairs[0]).toBeUndefined();
    expect(repairs[1]).toMatch(/exact turn evidence/i);
    expect(repairs[1]).not.toContain("fabricated transcript evidence");
    await expect(runs.getPublicRun(created.id)).resolves.toMatchObject({
      status: "completed",
      publicError: null,
    });
  });

  it("fails safely after a second invalid result", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);
    const invalid = candidate();
    invalid.dimensions[0].score = 1;
    invalid.dimensions[0].evidence = [{ turn: 1, quote: "invented secret" }];
    let requests = 0;

    await evaluateRun(
      created.id,
      dependencies(runs, async () => {
        requests += 1;
        return invalid;
      }),
    );

    expect(requests).toBe(2);
    const publicRun = await runs.getPublicRun(created.id);
    expect(publicRun).toMatchObject({
      status: "failed",
      result: null,
      publicError: "The evaluation could not be completed. Please try again.",
    });
    expect(publicRun?.publicError).not.toContain("invented secret");
  });

  it("keeps schema-invalid model output out of repair and public errors", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);
    const sentinel = "MODEL_OUTPUT_SENTINEL_8f93c1";
    const invalid = { ...candidate(), [sentinel]: "must remain private" };
    const repairs: Array<string | undefined> = [];

    await evaluateRun(
      created.id,
      dependencies(runs, async (_prompt, repair) => {
        repairs.push(repair);
        return invalid;
      }),
    );

    expect(repairs).toHaveLength(2);
    expect(repairs[0]).toBeUndefined();
    expect(repairs[1]).not.toContain(sentinel);
    const publicRun = await runs.getPublicRun(created.id);
    expect(publicRun).toMatchObject({
      status: "failed",
      result: null,
      publicError: "The evaluation could not be completed. Please try again.",
    });
    expect(publicRun?.publicError).not.toContain(sentinel);
  });

  it("fails safely after a provider error without a repair request", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);
    let requests = 0;

    await evaluateRun(
      created.id,
      dependencies(runs, async () => {
        requests += 1;
        throw new Error("raw provider secret and stack");
      }),
    );

    expect(requests).toBe(1);
    const publicRun = await runs.getPublicRun(created.id);
    expect(publicRun).toMatchObject({
      status: "failed",
      result: null,
      publicError: "The evaluation could not be completed. Please try again.",
    });
    expect(publicRun?.publicError).not.toContain("provider");
  });

  it("allows one model call across concurrent and repeated worker invocations", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);
    let requests = 0;
    const workerDependencies = dependencies(runs, async () => {
      requests += 1;
      return candidate();
    });

    await Promise.all([
      evaluateRun(created.id, workerDependencies),
      evaluateRun(created.id, workerDependencies),
    ]);
    await evaluateRun(created.id, workerDependencies);

    expect(requests).toBe(1);
    await expect(runs.getPublicRun(created.id)).resolves.toMatchObject({
      status: "completed",
    });
  });
});
