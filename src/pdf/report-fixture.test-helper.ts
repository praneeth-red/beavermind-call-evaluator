import type { EvaluationResult } from "../domain/types";

export function sampleResult(): EvaluationResult {
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
      followUpQuestionsAsked: { value: false, reasoning: "Not used in this PDF fixture.", evidence: [] },
      unresolvedClientConfusion: { value: false, reasoning: "Not used in this PDF fixture.", evidence: [] },
      northStarConstructed: { value: false, reasoning: "Not used in this PDF fixture.", evidence: [] },
      structuredRecapDelivered: { value: false, reasoning: "Not used in this PDF fixture.", evidence: [] },
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
    brief: "The call was focused and the next commitment stayed vague.",
    redFlags: [
      {
        risk: "The next call is not secured.",
        explanation: "Momentum may be lost after the session.",
        evidence: [{ turn: 8, quote: "Send me the link later." }],
      },
    ],
    rawScore: 76,
    activeMaximum: 100,
    normalizedScore: 76,
    grade: "INCONSISTENT",
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
