import { validateEvaluation } from "../domain/validate-evaluation";
import type { EvaluationResult, RunRecord } from "../domain/types";
import { buildEvaluationPrompt } from "./prompt";
import { claimRun, completeRun, failRun } from "./runs";

const PUBLIC_FAILURE =
  "The evaluation could not be completed. Please try again.";
const REPAIR_INSTRUCTION =
  "Correct the prior result using only the rubric and transcript. Return exactly 12 dimensions with legal scores, exact turn evidence, consistent scoring signals and caps, and application-verifiable arithmetic fields. Do not repeat or discuss the prior result.";

export type EvaluateRunDependencies = {
  claimRun: (id: string) => Promise<RunRecord | null>;
  completeRun: (id: string, result: EvaluationResult) => Promise<void>;
  failRun: (id: string, publicError: string) => Promise<void>;
  buildEvaluationPrompt: typeof buildEvaluationPrompt;
  requestCandidate: (prompt: string, repair?: string) => Promise<unknown>;
};

const productionDependencies: EvaluateRunDependencies = {
  claimRun,
  completeRun,
  failRun,
  buildEvaluationPrompt,
  requestCandidate: async (prompt, repair) =>
    (await import("./model")).requestCandidate(prompt, repair),
};

export async function evaluateRun(
  id: string,
  dependencies: EvaluateRunDependencies = productionDependencies,
): Promise<void> {
  let run: RunRecord | null;
  try {
    run = await dependencies.claimRun(id);
  } catch {
    return;
  }
  if (!run) return;

  try {
    const prompt = await dependencies.buildEvaluationPrompt(
      run.callType,
      run.transcript,
    );
    const firstCandidate = await dependencies.requestCandidate(prompt);
    let result: EvaluationResult;

    try {
      result = validateEvaluation(
        run.callType,
        run.transcript,
        firstCandidate,
      );
    } catch {
      const repairedCandidate = await dependencies.requestCandidate(
        prompt,
        REPAIR_INSTRUCTION,
      );
      result = validateEvaluation(
        run.callType,
        run.transcript,
        repairedCandidate,
      );
    }

    await dependencies.completeRun(id, result);
  } catch {
    try {
      await dependencies.failRun(id, PUBLIC_FAILURE);
    } catch {
      // A concurrent terminal transition or persistence outage is handled by the run lifecycle.
    }
  }
}
