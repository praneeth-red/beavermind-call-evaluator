import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CallType, EvaluationResult } from "./types";
import { gradeFor, normalizeScore, validateEvaluation } from "./validate-evaluation";
import { parseTranscript } from "./transcript";

const KICKOFF_MAXIMA = [10, 10, 5, 15, 10, 10, 5, 10, 10, 5, 5, 5];
const COACHING_MAXIMA = [10, 10, 15, 15, 10, 15, 5, 5, 5, 5, 5, 5];
const BASE_TRANSCRIPT = "[Coach]: Coach says alpha\n[Client]: Client says beta gamma";

function candidateFor(callType: CallType, quote = "Coach says alpha"): EvaluationResult {
  const maxima = callType === "kickoff" ? KICKOFF_MAXIMA : COACHING_MAXIMA;

  return {
    oneThing: {
      improvement: "Ask one more question",
      explanation: "It would deepen the call.",
      projectedScore: 80,
    },
    brief: "A concise assessment.",
    redFlags: [
      {
        risk: "Weak follow-through",
        explanation: "The next step needs clarity.",
        evidence: [{ turn: 1, quote }],
      },
    ],
    rawScore: 999,
    activeMaximum: 999,
    normalizedScore: 999,
    grade: "ELITE",
    dimensions: maxima.map((maximum, index) => ({
      dimension: index + 1,
      name: `Dimension ${index + 1}`,
      score: 0,
      maximum,
      active: true,
      band: "Fail",
      reasoning: "The behavior was not demonstrated.",
      evidence: [{ turn: 1, quote }],
      missingBehavior: "Required behavior was absent.",
      quickFix: "Demonstrate the behavior next time.",
    })),
    appliedDimensionCaps: [],
    appliedTotalCaps: [],
    assumptions: [],
  };
}

function fixture(name: string) {
  return readFileSync(join(process.cwd(), "fixtures", "transcripts", name), "utf8");
}

describe("parseTranscript", () => {
  it("assigns stable one-based turn numbers and preserves speaker text", () => {
    expect(parseTranscript("[Coach]: Hello there\n\n[Client]: Hi coach")).toEqual([
      { number: 1, speaker: "Coach", text: "Hello there" },
      { number: 2, speaker: "Client", text: "Hi coach" },
    ]);
  });

  it("rejects a nonblank line that is not [Speaker]: text", () => {
    expect(() => parseTranscript("Coach: missing brackets")).toThrow(/line 1/i);
  });
});

describe("score utilities", () => {
  it.each([
    [95, 105, 90],
    [70, 85, 82],
    [0, 100, 0],
  ])("normalizes %d active points out of %d to %d", (raw, activeMaximum, expected) => {
    expect(normalizeScore(raw, activeMaximum)).toBe(expected);
  });

  it.each([
    [100, "ELITE"],
    [90, "ELITE"],
    [89, "STRONG"],
    [80, "STRONG"],
    [79, "INCONSISTENT"],
    [70, "INCONSISTENT"],
    [69, "AT RISK"],
    [60, "AT RISK"],
    [59, "FAIL"],
    [0, "FAIL"],
  ] as const)("maps %d to %s", (score, grade) => {
    expect(gradeFor(score)).toBe(grade);
  });
});

