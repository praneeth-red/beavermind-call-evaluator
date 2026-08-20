import { z } from "zod";

export const evidenceSchema = z
  .object({
    turn: z.number().int().positive(),
    quote: z.string().min(1),
  })
  .strict();

const dimensionSchema = z
  .object({
    dimension: z.number().int(),
    name: z.string().min(1),
    score: z.number().finite().nullable(),
    maximum: z.number().finite().nonnegative(),
    active: z.boolean(),
    band: z.string().min(1),
    reasoning: z.string().min(1),
    evidence: z.array(evidenceSchema),
    missingBehavior: z.string().min(1),
    quickFix: z.string().min(1),
  })
  .strict();

const dimensionCapSchema = z
  .object({
    dimension: z.number().int(),
    maximum: z.number().finite().nonnegative(),
    reason: z.string().min(1),
  })
  .strict();

const totalCapSchema = z
  .object({
    maximum: z.number().finite().nonnegative(),
    reason: z.string().min(1),
  })
  .strict();

const scoringSignalSchema = z
  .object({
    value: z.boolean(),
    reasoning: z.string().min(1),
    evidence: z.array(evidenceSchema),
  })
  .strict();

const bookingEvidenceSchema = evidenceSchema.extend({
  criterion: z.enum(["link", "action", "confirmation"]),
});

const liveBookingSignalSchema = z
  .object({
    value: z.boolean(),
    reasoning: z.string().min(1),
    evidence: z.array(bookingEvidenceSchema),
  })
  .strict();

export const evaluationCandidateSchema = z
  .object({
    coachSpeaker: z.string().min(1),
    scoringSignals: z
      .object({
        diagnosticsApplicable: scoringSignalSchema,
        movementCoachingOccurred: scoringSignalSchema,
        nextCallBookedLive: liveBookingSignalSchema,
      })
      .strict(),
    oneThing: z
      .object({
        improvement: z.string().min(1),
        explanation: z.string().min(1),
        projectedScore: z.number().finite().min(0).max(100),
      })
      .strict(),
    brief: z.string().min(1),
    redFlags: z.array(
      z
        .object({
          risk: z.string().min(1),
          explanation: z.string().min(1),
          evidence: z.array(evidenceSchema).min(1),
        })
        .strict(),
    ),
    rawScore: z.number().finite(),
    activeMaximum: z.number().finite(),
    normalizedScore: z.number().finite(),
    grade: z.enum(["ELITE", "STRONG", "INCONSISTENT", "AT RISK", "FAIL"]),
    dimensions: z.array(dimensionSchema),
    appliedDimensionCaps: z.array(dimensionCapSchema),
    appliedTotalCaps: z.array(totalCapSchema),
    assumptions: z.array(z.string().min(1)),
  })
  .strict();

export type EvaluationCandidate = z.infer<typeof evaluationCandidateSchema>;
