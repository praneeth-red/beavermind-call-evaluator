import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CallType, EvaluationResult } from "./types";
import { evaluationCandidateSchema } from "./evaluation-schema";
import { gradeFor, normalizeScore, validateEvaluation } from "./validate-evaluation";
import { parseTranscript } from "./transcript";

const KICKOFF_MAXIMA = [10, 10, 5, 15, 10, 10, 5, 10, 10, 5, 5, 5];
const COACHING_MAXIMA = [10, 10, 15, 15, 10, 15, 5, 5, 5, 5, 5, 5];
const BASE_TRANSCRIPT =
  "[Coach]: Coach says alpha\n[Client]: Client says beta gamma\n[Coach]: Coach confirms delta\n[Coach]: Coach closes epsilon";

function candidateFor(callType: CallType, quote = "Coach says alpha"): EvaluationResult {
  const maxima = callType === "kickoff" ? KICKOFF_MAXIMA : COACHING_MAXIMA;
  const coaching = callType === "coaching";

  return {
    coachSpeaker: "Coach",
    scoringSignals: {
      diagnosticsApplicable: {
        value: coaching,
        reasoning: coaching ? "Diagnostics were reviewed." : "Not used for kickoff calls.",
        evidence: coaching ? [{ turn: 1, quote }] : [],
      },
      movementCoachingOccurred: {
        value: coaching,
        reasoning: coaching ? "Movement coaching occurred." : "Not used for kickoff calls.",
        evidence: coaching ? [{ turn: 1, quote }] : [],
      },
      nextCallBookedLive: {
        value: coaching,
        reasoning: coaching ? "The next call was booked live." : "Not used for kickoff calls.",
        evidence: coaching
          ? [
              { criterion: "link", turn: 1, quote },
              { criterion: "action", turn: 2, quote: "Client says beta gamma" },
              { criterion: "confirmation", turn: 3, quote: "Coach confirms delta" },
            ]
          : [],
      },
      followUpQuestionsAsked: {
        value: !coaching,
        reasoning: coaching ? "Not used for coaching calls." : "A follow-up question was asked.",
        evidence: coaching ? [] : [{ turn: 1, quote }],
      },
      unresolvedClientConfusion: {
        value: false,
        reasoning: "No unresolved confusion was observed.",
        evidence: [],
      },
      northStarConstructed: {
        value: !coaching,
        reasoning: coaching ? "Not used for coaching calls." : "A North Star was constructed.",
        evidence: coaching ? [] : [{ turn: 1, quote }],
      },
      structuredRecapDelivered: {
        value: !coaching,
        reasoning: coaching ? "Not used for coaching calls." : "A structured recap was delivered.",
        evidence: coaching ? [] : [{ turn: 1, quote }],
      },
      longTermVisionConnected: {
        value: coaching,
        reasoning: coaching ? "The long-term vision was connected." : "Not used for kick-off calls.",
        evidence: coaching ? [{ turn: 1, quote }] : [],
      },
      concreteAccountabilityCommitment: {
        value: coaching,
        reasoning: coaching ? "A concrete commitment was confirmed." : "Not used for kick-off calls.",
        evidence: coaching ? [{ turn: 1, quote }] : [],
      },
      clientStrugglePresent: {
        value: false,
        reasoning: "No client struggle was present.",
        evidence: [],
      },
      clientStruggleHandled: {
        value: false,
        reasoning: "No client struggle required handling.",
        evidence: [],
      },
      actionStepsStated: {
        value: coaching,
        reasoning: coaching ? "Action steps were stated." : "Not used for kick-off calls.",
        evidence: coaching ? [{ turn: 1, quote }] : [],
      },
    },
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
      score: coaching && index === 9 ? 5 : 0,
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
  it("canonicalizes model-supplied dimension names and bands from the rubric score", () => {
    const candidate = candidateFor("kickoff");
    candidate.dimensions[0] = {
      ...candidate.dimensions[0],
      name: "MODEL_CONTROLLED_NAME",
      score: 9,
      band: "MODEL_CONTROLLED_BAND",
    };

    const result = validateEvaluation("kickoff", BASE_TRANSCRIPT, candidate);

    expect(result.dimensions[0]).toMatchObject({
      name: "Pre-Call Preparation",
      score: 9,
      band: "Elite",
    });
    expect(result.grade).toBe("FAIL");
  });

  it.each([
    [
      "kickoff",
      [9, 7, 4.5, 10, 6, 7, 3, 7, 7, 2.5, 3, 4],
      ["Elite", "Strong", "Elite", "Strong", "Strong", "Strong", "Mid", "Strong", "Strong", "Mid", "Mid", "Strong"],
      ["Pre-Call Preparation", "Rapport & Tone", "Agenda Framing", "Goal Alignment & Deep Why", "Program Explanation (3 Phases)", "Journey & Expectation Setting", "Support System Clarity", "Coaching Intelligence Questions", "Next Steps & Diagnostics", "Booking Next Call", "Close, Recap & Confidence", "Post-Call Execution"],
    ],
    [
      "coaching",
      [3, 7, 10, 5, 3, 10, 3, 5, 3, 5, 3, 3],
      ["Surface", "Strong", "Strong", "Mid", "Surface", "Strong", "Mid", "Elite", "Mid", "Elite", "Mid", "Mid"],
      ["Check-In & Connection", "Diagnostics Review", "Program Focus + Vision", "Movement Coaching Quality", "Adjustments & Strategy", "Action Steps & Accountability", "Accountability Anchor", "Struggle Handling", "Close Quality", "Next Call Booking", "Continuity & Follow-Up Clarity", "Structure & Time Management"],
    ],
  ] as const)("derives all %s dimension names and bands", (callType, scores, bands, names) => {
    const candidate = candidateFor(callType);
    candidate.dimensions.forEach((dimension, index) => {
      dimension.name = "MODEL_NAME";
      dimension.band = "MODEL_BAND";
      dimension.score = scores[index];
    });

    const result = validateEvaluation(callType, BASE_TRANSCRIPT, candidate);

    expect(result.dimensions.map(({ name }) => name)).toEqual(names);
    expect(result.dimensions.map(({ band }) => band)).toEqual(bands);
  });

  it("derives every kickoff cap from evidence-backed signals and ignores model cap arrays", () => {
    const candidate = candidateFor("kickoff");
    Object.assign(candidate.scoringSignals, {
      followUpQuestionsAsked: {
        value: false,
        reasoning: "No follow-up question was observed.",
        evidence: [],
      },
      unresolvedClientConfusion: {
        value: true,
        reasoning: "The client remained confused.",
        evidence: [{ turn: 2, quote: "Client says beta gamma" }],
      },
      northStarConstructed: {
        value: false,
        reasoning: "No North Star was constructed.",
        evidence: [],
      },
      structuredRecapDelivered: {
        value: false,
        reasoning: "No structured recap was delivered.",
        evidence: [],
      },
      longTermVisionConnected: { value: false, reasoning: "Not used.", evidence: [] },
      concreteAccountabilityCommitment: { value: false, reasoning: "Not used.", evidence: [] },
      clientStrugglePresent: { value: false, reasoning: "Not used.", evidence: [] },
      clientStruggleHandled: { value: false, reasoning: "Not used.", evidence: [] },
      actionStepsStated: { value: false, reasoning: "Not used.", evidence: [] },
    });
    candidate.dimensions.forEach((dimension, index) => {
      dimension.score = KICKOFF_MAXIMA[index];
    });
    candidate.appliedDimensionCaps = [
      { dimension: 4, maximum: 10, reason: "MODEL_INVENTED_DIMENSION_CAP" },
    ];
    candidate.appliedTotalCaps = [
      { maximum: 80, reason: "MODEL_INVENTED_TOTAL_CAP" },
    ];

    const result = validateEvaluation("kickoff", BASE_TRANSCRIPT, candidate);

    expect(result.appliedDimensionCaps).toEqual([
      { dimension: 4, maximum: 10, reason: "No North Star statement was constructed." },
      { dimension: 11, maximum: 3, reason: "No structured recap was delivered." },
    ]);
    expect(result.appliedTotalCaps).toEqual([
      { maximum: 70, reason: "No follow-up questions were asked." },
      { maximum: 75, reason: "The client showed unresolved confusion." },
    ]);
    expect(result.dimensions[3]).toMatchObject({ score: 10, band: "Strong" });
    expect(result.dimensions[10]).toMatchObject({ score: 3, band: "Mid" });
  });

  it("derives every coaching cap from evidence-backed signals and ignores model cap arrays", () => {
    const candidate = candidateFor("coaching");
    Object.assign(candidate.scoringSignals, {
      followUpQuestionsAsked: { value: false, reasoning: "Not used.", evidence: [] },
      unresolvedClientConfusion: { value: false, reasoning: "Not used.", evidence: [] },
      northStarConstructed: { value: false, reasoning: "Not used.", evidence: [] },
      structuredRecapDelivered: { value: false, reasoning: "Not used.", evidence: [] },
      longTermVisionConnected: {
        value: false,
        reasoning: "No long-term vision connection was observed.",
        evidence: [],
      },
      concreteAccountabilityCommitment: {
        value: false,
        reasoning: "No concrete client-owned commitment was observed.",
        evidence: [],
      },
      clientStrugglePresent: {
        value: true,
        reasoning: "The client described a struggle.",
        evidence: [{ turn: 2, quote: "Client says beta gamma" }],
      },
      clientStruggleHandled: {
        value: false,
        reasoning: "The struggle was not handled.",
        evidence: [],
      },
      actionStepsStated: {
        value: false,
        reasoning: "No action steps were stated.",
        evidence: [],
      },
    });
    candidate.scoringSignals.nextCallBookedLive.value = false;
    candidate.scoringSignals.nextCallBookedLive.evidence = [];
    candidate.dimensions.forEach((dimension, index) => {
      dimension.score = COACHING_MAXIMA[index];
    });
    candidate.appliedDimensionCaps = [
      { dimension: 4, maximum: 0, reason: "MODEL_INVENTED_DIMENSION_CAP" },
    ];
    candidate.appliedTotalCaps = [
      { maximum: 75, reason: "MODEL_INVENTED_TOTAL_CAP" },
    ];

    const result = validateEvaluation("coaching", BASE_TRANSCRIPT, candidate);

    expect(result.appliedDimensionCaps).toEqual([
      { dimension: 10, maximum: 0, reason: "Next call was not booked live." },
      { dimension: 3, maximum: 10, reason: "No long-term vision connection was made." },
      { dimension: 6, maximum: 10, reason: "No concrete client-owned accountability commitment was confirmed." },
      { dimension: 8, maximum: 0, reason: "A client struggle was present but ignored or avoided." },
    ]);
    expect(result.appliedTotalCaps).toEqual([
      { maximum: 70, reason: "No action steps were stated for either party." },
    ]);
    expect(result.dimensions[2]).toMatchObject({ score: 10, band: "Strong" });
    expect(result.dimensions[5]).toMatchObject({ score: 10, band: "Strong" });
    expect(result.dimensions[7]).toMatchObject({ score: 0, band: "Fail" });
    expect(result.dimensions[9]).toMatchObject({ score: 0, band: "Fail" });
  });

  it("accepts explicit coach identity and scoring signals", () => {
    const candidate = {
      ...candidateFor("coaching"),
      coachSpeaker: "Coach",
      scoringSignals: {
        ...candidateFor("coaching").scoringSignals,
        diagnosticsApplicable: {
          value: true,
          reasoning: "Diagnostics were reviewed.",
          evidence: [{ turn: 1, quote: "Coach says alpha" }],
        },
        movementCoachingOccurred: {
          value: true,
          reasoning: "Movement coaching occurred.",
          evidence: [{ turn: 1, quote: "Coach says alpha" }],
        },
        nextCallBookedLive: {
          value: true,
          reasoning: "The link, booking action, and confirmation were observed.",
          evidence: [
            { criterion: "link", turn: 1, quote: "Coach says alpha" },
            { criterion: "action", turn: 2, quote: "Client says beta gamma" },
            { criterion: "confirmation", turn: 3, quote: "Coach confirms delta" },
          ],
        },
      },
    };

    expect(evaluationCandidateSchema.safeParse(candidate).success).toBe(true);
  });

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
    candidate.scoringSignals.diagnosticsApplicable.value = false;
    candidate.scoringSignals.diagnosticsApplicable.evidence = [];
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
    candidate.scoringSignals.diagnosticsApplicable.value = false;
    candidate.scoringSignals.diagnosticsApplicable.evidence = [];
    candidate.scoringSignals.movementCoachingOccurred.value = false;
    candidate.scoringSignals.movementCoachingOccurred.evidence = [];
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
    candidate.scoringSignals.longTermVisionConnected.value = false;
    candidate.scoringSignals.longTermVisionConnected.evidence = [];
    candidate.scoringSignals.actionStepsStated.value = false;
    candidate.scoringSignals.actionStepsStated.evidence = [];

    const result = validateEvaluation("coaching", BASE_TRANSCRIPT, candidate);

    expect(result.dimensions[2].score).toBe(10);
    expect(result.rawScore).toBe(100);
    expect(result.normalizedScore).toBe(70);
    expect(result.grade).toBe("INCONSISTENT");
  });

  it("rejects a coach speaker that is absent from the transcript", () => {
    const candidate = candidateFor("kickoff");
    candidate.coachSpeaker = "Unknown Coach";

    expect(() => validateEvaluation("kickoff", BASE_TRANSCRIPT, candidate)).toThrow(/coach speaker/i);
  });

  it("uses the explicit coach speaker for a client-first transcript", () => {
    const transcript = "[Client]: one two three four five six seven eight\n[Coach]: nine ten";
    const candidate = candidateFor("kickoff", "one two three");
    candidate.dimensions.forEach((dimension, index) => {
      dimension.score = KICKOFF_MAXIMA[index];
      dimension.evidence = [{ turn: 1, quote: "one two three" }];
    });
    candidate.redFlags[0].evidence = [{ turn: 1, quote: "one two three" }];

    const result = validateEvaluation("kickoff", transcript, candidate);

    expect(result.normalizedScore).toBe(100);
    expect(result.appliedTotalCaps).not.toContainEqual(expect.objectContaining({ maximum: 80 }));
    expect(result.assumptions).toContainEqual(expect.stringMatching(/coach speaker.*word share.*estimate/i));
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
    if (callType === "coaching") {
      candidate.scoringSignals.nextCallBookedLive.value = false;
      candidate.scoringSignals.nextCallBookedLive.evidence = [];
    }

    const result = validateEvaluation(callType, transcript, candidate);

    expect(result.normalizedScore).toBe(expectedCap);
    expect(result.appliedTotalCaps).toContainEqual(
      expect.objectContaining({ maximum: expectedCap, reason: expect.stringMatching(/estimated.*word share/i) }),
    );
    expect(result.assumptions).toContainEqual(expect.stringMatching(/word share.*estimate/i));
  });

  it("rejects coaching-01's positive booking judgment without complete booking evidence", () => {
    const transcript = fixture("coaching-01.txt");
    const candidate = candidateFor("coaching", "Hey Malik, can you hear me okay?");
    candidate.coachSpeaker = "Priya Raman";
    candidate.scoringSignals.nextCallBookedLive.evidence = [
      { criterion: "link", turn: 185, quote: "Let's just lock it in right now" },
      { criterion: "action", turn: 188, quote: "Let's lock that in" },
    ];
    candidate.dimensions[9].score = 5;

    expect(() => validateEvaluation("coaching", transcript, candidate)).toThrow(/live booking.*evidence/i);
  });

  it("uses coaching-02 signals for inactivity and accepts its complete live-booking evidence", () => {
    const transcript = fixture("coaching-02.txt");
    const candidate = candidateFor("coaching", "Hannah, hey, there she is. Can you hear me alright?");
    candidate.coachSpeaker = "Marcus Reid";
    candidate.scoringSignals.diagnosticsApplicable.value = false;
    candidate.scoringSignals.diagnosticsApplicable.evidence = [];
    candidate.scoringSignals.movementCoachingOccurred.value = false;
    candidate.scoringSignals.movementCoachingOccurred.evidence = [];
    candidate.scoringSignals.nextCallBookedLive.evidence = [
      { criterion: "link", turn: 309, quote: "I'm going to drop my booking link in the chat right now" },
      { criterion: "action", turn: 314, quote: "booking it now... there, done, it's booked" },
      { criterion: "confirmation", turn: 315, quote: "I see it come through" },
    ];

    expect(() => validateEvaluation("coaching", transcript, candidate)).toThrow(/scoring signal.*dimension 2/i);

    candidate.dimensions[1] = {
      ...candidate.dimensions[1],
      active: false,
      score: null,
      band: "N/A",
      evidence: [],
    };
    expect(() => validateEvaluation("coaching", transcript, candidate)).toThrow(/scoring signal.*dimension 4/i);

    candidate.dimensions[3] = {
      ...candidate.dimensions[3],
      active: false,
      score: null,
      band: "N/A",
      evidence: [],
    };
    const result = validateEvaluation("coaching", transcript, candidate);
    expect(result.dimensions[1]).toMatchObject({ active: false, score: null, maximum: 0 });
    expect(result.dimensions[3]).toMatchObject({ active: false, score: null, maximum: 0 });
    expect(result.dimensions[9].score).toBe(5);
  });

  it("rejects inactive dimensions and ignores model caps that contradict positive signals", () => {
    const inactiveDiagnostics = candidateFor("coaching");
    inactiveDiagnostics.dimensions[1] = {
      ...inactiveDiagnostics.dimensions[1],
      active: false,
      score: null,
      band: "N/A",
      evidence: [],
    };
    expect(() => validateEvaluation("coaching", BASE_TRANSCRIPT, inactiveDiagnostics)).toThrow(
      /scoring signal.*dimension 2/i,
    );

    const contradictoryBookingCap = candidateFor("coaching");
    contradictoryBookingCap.appliedDimensionCaps = [
      { dimension: 10, maximum: 0, reason: "Next call was not booked live." },
    ];
    const result = validateEvaluation("coaching", BASE_TRANSCRIPT, contradictoryBookingCap);
    expect(result.dimensions[9].score).toBe(5);
    expect(result.appliedDimensionCaps).not.toContainEqual(
      expect.objectContaining({ dimension: 10, maximum: 0 }),
    );
  });

  it("requires exact evidence for positive diagnostics and movement signals", () => {
    const diagnostics = candidateFor("coaching");
    diagnostics.scoringSignals.diagnosticsApplicable.evidence = [];
    expect(() => validateEvaluation("coaching", BASE_TRANSCRIPT, diagnostics)).toThrow(
      /diagnostics.*evidence/i,
    );

    const movement = candidateFor("coaching");
    movement.scoringSignals.movementCoachingOccurred.evidence = [
      { turn: 1, quote: "Invented movement evidence" },
    ];
    expect(() => validateEvaluation("coaching", BASE_TRANSCRIPT, movement)).toThrow(
      /evidence.*turn 1/i,
    );
  });

  it("requires three distinct live-booking turns across coach and client", () => {
    const repeatedTurn = candidateFor("coaching");
    repeatedTurn.scoringSignals.nextCallBookedLive.evidence = [
      { criterion: "link", turn: 1, quote: "Coach says alpha" },
      { criterion: "action", turn: 1, quote: "Coach says alpha" },
      { criterion: "confirmation", turn: 3, quote: "Coach confirms delta" },
    ];
    expect(() => validateEvaluation("coaching", BASE_TRANSCRIPT, repeatedTurn)).toThrow(/three distinct/i);

    const coachOnly = candidateFor("coaching");
    coachOnly.scoringSignals.nextCallBookedLive.evidence = [
      { criterion: "link", turn: 1, quote: "Coach says alpha" },
      { criterion: "action", turn: 3, quote: "Coach confirms delta" },
      { criterion: "confirmation", turn: 4, quote: "Coach closes epsilon" },
    ];
    expect(() => validateEvaluation("coaching", BASE_TRANSCRIPT, coachOnly)).toThrow(/coach and client/i);

    const paddedDuplicate = candidateFor("coaching");
    paddedDuplicate.scoringSignals.nextCallBookedLive.evidence = [
      { criterion: "link", turn: 1, quote: "Coach says alpha" },
      { criterion: "action", turn: 1, quote: "Coach says alpha" },
      { criterion: "confirmation", turn: 3, quote: "Coach confirms delta" },
      { criterion: "link", turn: 2, quote: "Client says beta gamma" },
    ];
    expect(() => validateEvaluation("coaching", BASE_TRANSCRIPT, paddedDuplicate)).toThrow(/exactly one/i);
  });

  it("rejects a positive live-booking signal when coaching D10 is zero", () => {
    const candidate = candidateFor("coaching");
    candidate.dimensions[9].score = 0;

    expect(() => validateEvaluation("coaching", BASE_TRANSCRIPT, candidate)).toThrow(
      /live booking.*dimension 10/i,
    );
  });

  it("derives coaching D10 score and cap from a false live-booking signal", () => {
    const candidate = candidateFor("coaching");
    candidate.scoringSignals.nextCallBookedLive.value = false;
    candidate.scoringSignals.nextCallBookedLive.evidence = [];
    candidate.dimensions[9].score = 5;

    const result = validateEvaluation("coaching", BASE_TRANSCRIPT, candidate);

    expect(result.dimensions[9].score).toBe(0);
    expect(result.appliedDimensionCaps).toContainEqual(
      expect.objectContaining({ dimension: 10, maximum: 0 }),
    );
  });
});
