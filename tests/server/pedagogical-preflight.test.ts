import { describe, expect, test } from 'vitest';
import type { SceneOutline } from '@/lib/types/generation';
import {
  buildPedagogicalPreflightEvents,
  runPedagogicalPreflight,
} from '@/lib/generation/pedagogical-preflight';
import type { BlueprintReviewRound } from '@/lib/generation/lesson-blueprint';

function makeOutline(
  partial: Partial<SceneOutline> & Pick<SceneOutline, 'id' | 'title'>,
): SceneOutline {
  return {
    id: partial.id,
    type: partial.type || 'slide',
    title: partial.title,
    description: partial.description || `${partial.title} description`,
    keyPoints: partial.keyPoints || [`Core idea for ${partial.title}`, `Apply ${partial.title}`],
    order: partial.order || 1,
    ...(partial.quizConfig ? { quizConfig: partial.quizConfig } : {}),
  };
}

describe('pedagogical preflight', () => {
  test('wraps the blueprint gate with GUI-friendly event history', async () => {
    const outlines: SceneOutline[] = [
      makeOutline({
        id: 'scene_1',
        order: 1,
        title: 'Introduction to autoscaling',
        keyPoints: ['What autoscaling is', 'Why demand changes matter'],
      }),
      makeOutline({
        id: 'scene_2',
        order: 2,
        title: 'Scaling signals and thresholds',
        keyPoints: ['CPU and queue depth', 'Choosing thresholds'],
      }),
    ];

    const result = await runPedagogicalPreflight({
      requirement:
        'Create a short vocational cloud infrastructure lesson about autoscaling decisions.',
      languageDirective: 'Teach in English.',
      outlines,
    });

    expect(result.adjudication.verdict).toBe('pass');
    expect(result.events[0]?.phase).toBe('starting');
    expect(result.events.some((event) => event.phase === 'review_round')).toBe(true);
    expect(result.events.some((event) => event.phase === 'revision_requested')).toBe(true);
    expect(result.events.at(-1)?.phase).toBe('approved');
  });

  test('builds a failure timeline from prior review rounds', () => {
    const reviewRounds: BlueprintReviewRound[] = [
      {
        round: 1,
        mode: 'hybrid',
        reviewerResults: [
          {
            reviewer: 'sme',
            verdict: 'pass',
            overallScore: 4,
            dimensionScores: { accuracy: 4 },
            issues: [],
            summary: 'Looks plausible.',
          },
          {
            reviewer: 'merrill',
            verdict: 'revise',
            overallScore: 3,
            dimensionScores: { application: 2 },
            issues: [
              {
                id: 'issue_1',
                severity: 'major',
                scope: 'lesson',
                targetId: 'lesson',
                type: 'missing_application',
                message: 'Add guided application before the close.',
                suggestedRevision: 'Insert an application scene.',
              },
            ],
            summary: 'Needs guided application.',
          },
          {
            reviewer: 'schon',
            verdict: 'pass',
            overallScore: 4,
            dimensionScores: { reflection: 4 },
            issues: [],
            summary: 'Reflection is visible enough.',
          },
        ],
        adjudication: {
          verdict: 'revise',
          releaseForSceneGeneration: false,
          blockingIssues: ['missing_application'],
          requiredRevisions: [
            {
              targetId: 'lesson',
              instruction: 'Add a guided application scene before the closing reflection.',
            },
          ],
          preserveConstraints: ['Keep the lesson focused on autoscaling decisions.'],
          summary: 'Revise the sequence before release.',
        },
      },
    ];

    const events = buildPedagogicalPreflightEvents({
      reviewRounds,
      revisionCount: 1,
      finalVerdict: 'revise',
      failureType: 'max_revisions',
    });

    expect(events[0]?.phase).toBe('starting');
    expect(events.some((event) => event.phase === 'revision_requested')).toBe(true);
    expect(events.at(-1)?.phase).toBe('failed');
  });
});
