import type { SceneOutline } from '@/lib/types/generation';
import type { BlueprintReviewerResult } from '@/lib/types/blueprint';
import {
  BlueprintReviewError,
  runBlueprintReviewGate,
  type BlueprintReviewGateOptions,
  type BlueprintReviewGateResult,
  type BlueprintReviewRound,
  type CreateLessonBlueprintInput,
} from './lesson-blueprint';

export type PedagogicalPreflightPhase =
  | 'starting'
  | 'review_round'
  | 'revision_requested'
  | 'approved'
  | 'failed';

export interface PedagogicalPreflightEvent {
  phase: PedagogicalPreflightPhase;
  message: string;
  round?: number;
  reviewerVerdicts?: Array<{
    reviewer: BlueprintReviewerResult['reviewer'];
    verdict: BlueprintReviewerResult['verdict'];
    score: number;
  }>;
}

export interface PedagogicalPreflightResult extends BlueprintReviewGateResult {
  events: PedagogicalPreflightEvent[];
}

function summarizeReviewerVerdicts(
  reviewerResults: BlueprintReviewRound['reviewerResults'],
): string {
  return reviewerResults
    .map(
      (result) =>
        `${result.reviewer.toUpperCase()}: ${result.verdict.toUpperCase()} (${result.overallScore}/5)`,
    )
    .join(' · ');
}

function buildReviewRoundEvent(reviewRound: BlueprintReviewRound): PedagogicalPreflightEvent {
  return {
    phase: 'review_round',
    round: reviewRound.round,
    message: `Completed pedagogical review round ${reviewRound.round}: ${summarizeReviewerVerdicts(reviewRound.reviewerResults)}`,
    reviewerVerdicts: reviewRound.reviewerResults.map((result) => ({
      reviewer: result.reviewer,
      verdict: result.verdict,
      score: result.overallScore,
    })),
  };
}

export function buildPedagogicalPreflightEvents(params: {
  reviewRounds?: BlueprintReviewRound[];
  revisionCount: number;
  finalVerdict: BlueprintReviewRound['adjudication']['verdict'];
  failureType?: BlueprintReviewError['failureType'];
}): PedagogicalPreflightEvent[] {
  const events: PedagogicalPreflightEvent[] = [
    {
      phase: 'starting',
      message: 'Constructed a pedagogical blueprint and started SME / Merrill / Schön review.',
    },
  ];

  const reviewRounds = params.reviewRounds || [];

  reviewRounds.forEach((reviewRound) => {
    events.push(buildReviewRoundEvent(reviewRound));

    if (reviewRound.adjudication.verdict === 'revise') {
      events.push({
        phase: 'revision_requested',
        round: reviewRound.round,
        message: `Adjudicator requested revisions after round ${reviewRound.round}: ${reviewRound.adjudication.summary}`,
      });
    }
  });

  if (params.finalVerdict === 'pass') {
    events.push({
      phase: 'approved',
      message:
        params.revisionCount > 0
          ? `Pedagogical blueprint approved after ${params.revisionCount} revision round${params.revisionCount === 1 ? '' : 's'}.`
          : 'Pedagogical blueprint approved without revisions.',
    });
    return events;
  }

  events.push({
    phase: 'failed',
    message:
      params.failureType === 'max_revisions'
        ? `Pedagogical blueprint did not converge after ${params.revisionCount} revision round${params.revisionCount === 1 ? '' : 's'}.`
        : 'Pedagogical blueprint review failed and blocked scene generation.',
  });

  return events;
}

export async function runPedagogicalPreflight(
  input: CreateLessonBlueprintInput,
  options?: BlueprintReviewGateOptions,
): Promise<PedagogicalPreflightResult> {
  // This wrapper is the shared post-outline preflight used by both the GUI adapter
  // and the server/job adapter. It keeps the pedagogical gate canonical even while
  // the higher-level transport and persistence flows are still separate.
  const result = await runBlueprintReviewGate(input, options);

  return {
    ...result,
    events: buildPedagogicalPreflightEvents({
      reviewRounds: result.reviewRounds || [],
      revisionCount: result.revisionCount,
      finalVerdict: result.adjudication.verdict,
    }),
  };
}
