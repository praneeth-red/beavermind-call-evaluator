import { modelEvaluationCandidateSchema } from "./evaluation-schema";
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

function exactEvidenceQuote(turns: TranscriptTurn[], turn: number, quote: string) {
  const turnText = turns[turn - 1]?.text;
  if (!turnText) throw new Error(`Evidence references missing transcript turn ${turn}.`);
  if (turnText.includes(quote)) return quote;

  const words = (value: string) => [...value.matchAll(/[\p{L}\p{N}]+/gu)];
  const quoteWords = words(quote);
  const turnWords = words(turnText);
  const fuzzy = quoteWords.length >= 6 && quoteWords.length <= 80;
  const allowedMismatches = fuzzy ? (quoteWords.length >= 10 ? 2 : 1) : 0;
  let bestStart = -1;
  let bestMismatches = allowedMismatches + 1;
  for (let start = 0; start <= turnWords.length - quoteWords.length; start += 1) {
    let mismatches = 0;
    for (let index = 0; index < quoteWords.length; index += 1) {
      if (
        quoteWords[index][0].toLocaleLowerCase() !==
        turnWords[start + index][0].toLocaleLowerCase()
      ) {
        mismatches += 1;
        if (mismatches > allowedMismatches) break;
      }
    }
    if (mismatches < bestMismatches) [bestStart, bestMismatches] = [start, mismatches];
  }
  if (bestStart >= 0 && bestMismatches <= allowedMismatches) {
    const first = turnWords[bestStart];
    const last = turnWords[bestStart + quoteWords.length - 1];
    return turnText.slice(first.index, last.index! + last[0].length);
  }

  return turnText;
}

function assertSignalEvidence(turns: TranscriptTurn[], evidence: Array<{ turn: number; quote: string }>) {
  for (const item of evidence) item.quote = exactEvidenceQuote(turns, item.turn, item.quote);
}

