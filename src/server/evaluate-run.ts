import { validateEvaluation } from "../domain/validate-evaluation";
import type { EvaluationResult, RunRecord } from "../domain/types";
import { buildEvaluationPrompt } from "./prompt";
import { claimRun, completeRun, failRun } from "./runs";

const PUBLIC_FAILURE =
  "The evaluation could not be completed. Please try again.";
const REPAIR_INSTRUCTION =
  "Correct the prior result using only the rubric and transcript. Return exactly 12 dimensions with legal scores, exact turn evidence, and consistent scoring signals. Do not return derived dimension names, maxima, bands, caps, score totals, or grades; the application supplies them. Do not repeat or discuss the prior result.";

function repairInstruction(error: unknown) {
  const reason = error instanceof Error && !("issues" in error)
    ? error.message.slice(0, 500)
    : "The result does not match the required schema.";
  return `${REPAIR_INSTRUCTION}\nSpecific validation failure: ${reason}`;
}

export type EvaluateRunDependencies = {
  claimRun: (id: string) => Promise<RunRecord | null>;
  completeRun: (id: string, result: EvaluationResult) => Promise<void>;
  failRun: (id: string, publicError: string) => Promise<void>;
  buildEvaluationPrompt: typeof buildEvaluationPrompt;
  requestCandidate: (prompt: string, repair?: string) => Promise<unknown>;
  logDiagnostic?: (
    category: "claim" | "provider" | "validation" | "persistence",
    status?: number,
  ) => void;
};

function safeStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const details = error as Record<string, unknown>;
  for (const key of ["statusCode", "status"] as const) {
    const value = details[key];
    if (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599) {
      return value;
    }
  }
  return undefined;
}

export function logEvaluationDiagnostic(
  category: "claim" | "provider" | "validation" | "persistence",
  status?: number,
) {
  console.error(JSON.stringify({
    event: "evaluation_failure",
    category,
    ...(status ? { status } : {}),
  }));
}

const productionDependencies: EvaluateRunDependencies = {
  claimRun,
  completeRun,
  failRun,
  buildEvaluationPrompt,
  requestCandidate: async (prompt, repair) =>
    (await import("./model")).requestCandidate(prompt, repair),
  logDiagnostic: logEvaluationDiagnostic,
};

export async function evaluateRun(
  id: string,
  dependencies: EvaluateRunDependencies = productionDependencies,
): Promise<void> {
  const logDiagnostic = dependencies.logDiagnostic ?? (() => undefined);
  const failSafely = async () => {
    try {
      await dependencies.failRun(id, PUBLIC_FAILURE);
    } catch (error) {
      logDiagnostic("persistence", safeStatus(error));
    }
  };

  let run: RunRecord | null;
  try {
    run = await dependencies.claimRun(id);
  } catch (error) {
    logDiagnostic("claim", safeStatus(error));
    return;
  }
  if (!run) return;

  let prompt: string;
  try {
    prompt = await dependencies.buildEvaluationPrompt(
      run.callType,
      run.transcript,
    );
  } catch (error) {
    logDiagnostic("validation", safeStatus(error));
    await failSafely();
    return;
  }

  let firstCandidate: unknown;
  try {
    firstCandidate = await dependencies.requestCandidate(prompt);
  } catch (error) {
    logDiagnostic("provider", safeStatus(error));
    await failSafely();
    return;
  }

  let result: EvaluationResult;
  try {
    result = validateEvaluation(
      run.callType,
      run.transcript,
      firstCandidate,
    );
  } catch (error) {
    logDiagnostic("validation", safeStatus(error));
    let repairedCandidate: unknown;
    try {
      repairedCandidate = await dependencies.requestCandidate(
        prompt,
        repairInstruction(error),
      );
    } catch (providerError) {
      logDiagnostic("provider", safeStatus(providerError));
      await failSafely();
      return;
    }

    try {
      result = validateEvaluation(
        run.callType,
        run.transcript,
        repairedCandidate,
      );
    } catch (validationError) {
      logDiagnostic("validation", safeStatus(validationError));
      await failSafely();
      return;
    }
  }

  try {
    await dependencies.completeRun(id, result);
  } catch (error) {
    logDiagnostic("persistence", safeStatus(error));
    await failSafely();
  }
}
