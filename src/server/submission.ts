import { createHmac } from "node:crypto";

import type { CallType } from "../domain/types";

export const MAX_TRANSCRIPT_LENGTH = 500_000;

export function parseSubmission(formData: FormData): {
  callType: CallType;
  transcript: string;
} {
  const callType = formData.get("callType");
  const submittedTranscript = formData.get("transcript");

  if (callType !== "kickoff" && callType !== "coaching") {
    throw new Error("Choose kick-off or coaching.");
  }
  if (typeof submittedTranscript !== "string") {
    throw new Error("Paste a transcript to evaluate.");
  }
  const transcript = submittedTranscript.replace(/\r\n?/g, "\n");
  if (transcript.trim().length === 0) {
    throw new Error("Paste a transcript to evaluate.");
  }
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    throw new Error("Transcript is too large for one evaluation.");
  }

  return { callType, transcript };
}

export function hashClientAddress(address: string, salt: string): string {
  return createHmac("sha256", salt).update(address).digest("hex");
}
