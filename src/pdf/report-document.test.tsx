import { execFileSync } from "node:child_process";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import { sampleResult } from "./report-fixture.test-helper";
import { ReportDocument } from "./report-document";

describe("ReportDocument", () => {
  it("renders the complete stored evaluation as a real, readable PDF", async () => {
    const result = sampleResult();
    const pdf = await renderToBuffer(ReportDocument({ result }));
    const text = execFileSync("pdftotext", ["-", "-"], {
      input: pdf,
      encoding: "utf8",
      maxBuffer: 2_000_000,
    });
    const lines = text.split(/\r?\n/).map((line) => line.trim());

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(5_000);
    expect(text).toContain("76");
    expect(text).toContain("INCONSISTENT");
    expect(text).toContain("Close with a live booking.");
    expect(text).toContain("Projected score: 84");
    expect(text).toContain("The call was focused and the next commitment stayed vague.");
    expect(text).toContain("The next call is not secured.");
    for (const title of [
      "Observed behavior 1",
      "Observed behavior 2",
      "Observed behavior 3",
      "Observed behavior 4",
      "Observed behavior 5",
      "Observed behavior 6",
      "Observed behavior 7",
      "Observed behavior 8",
      "Observed behavior 9",
      "Observed behavior 10",
      "Observed behavior 11",
      "Observed behavior 12",
    ]) {
      expect(lines).toContain(title);
    }
    expect(text).toContain("Reasoning for dimension 1.");
    expect(text).toContain("Turn 2");
    expect(text).toContain("What is getting in the way?");
    expect(text).toContain("Missing behavior 1.");
    expect(text).toContain("Quick fix 1.");
    expect(text).toContain("Next call was not booked live.");
    expect(text).toContain("Estimated coach word share exceeded 70%.");
    expect(text).toContain("Coach word share is used as a talk-time estimate.");
    expect(text).toContain(
      "Inactive dimensions contribute neither points nor maximum points.",
    );
    expect(text.indexOf("Red flags")).toBeGreaterThan(
      text.indexOf("Inactive dimensions contribute neither points nor maximum points."),
    );
    expect(text).toMatch(/Page 1 of \d+/);

    const compactPages = text
      .split("\f")
      .filter((page) => page.trim().length > 0)
      .map((page) => page.replace(/\s/g, ""));
    const firstMissingLabelPage = compactPages.find((page) =>
      page.includes("MISSINGBEHAVIOR"),
    );
    expect(firstMissingLabelPage).toContain("Missingbehavior1.");
  });

  it("keeps detail labels with content and honors page margins across long fields", async () => {
    const result = sampleResult();
    const evidenceTokens = Array.from(
      { length: 220 },
      (_, index) => `EV${String(index + 1).padStart(3, "0")}`,
    );
    const missingTokens = Array.from(
      { length: 220 },
      (_, index) => `MB${String(index + 1).padStart(3, "0")}`,
    );
    result.dimensions[0] = {
      ...result.dimensions[0],
      evidence: [
        {
          turn: 2,
          quote: `${evidenceTokens[0]} first retained line\n${evidenceTokens[1]} second retained line\n${evidenceTokens.slice(2).join(" long evidence ")}`,
        },
      ],
      missingBehavior: `${missingTokens[0]} first retained line\n${missingTokens[1]} second retained line\n${missingTokens.slice(2).join(" long missing behavior ")}`,
    };

    const pdf = await renderToBuffer(ReportDocument({ result }));
    const text = execFileSync("pdftotext", ["-", "-"], {
      input: pdf,
      encoding: "utf8",
      maxBuffer: 4_000_000,
    });
    const pages = text.split("\f").filter((page) => page.trim().length > 0);

    expect(pages.length).toBeGreaterThan(1);
    for (const token of [...evidenceTokens, ...missingTokens]) {
      expect(text).toContain(token);
    }

    const compactPages = pages.map((page) => page.replace(/\s/g, ""));
    const evidenceLabelPage = compactPages.find((page) =>
      page.includes("EXACTTURNEVIDENCE"),
    );
    const missingLabelPage = compactPages.find((page) =>
      page.includes("MISSINGBEHAVIOR"),
    );
    expect(evidenceLabelPage).toContain("EV001");
    expect(evidenceLabelPage).toContain("EV002");
    expect(missingLabelPage).toContain("MB001");
    expect(missingLabelPage).toContain("MB002");

    const bbox = execFileSync("pdftotext", ["-bbox", "-", "-"], {
      input: pdf,
      encoding: "utf8",
      maxBuffer: 8_000_000,
    });
    const bboxPages = [...bbox.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g)];
    const continuationTopPositions = bboxPages
      .slice(1)
      .filter((page) => />(?:EV|MB)\d{3}<\/word>/.test(page[1]))
      .map((page) => {
        const positions = [
          ...page[1].matchAll(
            /<word\b[^>]*\byMin="([0-9.]+)"[^>]*>(?:EV|MB)\d{3}<\/word>/g,
          ),
        ].map((match) => Number(match[1]));
        return Math.min(...positions);
      });

    expect(continuationTopPositions.length).toBeGreaterThan(0);
    for (const top of continuationTopPositions) {
      expect(top).toBeGreaterThanOrEqual(42);
    }
  });
});
