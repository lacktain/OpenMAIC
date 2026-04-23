import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { BlueprintReviewError, type BlueprintReviewRound } from '@/lib/generation/lesson-blueprint';
import {
  buildPedagogicalPreflightEvents,
  runPedagogicalPreflight,
} from '@/lib/generation/pedagogical-preflight';
import { resolveModelFromHeaders } from '@/lib/server/resolve-model';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import type { SceneOutline } from '@/lib/types/generation';

const log = createLogger('Pedagogical Step API');

export const maxDuration = 300;

function buildReviewerSummary(reviewRounds?: BlueprintReviewRound[]) {
  const lastRound = reviewRounds?.[reviewRounds.length - 1];
  return (
    lastRound?.reviewerResults.map((result) => ({
      reviewer: result.reviewer,
      verdict: result.verdict,
      score: result.overallScore,
    })) || []
  );
}

export async function POST(req: NextRequest) {
  let requirementSnippet: string | undefined;
  let resolvedModelString: string | undefined;

  try {
    const body = await req.json();
    const { requirement, languageDirective, outlines } = body as {
      requirement?: string;
      languageDirective?: string;
      outlines?: SceneOutline[];
    };

    requirementSnippet = requirement?.substring(0, 60);

    if (!requirement) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'requirement is required');
    }
    if (!languageDirective) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'languageDirective is required');
    }
    if (!outlines || outlines.length === 0) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'outlines is required and must not be empty');
    }

    const { model: languageModel, modelInfo, modelString } = await resolveModelFromHeaders(req);
    resolvedModelString = modelString;

    const aiCall = async (systemPrompt: string, userPrompt: string): Promise<string> => {
      const result = await callLLM(
        {
          model: languageModel,
          system: systemPrompt,
          prompt: userPrompt,
          maxOutputTokens: modelInfo?.outputWindow,
        },
        'pedagogical-step',
      );
      return result.text;
    };

    // The GUI route intentionally calls the same shared pedagogical preflight as the
    // server/job flow. That keeps the blueprint review logic canonical even before
    // the broader generation adapters are fully consolidated.
    const preflight = await runPedagogicalPreflight(
      {
        requirement,
        languageDirective,
        outlines,
      },
      {
        aiCall,
        reviewMode: 'hybrid',
      },
    );

    log.info('Pedagogical preflight approved for GUI generation', {
      requirementSnippet,
      reviewMode: preflight.reviewMode,
      revisionCount: preflight.revisionCount,
      reviewerVerdicts: buildReviewerSummary(preflight.reviewRounds),
      approvedOutlineCount: preflight.approvedOutlines.length,
      modelString,
    });

    return apiSuccess({
      blueprint: preflight.blueprint,
      reviewerResults: preflight.reviewerResults,
      adjudication: preflight.adjudication,
      approvedOutlines: preflight.approvedOutlines,
      revisionCount: preflight.revisionCount,
      reviewMode: preflight.reviewMode,
      reviewRounds: preflight.reviewRounds,
      events: preflight.events,
    });
  } catch (error) {
    if (error instanceof BlueprintReviewError) {
      const events = buildPedagogicalPreflightEvents({
        reviewRounds: error.reviewRounds,
        revisionCount: error.revisionCount,
        finalVerdict: error.lastAdjudication.verdict,
        failureType: error.failureType,
      });

      log.warn('Pedagogical preflight blocked GUI scene generation', {
        requirementSnippet,
        failureType: error.failureType,
        revisionCount: error.revisionCount,
        reviewMode: error.reviewMode,
        reviewerVerdicts: buildReviewerSummary(error.reviewRounds),
        modelString: resolvedModelString,
      });

      return NextResponse.json(
        {
          success: false,
          errorCode: 'GENERATION_FAILED',
          error: error.message,
          reviewMode: error.reviewMode,
          revisionCount: error.revisionCount,
          reviewRounds: error.reviewRounds,
          reviewerResults: error.lastReviewerResults,
          adjudication: error.lastAdjudication,
          events,
        },
        { status: 422 },
      );
    }

    log.error(
      `Pedagogical preflight request failed [requirement="${requirementSnippet ?? 'unknown'}...", model=${resolvedModelString ?? 'unknown'}]:`,
      error,
    );

    return apiError('INTERNAL_ERROR', 500, error instanceof Error ? error.message : String(error));
  }
}
