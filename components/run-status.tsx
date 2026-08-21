"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ReportSkeleton } from "./report-skeleton";

type ActiveStatus = "queued" | "processing";
type RunStatusProps = {
  id: string;
  initialStatus: "queued" | "processing" | "failed";
  publicError: string | null;
};

const labels: Record<ActiveStatus, string> = {
  queued: "Evaluation queued",
  processing: "Reviewing transcript evidence",
};

export function RunStatus({ id, initialStatus, publicError }: RunStatusProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [failure, setFailure] = useState(publicError);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "queued" && status !== "processing") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const response = await fetch(`/api/runs/${id}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Status request failed");
        const run = (await response.json()) as {
          status: "queued" | "processing" | "completed" | "failed";
          publicError: string | null;
        };
        if (cancelled) return;
        setPollError(null);
        if (run.status === "failed") {
          setFailure(run.publicError);
          setStatus("failed");
          return;
        }
        if (run.status === "completed") {
          router.refresh();
          return;
        }
        setStatus(run.status);
      } catch {
        if (!cancelled) setPollError("Status check failed. Retrying…");
      }
      if (!cancelled) timer = setTimeout(poll, 2_000);
    }

    timer = setTimeout(poll, 1_000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, router, status]);

  if (status === "failed") {
    return (
      <main className="status-shell">
        <p className="eyebrow">Evaluation stopped</p>
        <h1>The report could not be completed.</h1>
        <p>{failure ?? "Submit the transcript again."}</p>
        <a className="primary-action" href="/">Start a new evaluation</a>
      </main>
    );
  }

  return <ReportSkeleton
    eyebrow="Run in progress"
    title={labels[status]}
    description="This page updates automatically. You can close it and return to the same URL."
    note={pollError}
  />;
}
