import "server-only";

import { generateText, Output } from "ai";

import { evaluationCandidateSchema } from "../domain/evaluation-schema";
import { rubricConfigs } from "../domain/rubric-config";
import type { CallType } from "../domain/types";
import { evaluatorTestModeEnabled } from "./test-mode";

export async function requestCandidate(
  prompt: string,
  repair?: string,
): Promise<unknown> {
  if (evaluatorTestModeEnabled()) return deterministicCandidate(prompt);

  const result = await generateText({
    model: "openai/gpt-5.6-luna",
    output: Output.object({ schema: evaluationCandidateSchema }),
    prompt: repair
      ? `${prompt}\n\nVALIDATION REPAIR\n${repair}\nReturn the full corrected object.`
      : prompt,
    reasoning: "high",
    maxOutputTokens: 32_000,
  });

  return result.output;
}

async function deterministicCandidate(prompt: string) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const transcript = prompt.split("\nNUMBERED TRANSCRIPT\n")[1] ?? "";
  const turns = [...transcript.matchAll(/^Turn (\d+) \| ([^:]+): (.+)$/gm)].map(
    ([, number, speaker, text]) => ({
      turn: Number(number),
      speaker,
      text,
    }),
  );
  const firstTurn = turns[0];
  if (!firstTurn) throw new Error("Local test transcript has no first turn");
  const callType: CallType = prompt.includes("# Coaching call")
    ? "coaching"
    : "kickoff";
  const coaching = callType === "coaching";
  const coachSpeaker = firstTurn.speaker;
  const evidence = [{ turn: firstTurn.turn, quote: firstTurn.text }];
  const findTurn = (patterns: string[]) =>
    turns.find((turn) =>
      patterns.some((pattern) => turn.text.toLowerCase().includes(pattern.toLowerCase())),
    );
  const signal = (
    matchedTurn: (typeof turns)[number] | undefined,
    presentReason: string,
    absentReason: string,
  ) => ({
    value: Boolean(matchedTurn),
    reasoning: matchedTurn ? presentReason : absentReason,
    evidence: matchedTurn
      ? [{ turn: matchedTurn.turn, quote: matchedTurn.text }]
      : [],
  });

  const diagnosticsTurn = coaching
    ? findTurn(["frame by frame"])
    : undefined;
  const movementTurn = coaching
    ? findTurn(["[stepping", "[exertion]"])
    : undefined;
  const bookingTurns = coaching
    ? {
        link: findTurn(["booking link in the chat"]),
        action: findTurn(["booking it now"]),
        confirmation: findTurn(["i see it come through"]),
      }
    : { link: undefined, action: undefined, confirmation: undefined };
  const bookingComplete = Object.values(bookingTurns).every(Boolean);
  const followUpTurn = coaching
    ? undefined
    : turns.find(
        (turn) => turn.speaker === coachSpeaker && turn.turn > 1 && turn.text.includes("?"),
      );
  const confusionTurn = coaching
    ? undefined
    : findTurn(["that makes sense i think"]);
  const northStarTurn = coaching ? undefined : findTurn(["north star"]);
  const recapTurn = coaching
    ? undefined
    : findTurn(["quick recap", "recap real quick"]);
  const longTermVisionTurn = coaching
    ? findTurn(["this block is what unlocks that", "here's where this block leads directly"])
    : undefined;
  const accountabilityTurn = coaching
    ? findTurn(["one clean step-down clip", "three sessions this week"])
    : undefined;
  const struggleTurn = coaching
    ? findTurn(["missed sessions", "the crying"])
    : undefined;
  const struggleHandledTurn = coaching
    ? findTurn(["never gonna make it a thing", "you're not behind"])
    : undefined;
  const actionStepsTurn = coaching
    ? findTurn(["one clean step-down clip", "three sessions this week"])
    : undefined;

  return {
    coachSpeaker,
    scoringSignals: {
      diagnosticsApplicable: signal(
        diagnosticsTurn,
        "The numbered transcript contains a live diagnostics review marker.",
        "The numbered transcript does not contain the local diagnostics marker.",
      ),
      movementCoachingOccurred: signal(
        movementTurn,
        "The numbered transcript contains an in-call movement marker.",
        "The numbered transcript does not contain the local movement marker.",
      ),
      nextCallBookedLive: {
        value: bookingComplete,
        reasoning: bookingComplete
          ? "The numbered transcript contains link, action, and confirmation turns."
          : "The numbered transcript does not contain all three live-booking turns.",
        evidence: bookingComplete
          ? (["link", "action", "confirmation"] as const).map((criterion) => ({
              criterion,
              turn: bookingTurns[criterion]!.turn,
              quote: bookingTurns[criterion]!.text,
            }))
          : [],
      },
      followUpQuestionsAsked: signal(
        followUpTurn,
        "A coach follow-up question is observable in the numbered transcript.",
        "No coach follow-up question is observable in the numbered transcript.",
      ),
      unresolvedClientConfusion: signal(
        confusionTurn,
        "The local fixture contains its unresolved-confusion marker.",
        "The local fixture does not contain its unresolved-confusion marker.",
      ),
      northStarConstructed: signal(
        northStarTurn,
        "A North Star statement is observable in the numbered transcript.",
        "No North Star statement is observable in the numbered transcript.",
      ),
      structuredRecapDelivered: signal(
        recapTurn,
        "A structured recap marker is observable in the numbered transcript.",
        "No structured recap marker is observable in the numbered transcript.",
      ),
      longTermVisionConnected: signal(
        longTermVisionTurn,
        "The fixture's long-term vision connection is observable.",
        "The fixture's long-term vision connection is not observable.",
      ),
      concreteAccountabilityCommitment: signal(
        accountabilityTurn,
        "The fixture's concrete accountability commitment is observable.",
        "The fixture's concrete accountability commitment is not observable.",
      ),
      clientStrugglePresent: signal(
        struggleTurn,
        "A client struggle marker is observable in the fixture.",
        "No client struggle marker is observable in the fixture.",
      ),
      clientStruggleHandled: signal(
        struggleHandledTurn,
        "A response to the client struggle is observable in the fixture.",
        "No response to a client struggle is observable in the fixture.",
      ),
      actionStepsStated: signal(
        actionStepsTurn,
        "Concrete action steps are observable in the fixture.",
        "Concrete action steps are not observable in the fixture.",
      ),
    },
    oneThing: {
      improvement: "Make the next behavior explicit.",
      explanation: "A concrete next step makes the call easier to act on.",
      projectedScore: 20,
    },
    brief: `This deterministic local result verifies ${turns.length} parsed speaking turns through the report pipeline.`,
    redFlags: [
      {
        risk: "The next behavior is not explicit.",
        explanation: "This local adapter does not judge semantic quality.",
        evidence,
      },
    ],
    rawScore: 0,
    activeMaximum: 1,
    normalizedScore: 0,
    grade: "FAIL",
    dimensions: rubricConfigs[callType].dimensions.map((rule, index) => {
      const inactive =
        coaching &&
        ((index === 1 && !diagnosticsTurn) || (index === 3 && !movementTurn));
      const liveBookingScore = coaching && index === 9 && bookingComplete ? 5 : 0;
      const score = inactive ? null : index === 0 ? 3 : liveBookingScore;
      return {
        dimension: index + 1,
        name: "Model-supplied label is not trusted.",
        score,
        maximum: rule.maximum,
        active: !inactive,
        band: inactive ? "N/A" : "Model-supplied band is not trusted.",
        reasoning:
          score && score > 0
            ? "The first speaking turn supplies deterministic local evidence."
            : "The local fixture does not demonstrate this behavior.",
        evidence:
          score && score > 0
            ? index === 9
              ? Object.values(bookingTurns)
                  .filter((turn): turn is NonNullable<typeof turn> => Boolean(turn))
                  .map((turn) => ({ turn: turn.turn, quote: turn.text }))
              : evidence
            : [],
        missingBehavior: "The behavior was not included in the local fixture.",
        quickFix: "Demonstrate the behavior in the next call.",
      };
    }),
    appliedDimensionCaps: [],
    appliedTotalCaps: [],
    assumptions: ["This result was generated by the local E2E adapter."],
  };
}
