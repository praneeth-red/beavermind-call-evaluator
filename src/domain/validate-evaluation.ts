import { evaluationCandidateSchema } from "./evaluation-schema";
import { rubricConfigs } from "./rubric-config";
import { parseTranscript } from "./transcript";
import type { CallType, EvaluationResult, TranscriptTurn } from "./types";

const WORD_SHARE_ASSUMPTION =
  "The model-identified coach speaker is measured by word share as a talk-time estimate because transcripts have no timestamps.";

export function normalizeScore(raw: number, activeMaximum: number): number {
  if (!Number.isFinite(raw) || !Number.isFinite(activeMaximum) || raw < 0 || activeMaximum <= 0 || raw > activeMaximum) {
    throw new Error("Cannot normalize an invalid score or active maximum.");
  }
  return Math.round((raw / activeMaximum) * 100);
}

export function gradeFor(score: number): EvaluationResult["grade"] {
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error("Grade score must be between 0 and 100.");
  if (score >= 90) return "ELITE";
  if (score >= 80) return "STRONG";
  if (score >= 70) return "INCONSISTENT";
  if (score >= 60) return "AT RISK";
  return "FAIL";
}

function assertEvidence(turns: TranscriptTurn[], turn: number, quote: string) {
  if (!turns[turn - 1]?.text.includes(quote)) {
    throw new Error(`Evidence quote does not match transcript turn ${turn}.`);
  }
}

