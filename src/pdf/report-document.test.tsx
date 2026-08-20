import { execFileSync } from "node:child_process";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import { sampleResult } from "./report-fixture.test-helper";
import { ReportDocument } from "./report-document";

describe("ReportDocument", () => {
  it("renders the complete stored evaluation as a real, readable PDF", async () => {
    const pdf = await renderToBuffer(ReportDocument({ result: sampleResult() }));
    const text = execFileSync("pdftotext", ["-", "-"], {
      input: pdf,
      encoding: "utf8",
      maxBuffer: 2_000_000,
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(5_000);
    expect(text).toContain("76");
    expect(text).toContain("INCONSISTENT");
    expect(text).toContain("Close with a live booking.");
    expect(text).toContain("Projected score: 84");
    expect(text).toContain("The call was focused and the next commitment stayed vague.");
    expect(text).toContain("The next call is not secured.");
    for (let dimension = 1; dimension <= 12; dimension += 1) {
      expect(text).toContain(`Observed behavior ${dimension}`);
    }
    expect(text).toContain("Reasoning for dimension 1.");
    expect(text).toContain("Turn 2");
    expect(text).toContain("What is getting in the way?");
    expect(text).toContain("Missing behavior 1.");
    expect(text).toContain("Quick fix 1.");
    expect(text).toContain("Next call was not booked live.");
    expect(text).toContain("Coach word share is used as a talk-time estimate.");
    expect(text).toMatch(/Page 1 of \d+/);
  });
});
