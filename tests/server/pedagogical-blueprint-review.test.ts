import { describe, expect, test } from 'vitest';
import type { SceneOutline } from '@/lib/types/generation';
import {
  createLessonBlueprint,
  reviewLessonBlueprint,
  runBlueprintReviewGate,
} from '@/lib/generation/lesson-blueprint';

function makeOutline(
  partial: Partial<SceneOutline> & Pick<SceneOutline, 'id' | 'title'>,
): SceneOutline {
  return {
    id: partial.id,
    type: partial.type || 'slide',
    title: partial.title,
    description: partial.description || `${partial.title} description`,
    keyPoints: partial.keyPoints || [
      `Core idea for ${partial.title}`,
      `Practical relevance of ${partial.title}`,
    ],
    order: partial.order || 1,
    ...(partial.teachingObjective ? { teachingObjective: partial.teachingObjective } : {}),
    ...(partial.estimatedDuration ? { estimatedDuration: partial.estimatedDuration } : {}),
    ...(partial.quizConfig ? { quizConfig: partial.quizConfig } : {}),
    ...(partial.widgetType ? { widgetType: partial.widgetType } : {}),
    ...(partial.widgetOutline ? { widgetOutline: partial.widgetOutline } : {}),
    ...(partial.pblConfig ? { pblConfig: partial.pblConfig } : {}),
  };
}

describe('pedagogical blueprint review gate', () => {
  test('reviewers flag weak outline-stage sequencing before revision', () => {
    const outlines: SceneOutline[] = [
      makeOutline({
        id: 'scene_1',
        order: 1,
        type: 'quiz',
        title: 'Quick knowledge check',
        keyPoints: ['Recall one key term', 'Choose the best answer'],
        quizConfig: { questionCount: 2, difficulty: 'easy', questionTypes: ['single'] },
      }),
      makeOutline({
        id: 'scene_2',
        order: 2,
        title: 'Core concept walkthrough',
        keyPoints: ['Define the concept', 'Show one mechanism'],
      }),
    ];

    const blueprint = createLessonBlueprint({
      requirement: 'Teach the basics of cloud load balancing for vocational students.',
      languageDirective: 'Teach in English.',
      outlines,
    });
    const reviews = reviewLessonBlueprint(blueprint);
    const issueTypes = new Set(
      reviews.flatMap((review) => review.issues.map((issue) => issue.type)),
    );

    expect(issueTypes.has('assessment_before_framing')).toBe(true);
    expect(issueTypes.has('missing_application')).toBe(true);
    expect(issueTypes.has('missing_demonstration')).toBe(true);
  });

  test('review gate revises weak outlines into an approved blueprint contract', () => {
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

    const result = runBlueprintReviewGate({
      requirement:
        'Create a short vocational cloud infrastructure lesson about autoscaling decisions.',
      languageDirective: 'Teach in English.',
      outlines,
    });

    expect(result.adjudication.verdict).toBe('pass');
    expect(result.revisionCount).toBe(1);
    expect(result.approvedOutlines.length).toBeGreaterThan(outlines.length);
    expect(
      result.approvedOutlines.some(
        (outline) => outline.pedagogicalMetadata?.pedagogicalRole.merrillPhase === 'application',
      ),
    ).toBe(true);
    expect(
      result.approvedOutlines.some(
        (outline) => outline.pedagogicalMetadata?.pedagogicalRole.merrillPhase === 'integration',
      ),
    ).toBe(true);
    expect(
      result.approvedOutlines.every(
        (outline) => outline.pedagogicalMetadata?.learningObjectiveIds.length,
      ),
    ).toBe(true);
  });

  test('cloud requirements receive vocational learner defaults and high-risk review cues', () => {
    const outlines: SceneOutline[] = [
      makeOutline({
        id: 'scene_1',
        order: 1,
        title: 'Hybrid network design principles',
        keyPoints: ['Site-to-site connectivity', 'Latency and resilience trade-offs'],
      }),
      makeOutline({
        id: 'scene_2',
        order: 2,
        title: 'VPN and Direct Connect choices',
        keyPoints: ['Security implications', 'Compliance considerations'],
      }),
      makeOutline({
        id: 'scene_3',
        order: 3,
        type: 'quiz',
        title: 'Decision checkpoint',
        keyPoints: ['Pick the safer design', 'Justify the trade-off'],
        quizConfig: { questionCount: 3, difficulty: 'medium', questionTypes: ['single', 'text'] },
      }),
    ];

    const result = runBlueprintReviewGate({
      requirement:
        'Build a lesson for second-year vocational cloud infrastructure students about hybrid network design, VPN, Direct Connect, and compliance.',
      languageDirective: 'Teach in English.',
      outlines,
    });

    expect(result.blueprint.lessonIntent.targetLearner.program).toBe('cloud infrastructure');
    expect(result.blueprint.lessonIntent.targetLearner.level).toContain('vocational');
    expect(result.blueprint.outcomes.some((outcome) => /cloud/i.test(outcome.statement))).toBe(
      true,
    );
    expect(
      result.approvedOutlines.some(
        (outline) => outline.pedagogicalMetadata?.factualRisk.riskLevel === 'high',
      ),
    ).toBe(true);
    expect(
      result.approvedOutlines.some((outline) =>
        /justify/i.test(outline.pedagogicalMetadata?.reflectionDesign.judgmentPoint || ''),
      ),
    ).toBe(true);
  });
});
