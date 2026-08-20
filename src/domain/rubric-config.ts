import type { CallType } from "./types";

export interface DimensionRule {
  maximum: number;
  scores: readonly number[];
  optional?: boolean;
  caps?: readonly number[];
}

export interface RubricConfig {
  dimensions: readonly DimensionRule[];
  totalCaps: readonly number[];
  coachWordShareCap: {
    threshold: number;
    maximum: number;
  };
}

const integers = (maximum: number) => Array.from({ length: maximum + 1 }, (_, score) => score);

export const rubricConfigs: Record<CallType, RubricConfig> = {
  kickoff: {
    dimensions: [
      { maximum: 10, scores: integers(10) },
      { maximum: 10, scores: [0, 3, 7, 10] },
      { maximum: 5, scores: [0, 1, 1.5, 2, 2.5, 3, 3.5, 4.5, 5] },
      { maximum: 15, scores: [0, 5, 10, 15], caps: [10] },
      { maximum: 10, scores: integers(10) },
      { maximum: 10, scores: [0, 3, 7, 10] },
      { maximum: 5, scores: [0, 3, 5] },
      { maximum: 10, scores: [0, 3, 7, 10] },
      { maximum: 10, scores: [0, 3, 7, 10] },
      { maximum: 5, scores: [0, 1, 1.5, 2, 2.5, 3, 3.5, 4.5, 5] },
      { maximum: 5, scores: [0, 3, 5] },
      { maximum: 5, scores: [0, 1, 2, 2.5, 3, 3.5, 4, 4.5, 5] },
    ],
    totalCaps: [70, 75, 80],
    coachWordShareCap: { threshold: 0.7, maximum: 80 },
  },
  coaching: {
    dimensions: [
      { maximum: 10, scores: [0, 3, 7, 10] },
      { maximum: 10, scores: [0, 3, 7, 10], optional: true },
      { maximum: 15, scores: [0, 5, 10, 15], caps: [10] },
      { maximum: 15, scores: [0, 5, 10, 15], optional: true },
      { maximum: 10, scores: [0, 3, 7, 10] },
      { maximum: 15, scores: [0, 5, 10, 15], caps: [10] },
      { maximum: 5, scores: [0, 3, 5] },
      { maximum: 5, scores: [0, 3, 5], caps: [0] },
      { maximum: 5, scores: [0, 3, 5] },
      { maximum: 5, scores: [0, 5], caps: [0] },
      { maximum: 5, scores: [0, 3, 5] },
      { maximum: 5, scores: [0, 3, 5] },
    ],
    totalCaps: [70, 75],
    coachWordShareCap: { threshold: 0.75, maximum: 75 },
  },
};
