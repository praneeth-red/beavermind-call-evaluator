import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import type { EvaluationResult, TranscriptTurn } from "../src/domain/types";
import { Report, citedEvidenceTurns } from "./report";

function result(): EvaluationResult {
  return {
    coachSpeaker: "Coach",
    scoringSignals: {
      diagnosticsApplicable: {
        value: true,
        reasoning: "The coach explored the client's baseline.",
        evidence: [{ turn: 2, quote: "What is getting in the way?" }],
      },
      movementCoachingOccurred: {
        value: true,
        reasoning: "The coach connected movement to the goal.",
        evidence: [{ turn: 4, quote: "Let's make the next action smaller." }],
      },
      nextCallBookedLive: {
        value: false,
        reasoning: "No booking was completed live.",
        evidence: [],
      },
      followUpQuestionsAsked: { value: false, reasoning: "Not used in this rendered fixture.", evidence: [] },
      unresolvedClientConfusion: { value: false, reasoning: "Not used in this rendered fixture.", evidence: [] },
      northStarConstructed: { value: false, reasoning: "Not used in this rendered fixture.", evidence: [] },
      structuredRecapDelivered: { value: false, reasoning: "Not used in this rendered fixture.", evidence: [] },
      longTermVisionConnected: { value: true, reasoning: "The long-term vision was connected.", evidence: [{ turn: 2, quote: "What is getting in the way?" }] },
      concreteAccountabilityCommitment: { value: true, reasoning: "A commitment was confirmed.", evidence: [{ turn: 4, quote: "Let's make the next action smaller." }] },
      clientStrugglePresent: { value: true, reasoning: "A struggle was present.", evidence: [{ turn: 2, quote: "What is getting in the way?" }] },
      clientStruggleHandled: { value: true, reasoning: "The struggle was handled.", evidence: [{ turn: 4, quote: "Let's make the next action smaller." }] },
      actionStepsStated: { value: true, reasoning: "Action steps were stated.", evidence: [{ turn: 4, quote: "Let's make the next action smaller." }] },
    },
    oneThing: {
      improvement: "Close with a live booking.",
      explanation: "A confirmed next call removes follow-up uncertainty.",
      projectedScore: 84,
    },
    brief:
      "The call was focused, but <img src=x onerror=alert('private')> must render as text.",
    redFlags: [
      {
        risk: "The next call is not secured.",
        explanation: "Momentum may be lost after the session.",
        evidence: [{ turn: 8, quote: "Send me the link later." }],
      },
    ],
    rawScore: 76,
    activeMaximum: 100,
    normalizedScore: 64,
    grade: "AT RISK",
    dimensions: Array.from({ length: 12 }, (_, index) => ({
      dimension: index + 1,
      name: `Observed behavior ${index + 1}`,
      score: index === 3 ? null : index + 1,
      maximum: index === 3 ? 0 : 12,
      active: index !== 3,
      band: index === 3 ? "N/A" : "Developing",
      reasoning: `Reasoning for dimension ${index + 1}.`,
      evidence:
        index === 0
          ? [{ turn: 2, quote: "What is getting in the way?" }]
          : [],
      missingBehavior: `Missing behavior ${index + 1}.`,
      quickFix: `Quick fix ${index + 1}.`,
    })),
    appliedDimensionCaps: [
      { dimension: 10, maximum: 0, reason: "Next call was not booked live." },
    ],
    appliedTotalCaps: [
      { maximum: 80, reason: "Estimated coach word share exceeded 70%." },
    ],
    assumptions: [
      "Coach word share is used as a talk-time estimate.",
      "Inactive dimensions contribute neither points nor maximum points.",
    ],
  };
}

const turns: TranscriptTurn[] = Array.from({ length: 8 }, (_, index) => ({
  number: index + 1,
  speaker: index % 2 === 0 ? "Coach" : "Client",
  text: `Full transcript text for turn ${index + 1}.`,
}));

