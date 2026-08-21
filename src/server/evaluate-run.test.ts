import { describe, expect, it, vi } from "vitest";

import type { EvaluationResult } from "../domain/types";
import {
  evaluateRun,
  logEvaluationDiagnostic,
  type EvaluateRunDependencies,
} from "./evaluate-run";
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
      followUpQuestionsAsked: { value: true, reasoning: "A follow-up question was asked.", evidence: [{ turn: 1, quote: "Coach says alpha" }] },
      unresolvedClientConfusion: { value: false, reasoning: "No unresolved confusion.", evidence: [] },
      northStarConstructed: { value: true, reasoning: "A North Star was constructed.", evidence: [{ turn: 1, quote: "Coach says alpha" }] },
      structuredRecapDelivered: { value: true, reasoning: "A recap was delivered.", evidence: [{ turn: 1, quote: "Coach says alpha" }] },
      longTermVisionConnected: { value: false, reasoning: "Not used for kick-off calls.", evidence: [] },
      concreteAccountabilityCommitment: { value: false, reasoning: "Not used for kick-off calls.", evidence: [] },
      clientStrugglePresent: { value: false, reasoning: "No struggle was present.", evidence: [] },
      clientStruggleHandled: { value: false, reasoning: "No struggle required handling.", evidence: [] },
      actionStepsStated: { value: false, reasoning: "Not used for kick-off calls.", evidence: [] },
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
    expect(prompt).toContain("northStarConstructed");
    expect(prompt).toContain("structuredRecapDelivered");
    expect(prompt).toContain("unresolvedClientConfusion");
    expect(prompt).toContain("concreteAccountabilityCommitment");
    expect(prompt).toContain("clientStruggleHandled");
    expect(prompt).toContain("actionStepsStated");
  });
});

describe("evaluateRun", () => {
  it("writes only the diagnostic category and safe numeric status", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logEvaluationDiagnostic("provider", 403);

    expect(consoleError).toHaveBeenCalledWith(
      '{"event":"evaluation_failure","category":"provider","status":403}',
    );
    consoleError.mockRestore();
  });

  it("reports sanitized claim, provider, validation, and persistence categories", async () => {
    const diagnostics: Array<{ category: string; status?: number }> = [];
    const sentinel = "RAW_PROVIDER_ACCOUNT_SENTINEL";
    const capture = (category: string, status?: number) => {
      diagnostics.push({ category, ...(status ? { status } : {}) });
    };

    const claimRuns = createInMemoryRunRepository();
    const claimRun = await claimRuns.createRun(submission);
    const claimDependencies = dependencies(claimRuns, async () => candidate()) as
      EvaluateRunDependencies & { logDiagnostic: typeof capture };
    claimDependencies.claimRun = async () => {
      throw Object.assign(new Error(sentinel), { statusCode: 503 });
    };
    claimDependencies.logDiagnostic = capture;
    await evaluateRun(claimRun.id, claimDependencies);

    const providerRuns = createInMemoryRunRepository();
    const providerRun = await providerRuns.createRun(submission);
    const providerDependencies = dependencies(providerRuns, async () => {
      throw Object.assign(new Error(sentinel), { statusCode: 403 });
    }) as EvaluateRunDependencies & { logDiagnostic: typeof capture };
    providerDependencies.logDiagnostic = capture;
    await evaluateRun(providerRun.id, providerDependencies);

    const validationRuns = createInMemoryRunRepository();
    const validationRun = await validationRuns.createRun(submission);
    const invalid = { ...candidate(), rawScore: Number.NaN };
    const validationDependencies = dependencies(validationRuns, async () => invalid) as
      EvaluateRunDependencies & { logDiagnostic: typeof capture };
    validationDependencies.logDiagnostic = capture;
    await evaluateRun(validationRun.id, validationDependencies);

    const persistenceRuns = createInMemoryRunRepository();
    const persistenceRun = await persistenceRuns.createRun(submission);
    const persistenceDependencies = dependencies(persistenceRuns, async () => candidate()) as
      EvaluateRunDependencies & { logDiagnostic: typeof capture };
    persistenceDependencies.completeRun = async () => {
      throw Object.assign(new Error(sentinel), { status: 409 });
    };
    persistenceDependencies.logDiagnostic = capture;
    await evaluateRun(persistenceRun.id, persistenceDependencies);

    expect(diagnostics).toEqual([
      { category: "claim", status: 503 },
      { category: "provider", status: 403 },
      { category: "validation" },
      { category: "validation" },
      { category: "persistence", status: 409 },
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain(sentinel);
  });

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

  it("makes exactly one repair request with safe validation feedback", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);
    const invalid = candidate();
    invalid.scoringSignals.followUpQuestionsAsked.evidence = [];
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
    expect(repairs[1]).toMatch(/follow-up questions.*requires evidence/i);
    await expect(runs.getPublicRun(created.id)).resolves.toMatchObject({
      status: "completed",
      publicError: null,
    });
  });

  it("fails safely after a second invalid result", async () => {
    const runs = createInMemoryRunRepository();
    const created = await runs.createRun(submission);
    const invalid = candidate();
    invalid.scoringSignals.followUpQuestionsAsked.evidence = [];
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
    expect(publicRun?.publicError).not.toContain("follow-up questions");
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
