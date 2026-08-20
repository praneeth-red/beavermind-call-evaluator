import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";

import { ReportDocument } from "../../../../../src/pdf/report-document";
import { getPublicRun } from "../../../../../src/server/runs";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: noStoreHeaders });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return errorResponse("Run not found.", 404);
  }

  let run;
  try {
    run = await getPublicRun(id);
  } catch {
    return errorResponse("The PDF is temporarily unavailable.", 503);
  }

  if (!run) return errorResponse("Run not found.", 404);
  if (run.status !== "completed" || !run.result) {
    return errorResponse("A PDF is unavailable for this run.", 409);
  }

  try {
    const pdf = await renderToBuffer(ReportDocument({ result: run.result }));
    return new Response(new Uint8Array(pdf), {
      headers: {
        ...noStoreHeaders,
        "Content-Disposition": `attachment; filename="beavermind-call-evaluation-${id}.pdf"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch {
    return errorResponse("The PDF is temporarily unavailable.", 503);
  }
}
