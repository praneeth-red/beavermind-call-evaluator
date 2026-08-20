"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { evaluateRun } from "../src/server/evaluate-run";
import { getClientHashSalt } from "../src/server/env";
import {
  createLimitedRun,
  isSubmissionLimitError,
} from "../src/server/runs";
import { hashClientAddress, parseSubmission } from "../src/server/submission";

const HOUR_MS = 60 * 60_000;
const SUBMISSION_LIMIT = 10;

export async function submitTranscript(
  _previousState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  let submission;
  try {
    submission = parseSubmission(formData);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Check the transcript and try again.",
    };
  }

  let clientHash: string;
  try {
    const requestHeaders = await headers();
    const address =
      requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip") ||
      "unavailable";
    clientHash = hashClientAddress(address, getClientHashSalt());
  } catch {
    return { error: "The evaluator could not start. Try again shortly." };
  }

  let run;
  try {
    run = await createLimitedRun(
      { ...submission, clientHash },
      new Date(Date.now() - HOUR_MS),
      SUBMISSION_LIMIT,
    );
  } catch (error) {
    if (isSubmissionLimitError(error)) {
      return {
        error:
          "You have reached 10 evaluations in the last hour. Try again when the oldest submission reaches one hour.",
      };
    }
    return { error: "The evaluator could not start. Try again shortly." };
  }

  after(async () => {
    await evaluateRun(run.id);
  });
  redirect(`/runs/${run.id}`);
}
