import { z } from "zod";

import { getPublicRun } from "../../../../src/server/runs";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json({ error: "Run not found." }, { status: 404, headers: noStoreHeaders });
  }

  let run;
  try {
    run = await getPublicRun(id);
  } catch {
    return Response.json(
      { error: "Run status is temporarily unavailable." },
      { status: 503, headers: noStoreHeaders },
    );
  }
  if (!run) {
    return Response.json({ error: "Run not found." }, { status: 404, headers: noStoreHeaders });
  }

  return Response.json(run, { headers: noStoreHeaders });
}
