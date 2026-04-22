import { describe, expect, test } from 'vitest';
import type { AICallFn } from '@/lib/generation/pipeline-types';
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

  test('review gate revises weak outlines into an approved blueprint contract', async () => {
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

    const result = await runBlueprintReviewGate({
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

  test('cloud requirements receive vocational learner defaults and high-risk review cues', async () => {
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

    const result = await runBlueprintReviewGate({
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

  test('cloud curriculum strands shape blueprint themes and outcomes for governance-heavy topics', async () => {
    const outlines: SceneOutline[] = [
      makeOutline({
        id: 'scene_1',
        order: 1,
        title: 'Terraform deployment workflow',
        keyPoints: ['Repeatable infrastructure changes', 'State handling and review'],
      }),
      makeOutline({
        id: 'scene_2',
        order: 2,
        title: 'RBAC and policy enforcement',
        keyPoints: ['Least privilege', 'Policy guardrails and auditability'],
      }),
      makeOutline({
        id: 'scene_3',
        order: 3,
        title: 'Compliance-aware change review',
        keyPoints: ['Documenting approvals', 'Protecting personal and corporate data'],
      }),
    ];

    const result = await runBlueprintReviewGate({
      requirement:
        'Create a lesson for second-year vocational cloud infrastructure students about Terraform, RBAC, policy enforcement, and compliance automation.',
      languageDirective: 'Teach in English.',
      outlines,
    });

    expect(
      result.blueprint.themeGraph.some((theme) =>
        /Infrastructure as Code, governance and secure operations/i.test(theme.title),
      ),
    ).toBe(true);
    expect(
      result.blueprint.outcomes.some((outcome) =>
        /ethical requirements|security in the cloud|personal and corporate data/i.test(
          outcome.statement,
        ),
      ),
    ).toBe(true);
    expect(
      result.blueprint.prerequisites.some((prerequisite) =>
        /permissions|repeatable deployment workflows|ethical consequences/i.test(
          prerequisite.statement,
        ),
      ),
    ).toBe(true);
    expect(
      result.blueprint.scenePlan.some((scene) =>
        scene.themeIds.includes('iac_governance_and_security'),
      ),
    ).toBe(true);
  });

  test('prompt-driven review modules can steer a revise-to-pass loop with round history', async () => {
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

    const seenVerdicts: string[] = [];
    const aiCall: AICallFn = async (systemPrompt, userPrompt) => {
      if (systemPrompt.includes('Pedagogical Blueprint SME Reviewer')) {
        return JSON.stringify({
          reviewer: 'sme',
          verdict: 'pass',
          overallScore: 4,
          dimensionScores: {
            factualCorrectness: 4,
            conceptDecomposition: 4,
            prerequisiteOrdering: 4,
            terminology: 4,
            curriculumFit: 5,
          },
          issues: [],
          summary: 'The blueprint is factually plausible for a first-pass cloud lesson.',
        });
      }

      if (systemPrompt.includes('Pedagogical Blueprint Merrill Reviewer')) {
        const missingApplication = !userPrompt.includes('"merrillPhase": "application"');
        return JSON.stringify({
          reviewer: 'merrill',
          verdict: missingApplication ? 'revise' : 'pass',
          overallScore: missingApplication ? 3 : 4,
          dimensionScores: {
            problemCentered: 3,
            activation: 4,
            demonstration: 4,
            application: missingApplication ? 2 : 4,
            integration: missingApplication ? 2 : 4,
            scaffoldingCoherence: 4,
          },
          issues: missingApplication
            ? [
                {
                  severity: 'major',
                  scope: 'lesson',
                  targetId: 'lesson',
                  type: 'missing_application',
                  message: 'Learners still need a guided application scene before the close.',
                  suggestedRevision:
                    'Add a guided or independent application scene before the wrap-up.',
                },
              ]
            : [],
          summary: missingApplication
            ? 'The blueprint needs an application phase before expansion.'
            : 'The lesson now has a usable Merrill arc.',
        });
      }

      if (systemPrompt.includes('Pedagogical Blueprint Schon Reviewer')) {
        const missingReflection = !userPrompt.includes('"reflectionOnAction": true');
        return JSON.stringify({
          reviewer: 'schon',
          verdict: missingReflection ? 'revise' : 'pass',
          overallScore: missingReflection ? 3 : 4,
          dimensionScores: {
            reflectionInAction: missingReflection ? 2 : 4,
            reflectionOnAction: missingReflection ? 2 : 4,
            reframing: missingReflection ? 2 : 4,
            judgmentPractice: 4,
            actionFeedbackLoop: missingReflection ? 2 : 4,
          },
          issues: missingReflection
            ? [
                {
                  severity: 'major',
                  scope: 'lesson',
                  targetId: 'lesson',
                  type: 'missing_reflection_on_action',
                  message: 'Learners need a closing reflection or transfer move.',
                  suggestedRevision:
                    'Add a final reflection or transfer scene with a concrete reflection prompt.',
                },
              ]
            : [],
          summary: missingReflection
            ? 'The lesson needs a clearer reflective close.'
            : 'Reflective practice is visible enough to proceed.',
        });
      }

      if (systemPrompt.includes('Pedagogical Blueprint Adjudicator')) {
        const needsRevision =
          userPrompt.includes('missing_application') ||
          userPrompt.includes('missing_reflection_on_action');
        return JSON.stringify({
          verdict: needsRevision ? 'revise' : 'pass',
          releaseForSceneGeneration: !needsRevision,
          blockingIssues: needsRevision ? ['issue_missing_application'] : [],
          requiredRevisions: needsRevision
            ? [
                {
                  targetId: 'lesson',
                  instruction: 'Add a guided or independent application scene before the wrap-up.',
                },
                {
                  targetId: 'lesson',
                  instruction:
                    'Add a final reflection or transfer scene with a concrete reflection prompt.',
                },
              ]
            : [],
          preserveConstraints: ['Keep topic focus on Introduction to autoscaling'],
          summary: needsRevision
            ? 'Targeted revisions are required before scene generation.'
            : 'The blueprint is ready for downstream generation.',
        });
      }

      if (systemPrompt.includes('Pedagogical Blueprint Revision Writer')) {
        return 'not-valid-json';
      }

      throw new Error(`Unexpected prompt: ${systemPrompt.slice(0, 60)}`);
    };

    const result = await runBlueprintReviewGate(
      {
        requirement:
          'Create a short vocational cloud infrastructure lesson about autoscaling decisions.',
        languageDirective: 'Teach in English.',
        outlines,
      },
      {
        aiCall,
        reviewMode: 'hybrid',
        onReviewRound: async (reviewRound) => {
          seenVerdicts.push(reviewRound.adjudication.verdict);
        },
      },
    );

    expect(result.reviewMode).toBe('hybrid');
    expect(result.revisionCount).toBe(1);
    expect(result.reviewRounds).toHaveLength(2);
    expect(seenVerdicts).toEqual(['revise', 'pass']);
    expect(
      result.approvedOutlines.some(
        (outline) => outline.pedagogicalMetadata?.pedagogicalRole.merrillPhase === 'application',
      ),
    ).toBe(true);
    expect(
      result.approvedOutlines.some(
        (outline) => outline.pedagogicalMetadata?.reflectionDesign.reflectionOnAction,
      ),
    ).toBe(true);
  });

  test('live review control surfaces prompt-driven fail decisions clearly', async () => {
    const outlines: SceneOutline[] = [
      makeOutline({
        id: 'scene_1',
        order: 1,
        title: 'Risky cloud shortcut',
        keyPoints: ['Disable MFA to move faster', 'Trust the perimeter only'],
      }),
    ];

    const aiCall: AICallFn = async (systemPrompt) => {
      if (systemPrompt.includes('Pedagogical Blueprint SME Reviewer')) {
        return JSON.stringify({
          reviewer: 'sme',
          verdict: 'fail',
          overallScore: 1,
          dimensionScores: {
            factualCorrectness: 1,
            conceptDecomposition: 2,
            prerequisiteOrdering: 2,
            terminology: 2,
            curriculumFit: 2,
          },
          issues: [
            {
              severity: 'critical',
              scope: 'scene',
              targetId: 'scene_1',
              type: 'incorrect_claim',
              message:
                'The blueprint normalizes unsafe security advice for vocational cloud learners.',
              suggestedRevision:
                'Regenerate this lesson around safe baseline security practice instead.',
            },
          ],
          summary: 'A critical factual problem makes the blueprint unsafe to expand.',
        });
      }

      if (systemPrompt.includes('Pedagogical Blueprint Merrill Reviewer')) {
        return JSON.stringify({
          reviewer: 'merrill',
          verdict: 'pass',
          overallScore: 3,
          dimensionScores: {
            problemCentered: 3,
            activation: 3,
            demonstration: 3,
            application: 3,
            integration: 3,
            scaffoldingCoherence: 3,
          },
          issues: [],
          summary: 'Instructional structure is not the main blocker here.',
        });
      }

      if (systemPrompt.includes('Pedagogical Blueprint Schon Reviewer')) {
        return JSON.stringify({
          reviewer: 'schon',
          verdict: 'pass',
          overallScore: 3,
          dimensionScores: {
            reflectionInAction: 3,
            reflectionOnAction: 3,
            reframing: 3,
            judgmentPractice: 3,
            actionFeedbackLoop: 3,
          },
          issues: [],
          summary: 'Reflective practice is not the main blocker here.',
        });
      }

      if (systemPrompt.includes('Pedagogical Blueprint Adjudicator')) {
        return JSON.stringify({
          verdict: 'fail',
          releaseForSceneGeneration: false,
          blockingIssues: ['issue_unsafe_security_advice'],
          requiredRevisions: [
            {
              targetId: 'scene_1',
              instruction: 'Regenerate this lesson around safe baseline security practice instead.',
            },
          ],
          preserveConstraints: ['Keep the lesson focused on cloud security decisions'],
          summary: 'A critical factual issue blocks scene generation.',
        });
      }

      return 'not-valid-json';
    };

    await expect(
      runBlueprintReviewGate(
        {
          requirement: 'Teach cloud security shortcuts for busy operators.',
          languageDirective: 'Teach in English.',
          outlines,
        },
        {
          aiCall,
          reviewMode: 'prompt',
        },
      ),
    ).rejects.toMatchObject({
      name: 'BlueprintReviewError',
      failureType: 'fail',
      reviewMode: 'prompt',
    });
  });
});
