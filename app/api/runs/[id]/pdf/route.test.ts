import { beforeEach, describe, expect, it, vi } from "vitest";

import { sampleResult } from "../../../../../src/pdf/report-fixture.test-helper";

const boundary = vi.hoisted(() => ({
  evaluateRun: vi.fn(),
  getPublicRun: vi.fn(),
}));

vi.mock("../../../../../src/server/runs", () => ({
  getPublicRun: boundary.getPublicRun,
}));
vi.mock("../../../../../src/server/evaluate-run", () => ({
  evaluateRun: boundary.evaluateRun,
}));

import { GET } from "./route";

const id = "9f6fd561-7d5d-45bf-a1c9-88ecb891db5e";

function request(runId = id) {
  return GET(new Request(`http://localhost/api/runs/${runId}/pdf`), {
    params: Promise.resolve({ id: runId }),
  });
}

function completedRun() {
  return {
    id,
    callType: "kickoff" as const,
    status: "completed" as const,
    result: sampleResult(),
    publicError: null,
    createdAt: "2026-08-21T10:00:00.000Z",
    startedAt: "2026-08-21T10:00:01.000Z",
    finishedAt: "2026-08-21T10:00:02.000Z",
  };
}

describe("GET /api/runs/:id/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a no-store PDF from the completed stored result without model work", async () => {
    boundary.getPublicRun.mockResolvedValue(completedRun());

    const response = await request();
    const bytes = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="beavermind-call-evaluation-${id}.pdf"`,
    );
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(5_000);
    expect(boundary.evaluateRun).not.toHaveBeenCalled();
  });

  it("returns 404 before storage for an invalid or missing run", async () => {
    const invalid = await request("not-a-uuid");
    expect(invalid.status).toBe(404);
    expect(boundary.getPublicRun).not.toHaveBeenCalled();

    boundary.getPublicRun.mockResolvedValue(null);
    const missing = await request();
    expect(missing.status).toBe(404);
  });

  it.each(["queued", "processing", "failed"] as const)(
    "returns 409 while a %s run has no completed result",
    async (status) => {
      boundary.getPublicRun.mockResolvedValue({
        ...completedRun(),
        status,
        result: null,
      });

      const response = await request();

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: "A PDF is unavailable for this run.",
      });
    },
  );

  it("returns a safe 503 when storage is unavailable", async () => {
    boundary.getPublicRun.mockRejectedValue(
      new Error("private persistence detail"),
    );

    const response = await request();
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).toContain("The PDF is temporarily unavailable.");
    expect(body).not.toContain("private persistence detail");
  });
});
