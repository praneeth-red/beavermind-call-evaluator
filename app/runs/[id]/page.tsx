import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Report } from "../../../components/report";
import { RunStatus } from "../../../components/run-status";
import { parseTranscript } from "../../../src/domain/transcript";
import {
  getCompletedRunTranscript,
  getPublicRun,
} from "../../../src/server/runs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Call evaluation report",
  robots: { index: false, follow: false, noarchive: true },
};

type RunPageProps = { params: Promise<{ id: string }> };

export default async function RunPage({ params }: RunPageProps) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const run = await getPublicRun(id);
  if (!run) notFound();

  if (run.status === "completed" && run.result) {
    const transcript = await getCompletedRunTranscript(id);
    if (!transcript) notFound();
    return (
      <Report
        result={run.result}
        runId={id}
        turns={parseTranscript(transcript)}
      />
    );
  }

  return (
    <RunStatus
      id={id}
      initialStatus={run.status === "completed" ? "failed" : run.status}
      publicError={run.publicError}
    />
  );
}
