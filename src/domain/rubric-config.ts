import type { CallType } from "./types";

export interface DimensionRule {
  name: string;
  maximum: number;
  scores: readonly number[];
  bands: readonly { band: string; scores: readonly number[] }[];
  optional?: boolean;
  caps?: readonly number[];
}

export interface RubricConfig {
  dimensions: readonly DimensionRule[];
  coachWordShareCap: {
    threshold: number;
    maximum: number;
  };
}

const range = (minimum: number, maximum: number, step = 1) =>
  Array.from(
    { length: Math.round((maximum - minimum) / step) + 1 },
    (_, index) => minimum + index * step,
  );

function dimension(
  name: string,
  maximum: number,
  bands: DimensionRule["bands"],
  options: Pick<DimensionRule, "optional" | "caps"> = {},
): DimensionRule {
  return {
    name,
    maximum,
    bands,
    scores: bands.flatMap(({ scores }) => scores),
    ...options,
  };
}

const fixed10 = (
  name: string,
  mid = "Mid",
  options: Pick<DimensionRule, "optional" | "caps"> = {},
) =>
  dimension(
    name,
    10,
    [
      { band: "Elite", scores: [10] },
      { band: "Strong", scores: [7] },
      { band: mid, scores: [3] },
      { band: "Fail", scores: [0] },
    ],
    options,
  );

const fixed15 = (
  name: string,
  options: Pick<DimensionRule, "optional" | "caps"> = {},
) =>
  dimension(
    name,
    15,
    [
      { band: "Elite", scores: [15] },
      { band: "Strong", scores: [10] },
      { band: "Mid", scores: [5] },
      { band: "Fail", scores: [0] },
    ],
    options,
  );

const fixed5 = (
  name: string,
  options: Pick<DimensionRule, "optional" | "caps"> = {},
) =>
  dimension(
    name,
    5,
    [
      { band: "Elite", scores: [5] },
      { band: "Mid", scores: [3] },
      { band: "Fail", scores: [0] },
    ],
    options,
  );

export const rubricConfigs: Record<CallType, RubricConfig> = {
  kickoff: {
    dimensions: [
      dimension("Pre-Call Preparation", 10, [
        { band: "Elite", scores: range(9, 10) },
        { band: "Strong", scores: range(6, 8) },
        { band: "Mid", scores: range(4, 5) },
        { band: "Weak", scores: range(1, 3) },
        { band: "Fail", scores: [0] },
      ]),
      fixed10("Rapport & Tone"),
      dimension("Agenda Framing", 5, [
        { band: "Elite", scores: range(4.5, 5, 0.5) },
        { band: "Mid", scores: range(2.5, 3.5, 0.5) },
        { band: "Weak", scores: range(1, 2, 0.5) },
        { band: "Fail", scores: [0] },
      ]),
      fixed15("Goal Alignment & Deep Why", { caps: [10] }),
      dimension("Program Explanation (3 Phases)", 10, [
        { band: "Elite", scores: range(9, 10) },
        { band: "Strong", scores: range(6, 8) },
        { band: "Mid", scores: range(3, 5) },
        { band: "Weak", scores: range(1, 2) },
        { band: "Fail", scores: [0] },
      ]),
      fixed10("Journey & Expectation Setting"),
      fixed5("Support System Clarity"),
      fixed10("Coaching Intelligence Questions"),
      fixed10("Next Steps & Diagnostics"),
      dimension("Booking Next Call", 5, [
        { band: "Elite", scores: range(4.5, 5, 0.5) },
        { band: "Mid", scores: range(2.5, 3.5, 0.5) },
        { band: "Weak", scores: range(1, 2, 0.5) },
        { band: "Fail", scores: [0] },
      ]),
      fixed5("Close, Recap & Confidence", { caps: [3] }),
      dimension("Post-Call Execution", 5, [
        { band: "Elite", scores: range(4.5, 5, 0.5) },
        { band: "Strong", scores: range(3.5, 4, 0.5) },
        { band: "Mid", scores: range(2, 3, 0.5) },
        { band: "Weak", scores: [1] },
        { band: "Fail", scores: [0] },
      ]),
    ],
    coachWordShareCap: { threshold: 0.7, maximum: 80 },
  },
  coaching: {
    dimensions: [
      fixed10("Check-In & Connection", "Surface"),
      fixed10("Diagnostics Review", "Surface", { optional: true }),
      fixed15("Program Focus + Vision", { caps: [10] }),
      fixed15("Movement Coaching Quality", { optional: true }),
      fixed10("Adjustments & Strategy", "Surface"),
      fixed15("Action Steps & Accountability", { caps: [10] }),
      fixed5("Accountability Anchor"),
      fixed5("Struggle Handling", { caps: [0] }),
      fixed5("Close Quality"),
      dimension(
        "Next Call Booking",
        5,
        [
          { band: "Elite", scores: [5] },
          { band: "Fail", scores: [0] },
        ],
        { caps: [0] },
      ),
      fixed5("Continuity & Follow-Up Clarity"),
      fixed5("Structure & Time Management"),
    ],
    coachWordShareCap: { threshold: 0.75, maximum: 75 },
  },
};