describe("Report", () => {
  it("shows the exact overall score on the rubric gauge", () => {
    const html = renderToStaticMarkup(
      createElement(Report, {
        result: result(),
        runId: "9f6fd561-7d5d-45bf-a1c9-88ecb891db5e",
        turns,
      }),
    );

    expect(html).toContain('aria-label="Overall score: 64 out of 100, AT RISK"');
    expect(html).toContain('data-score="64"');
    expect(html).toContain('class="score-gauge-gradient"');
    expect(html).toContain('class="score-gauge-glow"');
    expect(html).toContain('offset="22%" stop-color="var(--gauge-orange)"');
    expect(html).toContain('offset="58%" stop-color="var(--gauge-yellow)"');
    expect(html).toContain('offset="62%" stop-color="var(--gauge-blue)"');
    expect(html).toContain('class="score-gauge-selector"');
    expect(html).toContain('transform="translate(33.7 19.9) rotate(-39.6)"');
    expect(html).not.toContain("score-gauge-needle");
    expect(html).not.toContain("score-gauge-hub");
    expect(html).toContain("Fail");
    expect(html).toContain("At risk");
    expect(html).toContain("Inconsistent");
    expect(html).toContain("Strong");
    expect(html).toContain("Elite");
  });

  it("links back to a fresh evaluation from the report header", () => {
    const html = renderToStaticMarkup(
      createElement(Report, {
        result: result(),
        runId: "9f6fd561-7d5d-45bf-a1c9-88ecb891db5e",
        turns,
      }),
    );

    expect(html).toContain('href="/"');
    expect(html).toContain("Evaluate another call");
  });

  it("orders unique evidence turns by transcript chronology", () => {
    const fixture = result();
    fixture.dimensions[1].evidence = [{ turn: 8, quote: "Later citation." }];
    fixture.dimensions[2].evidence = [{ turn: 1, quote: "Earlier citation." }];

    expect(citedEvidenceTurns(fixture)).toEqual([1, 2, 8]);
  });

  it("server-renders the complete evidence-based report as escaped text", () => {
    const html = renderToStaticMarkup(
      createElement(Report, {
        result: result(),
        runId: "9f6fd561-7d5d-45bf-a1c9-88ecb891db5e",
        turns,
      }),
    );

    expect(html).toContain(">64<");
    expect(html).toContain("AT RISK");
    expect(html).toContain("Close with a live booking.");
    expect(html).toContain("Projected score: 84");
    expect(html).toContain("The call was focused");
    expect(html).toContain("The next call is not secured.");
    expect(html.match(/<details/g)).toHaveLength(12);
    expect(html).toContain("Observed behavior 12");
    expect(html).toContain("Turn 2");
    expect(html).toContain("What is getting in the way?");
    expect(html).toContain("Missing behavior 1.");
    expect(html).toContain("Quick fix 1.");
    expect(html.match(/class="evidence-turn"/g)).toHaveLength(2);
    expect(html).toContain('<button type="button" class="evidence-turn">Turn 2</button>');
    expect(html).toContain('<button type="button" class="evidence-turn">Turn 8</button>');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('<div class="report-workspace" data-drawer-open="false"><main class="report-shell">');
    expect(html).toContain('</main><div class="transcript-drawer-layer"');
    expect(html).toContain('data-open="false"');
    expect(html).not.toContain('hidden=""');
    expect(html).toContain("Full transcript text for turn 2.");
    expect(html).toContain("Previous evidence");
    expect(html).toContain("Next evidence");
    expect(html).not.toContain("Score controls");
    expect(html).not.toContain("Assumptions");
    expect(html.indexOf("Coach brief")).toBeLessThan(
      html.indexOf("Twelve scored dimensions"),
    );
    expect(html.indexOf("Red flags")).toBeGreaterThan(
      html.indexOf("Observed behavior 12"),
    );
    expect(html).toContain('href="/api/runs/9f6fd561-7d5d-45bf-a1c9-88ecb891db5e/pdf"');
    expect(html).toContain("&lt;img src=x onerror=alert(&#x27;private&#x27;)&gt;");
    expect(html).not.toContain("<img src=x");
  });
});
