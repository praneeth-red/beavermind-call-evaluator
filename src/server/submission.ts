import { createHmac } from "node:crypto";

import type { CallType } from "../domain/types";

export function parseSubmission(formData: FormData): {
  callType: CallType;
  transcript: string;
} {
  const callType = formData.get("callType");
  const transcript = formData.get("transcript");

  if (callType !== "kickoff" && callType !== "coaching") {
    throw new Error("Choose kick-off or coaching.");
  }
  if (typeof transcript !== "string" || transcript.trim().length === 0) {
    throw new Error("Paste a transcript to evaluate.");
  }
  if (transcript.length > 65_000) {
    throw new Error("Transcript must be 65,000 characters or fewer.");
  }

  return { callType, transcript };
}

export function hashClientAddress(address: string, salt: string): string {
  return createHmac("sha256", salt).update(address).digest("hex");
}
