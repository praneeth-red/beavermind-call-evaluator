export type CallType = "kickoff" | "coaching";

export interface TranscriptTurn {
  number: number;
  speaker: string;
  text: string;
}

export interface Evidence {
  turn: number;
  quote: string;
}

export interface DimensionResult {
  dimension: number;
  name: string;
  score: number | null;
  maximum: number;
  active: boolean;
  band: string;
  reasoning: string;
  evidence: Evidence[];
  missingBehavior: string;
  quickFix: string;
}

interface ScoringSignal {
  value: boolean;
  reasoning: string;
  evidence: Evidence[];
}

export interface EvaluationResult {
  coachSpeaker: string;
  scoringSignals: {
    diagnosticsApplicable: ScoringSignal;
    movementCoachingOccurred: ScoringSignal;
    nextCallBookedLive: {
      value: boolean;
      reasoning: string;
      evidence: Array<Evidence & { criterion: "link" | "action" | "confirmation" }>;
    };
    followUpQuestionsAsked: ScoringSignal;
    unresolvedClientConfusion: ScoringSignal;
    northStarConstructed: ScoringSignal;
    structuredRecapDelivered: ScoringSignal;
    longTermVisionConnected: ScoringSignal;
    concreteAccountabilityCommitment: ScoringSignal;
    clientStrugglePresent: ScoringSignal;
    clientStruggleHandled: ScoringSignal;
    actionStepsStated: ScoringSignal;
  };
  oneThing: {
    improvement: string;
    explanation: string;
    projectedScore: number;
  };
  brief: string;
  redFlags: Array<{
    risk: string;
    explanation: string;
    evidence: Evidence[];
  }>;
  rawScore: number;
  activeMaximum: number;
  normalizedScore: number;
  grade: "ELITE" | "STRONG" | "INCONSISTENT" | "AT RISK" | "FAIL";
  dimensions: DimensionResult[];
  appliedDimensionCaps: Array<{
    dimension: number;
    maximum: number;
    reason: string;
  }>;
  appliedTotalCaps: Array<{
    maximum: number;
    reason: string;
  }>;
  assumptions: string[];
}

export interface RunRecord {
  id: string;
  callType: CallType;
  transcript: string;
  clientHash: string;
  status: "queued" | "processing" | "completed" | "failed";
  result: EvaluationResult | null;
  publicError: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}