function assertPositiveSignal(
  turns: TranscriptTurn[],
  label: string,
  signal: { value: boolean; evidence: Array<{ turn: number; quote: string }> },
) {
  if (signal.value && signal.evidence.length === 0) {
    throw new Error(`${label} scoring signal requires evidence.`);
  }
  assertSignalEvidence(turns, signal.evidence);
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function validateEvaluation(callType: CallType, transcript: string, input: unknown): EvaluationResult {
  const candidate = modelEvaluationCandidateSchema.parse(input);
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

  const signals = candidate.scoringSignals;
  const evidenceBackedSignals = [
    ["Diagnostics", signals.diagnosticsApplicable],
    ["Movement", signals.movementCoachingOccurred],
    ["Follow-up questions", signals.followUpQuestionsAsked],
    ["Unresolved confusion", signals.unresolvedClientConfusion],
    ["North Star", signals.northStarConstructed],
    ["Structured recap", signals.structuredRecapDelivered],
    ["Long-term vision", signals.longTermVisionConnected],
    ["Accountability commitment", signals.concreteAccountabilityCommitment],
    ["Client struggle present", signals.clientStrugglePresent],
    ["Client struggle handled", signals.clientStruggleHandled],
    ["Action steps", signals.actionStepsStated],
  ] as const;
  for (const [label, signal] of evidenceBackedSignals) {
    assertPositiveSignal(turns, label, signal);
  }
  assertSignalEvidence(turns, signals.nextCallBookedLive.evidence);
  if (signals.clientStruggleHandled.value && !signals.clientStrugglePresent.value) {
    throw new Error("A handled client struggle requires a present client struggle.");
  }

  if (callType === "coaching") {
    const diagnostics = signals.diagnosticsApplicable;
    const movement = signals.movementCoachingOccurred;
    const liveBooking = signals.nextCallBookedLive;
    const activeSignals = [
      { dimension: 2, active: diagnostics.value },
      { dimension: 4, active: movement.value },
    ];
    for (const signal of activeSignals) {
      if (dimensions[signal.dimension - 1].active !== signal.active) {
        throw new Error(`Scoring signal contradicts dimension ${signal.dimension} active state.`);
      }
    }

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
    }
  }

  for (const redFlag of candidate.redFlags) {
    for (const evidence of redFlag.evidence) {
      evidence.quote = exactEvidenceQuote(turns, evidence.turn, evidence.quote);
    }
  }

  const appliedDimensionCaps: EvaluationResult["appliedDimensionCaps"] = [];
  const appliedTotalCaps: EvaluationResult["appliedTotalCaps"] = [];
  if (callType === "kickoff") {
    if (!signals.northStarConstructed.value) {
      appliedDimensionCaps.push({
        dimension: 4,
        maximum: 10,
        reason: "No North Star statement was constructed.",
      });
    }
    if (!signals.structuredRecapDelivered.value) {
      appliedDimensionCaps.push({
        dimension: 11,
        maximum: 3,
        reason: "No structured recap was delivered.",
      });
    }
    if (!signals.followUpQuestionsAsked.value) {
      appliedTotalCaps.push({
        maximum: 70,
        reason: "No follow-up questions were asked.",
      });
    }
    if (signals.unresolvedClientConfusion.value) {
      appliedTotalCaps.push({
        maximum: 75,
        reason: "The client showed unresolved confusion.",
      });
    }
  } else {
    if (!signals.nextCallBookedLive.value) {
      appliedDimensionCaps.push({
        dimension: 10,
        maximum: 0,
        reason: "Next call was not booked live.",
      });
    }
    if (!signals.longTermVisionConnected.value) {
      appliedDimensionCaps.push({
        dimension: 3,
        maximum: 10,
        reason: "No long-term vision connection was made.",
      });
    }
    if (!signals.concreteAccountabilityCommitment.value) {
      appliedDimensionCaps.push({
        dimension: 6,
        maximum: 10,
        reason: "No concrete client-owned accountability commitment was confirmed.",
      });
    }
    if (signals.clientStrugglePresent.value && !signals.clientStruggleHandled.value) {
      appliedDimensionCaps.push({
        dimension: 8,
        maximum: 0,
        reason: "A client struggle was present but ignored or avoided.",
      });
    }
    if (!signals.actionStepsStated.value) {
      appliedTotalCaps.push({
        maximum: 70,
        reason: "No action steps were stated for either party.",
      });
    }
  }

  const capsByDimension = new Map<number, number>();
  for (const cap of appliedDimensionCaps) {
    const allowedCaps = config.dimensions[cap.dimension - 1]?.caps;
    if (!allowedCaps?.includes(cap.maximum)) throw new Error(`Invalid cap for dimension ${cap.dimension}.`);
    capsByDimension.set(cap.dimension, Math.min(capsByDimension.get(cap.dimension) ?? Infinity, cap.maximum));
  }

  const validatedDimensions = dimensions.map((dimension, index) => {
    const rule = config.dimensions[index];
    for (const evidence of dimension.evidence) {
      evidence.quote = exactEvidenceQuote(turns, evidence.turn, evidence.quote);
    }
    if (!dimension.active) {
      if (!rule.optional) throw new Error(`Dimension ${dimension.dimension} cannot be inactive.`);
      if (dimension.score !== null) {
        throw new Error(`Inactive dimension ${dimension.dimension} must have score null.`);
      }
      return { ...dimension, name: rule.name, maximum: 0, band: "N/A" };
    }

    if (dimension.score === null || !rule.scores.includes(dimension.score)) {
      throw new Error(`Dimension ${dimension.dimension} does not use a legal score.`);
    }
    if (dimension.score > 0 && dimension.evidence.length === 0) {
      throw new Error(`Dimension ${dimension.dimension} requires transcript evidence.`);
    }

    const score = Math.min(
      dimension.score,
      capsByDimension.get(dimension.dimension) ?? dimension.score,
    );
    const band = rule.bands.find((ruleBand) => ruleBand.scores.includes(score))?.band;
    if (!band) throw new Error(`Dimension ${dimension.dimension} has no rubric band.`);

    return {
      ...dimension,
      name: rule.name,
      score,
      maximum: rule.maximum,
      band,
    };
  });

  const rawScore = validatedDimensions.reduce((sum, dimension) => sum + (dimension.score ?? 0), 0);
  const activeMaximum = validatedDimensions.reduce((sum, dimension) => sum + dimension.maximum, 0);
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