describe("validateEvaluation", () => {
  it("rejects a projected score outside the report's 0 to 100 scale", () => {
    const candidate = candidateFor("kickoff");
    candidate.oneThing.projectedScore = 101;

    expect(() => validateEvaluation("kickoff", BASE_TRANSCRIPT, candidate)).toThrow();
  });

  it("requires each dimension exactly once", () => {
    const missing = candidateFor("kickoff");
    missing.dimensions.pop();
    expect(() => validateEvaluation("kickoff", BASE_TRANSCRIPT, missing)).toThrow(/12 dimensions/i);

    const duplicate = candidateFor("kickoff");
    duplicate.dimensions[11].dimension = 11;
    expect(() => validateEvaluation("kickoff", BASE_TRANSCRIPT, duplicate)).toThrow(/dimensions 1 through 12/i);
  });

  it.each([
    ["coaching", 1, 8, "fixed coaching bucket"],
    ["kickoff", 1, 8.5, "integer-only high-value kickoff dimension"],
    ["kickoff", 2, 8, "fixed kickoff bucket"],
    ["kickoff", 3, 4, "gap between kickoff score bands"],
  ] as const)("rejects %s D%d score %d outside its %s", (callType, dimension, score, _rule) => {
    const candidate = candidateFor(callType);
    candidate.dimensions[dimension - 1].score = score;
    expect(() => validateEvaluation(callType, BASE_TRANSCRIPT, candidate)).toThrow(/legal score/i);
  });

  it("accepts kickoff range values and half steps only on dimensions worth five or less", () => {
    const candidate = candidateFor("kickoff");
    candidate.dimensions[0].score = 8;
    candidate.dimensions[2].score = 4.5;
    candidate.dimensions[11].score = 3.5;

    const result = validateEvaluation("kickoff", BASE_TRANSCRIPT, candidate);

    expect(result.dimensions[0].score).toBe(8);
    expect(result.dimensions[2].score).toBe(4.5);
    expect(result.dimensions[11].score).toBe(3.5);
  });

  it("allows only coaching diagnostics and movement coaching to be inactive", () => {
    const kickoff = candidateFor("kickoff");
    kickoff.dimensions[2] = {
      ...kickoff.dimensions[2],
      active: false,
      score: null,
      band: "N/A",
      evidence: [],
    };
    expect(() => validateEvaluation("kickoff", BASE_TRANSCRIPT, kickoff)).toThrow(/cannot be inactive/i);

    const coaching = candidateFor("coaching");
    coaching.dimensions[4] = {
      ...coaching.dimensions[4],
      active: false,
      score: null,
      band: "N/A",
      evidence: [],
    };
    expect(() => validateEvaluation("coaching", BASE_TRANSCRIPT, coaching)).toThrow(/cannot be inactive/i);
  });

  it("rejects evidence that is not an exact excerpt from its numbered turn", () => {
    const wrongTurn = candidateFor("kickoff");
    wrongTurn.dimensions[0].evidence[0] = { turn: 2, quote: "Coach says alpha" };
    expect(() => validateEvaluation("kickoff", BASE_TRANSCRIPT, wrongTurn)).toThrow(/evidence/i);

    const invented = candidateFor("kickoff");
    invented.dimensions[0].evidence[0] = { turn: 1, quote: "Coach said something else" };
    expect(() => validateEvaluation("kickoff", BASE_TRANSCRIPT, invented)).toThrow(/evidence/i);
  });

  it("requires transcript evidence for every positive dimension score", () => {
    const candidate = candidateFor("kickoff");
    candidate.dimensions[0].score = 1;
    candidate.dimensions[0].evidence = [];

    expect(() => validateEvaluation("kickoff", BASE_TRANSCRIPT, candidate)).toThrow(/evidence/i);
  });

  it("validates evidence attached to inactive dimensions too", () => {
    const candidate = candidateFor("coaching");
    candidate.dimensions[1] = {
      ...candidate.dimensions[1],
      active: false,
      score: null,
      band: "N/A",
      evidence: [{ turn: 99, quote: "Invented" }],
    };

    expect(() => validateEvaluation("coaching", BASE_TRANSCRIPT, candidate)).toThrow(/evidence/i);
  });

  it("calculates coaching raw totals from 105 and ignores model arithmetic", () => {
    const candidate = candidateFor("coaching");
    candidate.dimensions.forEach((dimension, index) => {
      dimension.score = COACHING_MAXIMA[index];
    });

    const result = validateEvaluation("coaching", BASE_TRANSCRIPT, candidate);

    expect(result.rawScore).toBe(105);
    expect(result.activeMaximum).toBe(105);
    expect(result.normalizedScore).toBe(100);
    expect(result.grade).toBe("ELITE");
  });

  it("removes inactive dimensions from both raw points and active maximum without redistribution", () => {
    const candidate = candidateFor("coaching");
    candidate.dimensions.forEach((dimension, index) => {
      dimension.score = COACHING_MAXIMA[index];
    });
    for (const index of [1, 3]) {
      candidate.dimensions[index] = {
        ...candidate.dimensions[index],
        active: false,
        score: null,
        band: "N/A",
        evidence: [],
      };
    }

    const result = validateEvaluation("coaching", BASE_TRANSCRIPT, candidate);

    expect(result.rawScore).toBe(80);
    expect(result.activeMaximum).toBe(80);
    expect(result.normalizedScore).toBe(100);
    expect(result.dimensions[1].maximum).toBe(0);
    expect(result.dimensions[3].maximum).toBe(0);
  });

  it("applies dimension caps before the lowest total cap", () => {
    const candidate = candidateFor("coaching");
    candidate.dimensions.forEach((dimension, index) => {
      dimension.score = COACHING_MAXIMA[index];
    });
    candidate.appliedDimensionCaps = [
      { dimension: 3, maximum: 10, reason: "No long-term vision connection." },
    ];
    candidate.appliedTotalCaps = [
      { maximum: 75, reason: "Coach dominated the call." },
      { maximum: 70, reason: "No action steps before close." },
    ];

    const result = validateEvaluation("coaching", BASE_TRANSCRIPT, candidate);

    expect(result.dimensions[2].score).toBe(10);
    expect(result.rawScore).toBe(100);
    expect(result.normalizedScore).toBe(70);
    expect(result.grade).toBe("INCONSISTENT");
  });

  it.each([
    ["kickoff", 80],
    ["coaching", 75],
  ] as const)("caps %s calls from estimated coach word share", (callType, expectedCap) => {
    const transcript = "[Coach]: one two three four five six seven eight\n[Client]: nine ten";
    const candidate = candidateFor(callType, "one two three");
    const maxima = callType === "kickoff" ? KICKOFF_MAXIMA : COACHING_MAXIMA;
    candidate.dimensions.forEach((dimension, index) => {
      dimension.score = maxima[index];
      dimension.evidence = [{ turn: 1, quote: "one two three" }];
    });
    candidate.redFlags[0].evidence = [{ turn: 1, quote: "one two three" }];

    const result = validateEvaluation(callType, transcript, candidate);

    expect(result.normalizedScore).toBe(expectedCap);
    expect(result.appliedTotalCaps).toContainEqual(
      expect.objectContaining({ maximum: expectedCap, reason: expect.stringMatching(/estimated.*word share/i) }),
    );
    expect(result.assumptions).toContainEqual(expect.stringMatching(/word share.*estimate/i));
  });

  it("applies coaching-01's non-recoverable live-booking cap", () => {
    const transcript = fixture("coaching-01.txt");
    const candidate = candidateFor("coaching", "Hey Malik, can you hear me okay?");
    candidate.dimensions[9].score = 5;
    candidate.appliedDimensionCaps = [
      { dimension: 10, maximum: 0, reason: "Next call was not completed live." },
    ];

    const result = validateEvaluation("coaching", transcript, candidate);

    expect(result.dimensions[9].score).toBe(0);
  });

  it("keeps coaching-02 diagnostics and movement coaching inactive", () => {
    const transcript = fixture("coaching-02.txt");
    const candidate = candidateFor("coaching", "Hannah, hey, there she is. Can you hear me alright?");
    for (const index of [1, 3]) {
      candidate.dimensions[index] = {
        ...candidate.dimensions[index],
        active: false,
        score: null,
        band: "N/A",
        evidence: [],
      };
    }

    const result = validateEvaluation("coaching", transcript, candidate);

    expect(result.dimensions[1]).toMatchObject({ active: false, score: null, maximum: 0, band: "N/A" });
    expect(result.dimensions[3]).toMatchObject({ active: false, score: null, maximum: 0, band: "N/A" });
  });
});
