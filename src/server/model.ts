import "server-only";

import { generateText, Output } from "ai";

import { evaluationCandidateSchema } from "../domain/evaluation-schema";

export async function requestCandidate(
  prompt: string,
  repair?: string,
): Promise<unknown> {
  const result = await generateText({
    model: "openai/gpt-5.6-luna",
    output: Output.object({ schema: evaluationCandidateSchema }),
    prompt: repair
      ? `${prompt}\n\nVALIDATION REPAIR\n${repair}\nReturn the full corrected object.`
      : prompt,
    reasoning: "high",
    maxOutputTokens: 32_000,
  });

  return result.output;
}