function assertSignalEvidence(turns: TranscriptTurn[], evidence: Array<{ turn: number; quote: string }>) {
  for (const item of evidence) assertEvidence(turns, item.turn, item.quote);
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function validateEvaluation(callType: CallType, transcript: string, input: unknown): EvaluationResult {
  const candidate = evaluationCandidateSchema.parse(input);
  const config = rubricConfigs[callType];
  const turns = parseTranscript(transcript);
  if (turns.length === 0) throw new Error("Transcript must contain at least one speaking turn.");
  if (!turns.some((turn) => turn.speaker === candidate.coachSpeaker)) {
    throw new Error("Coach speaker must match a parsed transcript speaker.");
  }

  if (candidate.dimensions.length !== 12) throw new Error("Evaluation must contain exactly 12 dimensions.");
  const dimensions = [...candidate.dimensions].sort((left, right) => left.dimension - right.dimension);
  if (dimensions.some((dimension, index) => dimension.dimension !== index + 1)) {
    throw new Error("Evaluation must contain dimensions 1 through 12 exactly once.");
  }

  if (callType === "coaching") {
    const diagnostics = candidate.scoringSignals.diagnosticsApplicable;
    const movement = candidate.scoringSignals.movementCoachingOccurred;
    const liveBooking = candidate.scoringSignals.nextCallBookedLive;
    const activeSignals = [
      { dimension: 2, active: diagnostics.value },
      { dimension: 4, active: movement.value },
    ];
    for (const signal of activeSignals) {
      if (dimensions[signal.dimension - 1].active !== signal.active) {
        throw new Error(`Scoring signal contradicts dimension ${signal.dimension} active state.`);
      }
    }

    if (diagnostics.value && diagnostics.evidence.length === 0) {
      throw new Error("Diagnostics scoring signal requires evidence.");
    }
    if (movement.value && movement.evidence.length === 0) {
      throw new Error("Movement scoring signal requires evidence.");
    }
    assertSignalEvidence(turns, diagnostics.evidence);
    assertSignalEvidence(turns, movement.evidence);
    assertSignalEvidence(turns, liveBooking.evidence);

    if (liveBooking.value) {
      const criteria = new Set(liveBooking.evidence.map((evidence) => evidence.criterion));
      if (liveBooking.evidence.length !== 3 || criteria.size !== 3) {
        throw new Error("Live booking evidence must include exactly one link, action, and confirmation turn.");
      }
      if (new Set(liveBooking.evidence.map((evidence) => evidence.turn)).size < 3) {
        throw new Error("Live booking evidence must use three distinct turns.");
      }
      const speakers = new Set(liveBooking.evidence.map((evidence) => turns[evidence.turn - 1].speaker));
      if (!speakers.has(candidate.coachSpeaker) || ![...speakers].some((speaker) => speaker !== candidate.coachSpeaker)) {
        throw new Error("Live booking evidence must include coach and client turns.");
      }
      if (dimensions[9].score !== 5) {
        throw new Error("Live booking scoring signal requires dimension 10 score 5.");
      }
      if (candidate.appliedDimensionCaps.some((cap) => cap.dimension === 10 && cap.maximum === 0)) {
        throw new Error("Scoring signal contradicts dimension 10 cap.");
      }
    }
  }

  for (const redFlag of candidate.redFlags) {
    for (const evidence of redFlag.evidence) assertEvidence(turns, evidence.turn, evidence.quote);
  }

  const appliedDimensionCaps = [...candidate.appliedDimensionCaps];
  if (
    callType === "coaching" &&
    !candidate.scoringSignals.nextCallBookedLive.value &&
    !appliedDimensionCaps.some((cap) => cap.dimension === 10 && cap.maximum === 0)
  ) {
    appliedDimensionCaps.push({
      dimension: 10,
      maximum: 0,
      reason: "Next call was not booked live.",
    });
  }

  const capsByDimension = new Map<number, number>();
  for (const cap of appliedDimensionCaps) {
    const allowedCaps = config.dimensions[cap.dimension - 1]?.caps;
    if (!allowedCaps?.includes(cap.maximum)) throw new Error(`Invalid cap for dimension ${cap.dimension}.`);
    capsByDimension.set(cap.dimension, Math.min(capsByDimension.get(cap.dimension) ?? Infinity, cap.maximum));
  }

  const validatedDimensions = dimensions.map((dimension, index) => {
    const rule = config.dimensions[index];
    for (const evidence of dimension.evidence) assertEvidence(turns, evidence.turn, evidence.quote);
    if (!dimension.active) {
      if (!rule.optional) throw new Error(`Dimension ${dimension.dimension} cannot be inactive.`);
      if (dimension.score !== null || dimension.band !== "N/A") {
        throw new Error(`Inactive dimension ${dimension.dimension} must have score null and band N/A.`);
      }
      return { ...dimension, maximum: 0 };
    }

    if (dimension.score === null || !rule.scores.includes(dimension.score)) {
      throw new Error(`Dimension ${dimension.dimension} does not use a legal score.`);
    }
    if (dimension.band === "N/A") throw new Error(`Active dimension ${dimension.dimension} cannot use band N/A.`);
    if (dimension.score > 0 && dimension.evidence.length === 0) {
      throw new Error(`Dimension ${dimension.dimension} requires transcript evidence.`);
    }

    return {
      ...dimension,
      score: Math.min(dimension.score, capsByDimension.get(dimension.dimension) ?? dimension.score),
      maximum: rule.maximum,
    };
  });

  const rawScore = validatedDimensions.reduce((sum, dimension) => sum + (dimension.score ?? 0), 0);
  const activeMaximum = validatedDimensions.reduce((sum, dimension) => sum + dimension.maximum, 0);
  const appliedTotalCaps = [...candidate.appliedTotalCaps];
  for (const cap of appliedTotalCaps) {
    if (!config.totalCaps.includes(cap.maximum)) throw new Error(`Invalid total cap ${cap.maximum}.`);
  }

  const totalWords = turns.reduce((sum, turn) => sum + wordCount(turn.text), 0);
  const coachWords = turns.reduce(
    (sum, turn) => sum + (turn.speaker === candidate.coachSpeaker ? wordCount(turn.text) : 0),
    0,
  );
  if (coachWords / totalWords > config.coachWordShareCap.threshold) {
    appliedTotalCaps.push({
      maximum: config.coachWordShareCap.maximum,
      reason: `Estimated coach word share exceeded ${config.coachWordShareCap.threshold * 100}%.`,
    });
  }

  const uncappedScore = normalizeScore(rawScore, activeMaximum);
  const normalizedScore = appliedTotalCaps.reduce(
    (score, cap) => Math.min(score, cap.maximum),
    uncappedScore,
  );
  const assumptions = [...new Set([...candidate.assumptions, WORD_SHARE_ASSUMPTION])];
  if (callType === "coaching") {
    assumptions.push("Coaching dimension maxima total 105; active raw points are normalized to 100.");
    assumptions.push("Inactive dimensions contribute neither points nor maximum points.");
  }

  return {
    ...candidate,
    rawScore,
    activeMaximum,
    normalizedScore,
    grade: gradeFor(normalizedScore),
    dimensions: validatedDimensions,
    appliedDimensionCaps,
    appliedTotalCaps,
    assumptions: [...new Set(assumptions)],
  };
}
