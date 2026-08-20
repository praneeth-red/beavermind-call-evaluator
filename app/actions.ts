"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { evaluateRun } from "../src/server/evaluate-run";
import { getClientHashSalt } from "../src/server/env";
import { countRecentRuns, createRun } from "../src/server/runs";
import { hashClientAddress, parseSubmission } from "../src/server/submission";

const HOUR_MS = 60 * 60_000;
const SUBMISSION_LIMIT = 10;

function errorLocation(message: string) {
  return `/?error=${encodeURIComponent(message)}`;
}

export async function submitTranscript(formData: FormData) {
  let submission;
  try {
    submission = parseSubmission(formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check the transcript and try again.";
    redirect(errorLocation(message));
  }

  let clientHash: string;
  let recentRuns: number;
  try {
    const requestHeaders = await headers();
    const address =
      requestHeaders.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip") ||
      "unavailable";
    clientHash = hashClientAddress(address, getClientHashSalt());
    recentRuns = await countRecentRuns(clientHash, new Date(Date.now() - HOUR_MS));
  } catch {
    redirect(errorLocation("The evaluator could not start. Try again shortly."));
  }

  if (recentRuns >= SUBMISSION_LIMIT) {
    redirect(
      errorLocation(
        "You have reached 10 evaluations in the last hour. Try again after the oldest one is an hour old.",
      ),
    );
  }

  let run;
  try {
    run = await createRun({ ...submission, clientHash });
  } catch {
    redirect(errorLocation("The evaluator could not start. Try again shortly."));
  }

  after(async () => {
    await evaluateRun(run.id);
  });
  redirect(`/runs/${run.id}`);
}
