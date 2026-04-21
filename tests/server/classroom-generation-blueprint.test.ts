import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SceneOutline } from '@/lib/types/generation';
import type {
  BlueprintAdjudicationResult,
  BlueprintReviewerResult,
  LessonBlueprint,
  PedagogicalSceneMetadata,
} from '@/lib/types/blueprint';

const {
  callLLMMock,
  generateSceneOutlinesFromRequirementsMock,
  runBlueprintReviewGateMock,
  generateSceneContentMock,
  generateSceneActionsMock,
  persistClassroomMock,
  generateMediaForClassroomMock,
  replaceMediaPlaceholdersMock,
  generateTTSForClassroomMock,
} = vi.hoisted(() => ({
  callLLMMock: vi.fn(),
  generateSceneOutlinesFromRequirementsMock: vi.fn(),
  runBlueprintReviewGateMock: vi.fn(),
  generateSceneContentMock: vi.fn(),
  generateSceneActionsMock: vi.fn(),
  persistClassroomMock: vi.fn(),
  generateMediaForClassroomMock: vi.fn(),
  replaceMediaPlaceholdersMock: vi.fn(),
  generateTTSForClassroomMock: vi.fn(),
}));

vi.mock('@/lib/ai/llm', () => ({
  callLLM: callLLMMock,
}));

vi.mock('@/lib/server/resolve-model', () => ({
  resolveModel: vi.fn().mockResolvedValue({
    model: 'mock-model',
    modelInfo: { outputWindow: 2048 },
    modelString: 'mock-provider/mock-model',
    providerId: 'openai',
    apiKey: 'test-key',
  }),
}));

vi.mock('@/lib/ai/providers', () => ({
  isProviderKeyRequired: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/server/provider-config', () => ({
  resolveWebSearchApiKey: vi.fn().mockReturnValue(undefined),
}));

vi.mock('@/lib/generation/outline-generator', () => ({
  generateSceneOutlinesFromRequirements: generateSceneOutlinesFromRequirementsMock,
  applyOutlineFallbacks: vi.fn((outline: SceneOutline) => outline),
}));

vi.mock('@/lib/generation/lesson-blueprint', () => ({
  runBlueprintReviewGate: runBlueprintReviewGateMock,
}));

vi.mock('@/lib/server/classroom-storage', () => ({
  persistClassroom: persistClassroomMock,
}));

vi.mock('@/lib/server/classroom-media-generation', () => ({
  generateMediaForClassroom: generateMediaForClassroomMock,
  replaceMediaPlaceholders: replaceMediaPlaceholdersMock,
  generateTTSForClassroom: generateTTSForClassroomMock,
}));

vi.mock('@/lib/generation/scene-generator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/generation/scene-generator')>();
  return {
    ...actual,
    generateSceneContent: generateSceneContentMock,
    generateSceneActions: generateSceneActionsMock,
  };
});

import { generateClassroom } from '@/lib/server/classroom-generation';

function makePedagogicalMetadata(
  sceneId: string,
  phase: PedagogicalSceneMetadata['pedagogicalRole']['merrillPhase'],
): PedagogicalSceneMetadata {
  return {
    scenePlanId: sceneId,
    themeIds: ['theme_1'],
    learningObjectiveIds: ['lo_1'],
    pedagogicalRole: {
      merrillPhase: phase,
      instructionalMove:
        phase === 'application'
          ? 'guided_practice'
          : phase === 'integration'
            ? 'reflection'
            : phase === 'demonstration'
              ? 'model'
              : 'introduce',
      assessmentRole: phase === 'application' ? 'formative' : 'none',
      soloDepth: phase === 'integration' ? 'extended_abstract' : 'multistructural',
    },
    scaffolding: {
      buildsOnSceneIds: [],
      supportLevel: phase === 'application' ? 'medium' : 'high',
      workedExample: phase === 'demonstration',
      commonMisconceptions: [],
    },
    reflectionDesign: {
      reflectionInAction: phase === 'application',
      reflectionOnAction: phase === 'integration',
      reframingPrompt:
        phase === 'integration' ? 'How would you adapt this in a new context?' : null,
      judgmentPoint: phase === 'application' ? 'Choose the safer action and justify it.' : null,
    },
    factualRisk: {
      riskLevel: 'medium',
      claimsNeedingReview: [],
    },
    preserveConstraints: ['Keep terminology consistent with the approved outline.'],
  };
}

function makeOutline(
  partial: Partial<SceneOutline> & Pick<SceneOutline, 'id' | 'title'>,
): SceneOutline {
  return {
    id: partial.id,
    type: partial.type || 'slide',
    title: partial.title,
    description: partial.description || `${partial.title} description`,
    keyPoints: partial.keyPoints || [`Explain ${partial.title}`, `Apply ${partial.title}`],
    order: partial.order || 1,
    ...(partial.teachingObjective ? { teachingObjective: partial.teachingObjective } : {}),
    ...(partial.quizConfig ? { quizConfig: partial.quizConfig } : {}),
    ...(partial.pedagogicalMetadata ? { pedagogicalMetadata: partial.pedagogicalMetadata } : {}),
  };
}

function makeReviewers(): BlueprintReviewerResult[] {
  return [
    {
      reviewer: 'sme',
      verdict: 'pass',
      overallScore: 4,
      dimensionScores: { accuracy: 4, decomposition: 4 },
      issues: [],
      summary: 'SME review approved the blueprint.',
    },
    {
      reviewer: 'merrill',
      verdict: 'pass',
      overallScore: 4,
      dimensionScores: { sequence: 4, application: 4 },
      issues: [],
      summary: 'Merrill review approved the instructional sequence.',
    },
    {
      reviewer: 'schon',
      verdict: 'pass',
      overallScore: 4,
      dimensionScores: { reflection: 4, judgment: 4 },
      issues: [],
      summary: 'Schön review approved the reflective loop.',
    },
  ];
}

function makeAdjudication(): BlueprintAdjudicationResult {
  return {
    verdict: 'pass',
    releaseForSceneGeneration: true,
    blockingIssues: [],
    requiredRevisions: [],
    preserveConstraints: ['Keep the approved scene sequence intact.'],
    summary: 'Blueprint approved for scene generation.',
  };
}

function makeBlueprint(approvedOutlines: SceneOutline[]): LessonBlueprint {
  return {
    schemaVersion: 'pedagogical-blueprint/v1',
    lessonIntent: {
      topic: 'Cloud autoscaling decisions',
      targetLearner: {
        level: 'second-year vocational learner',
        program: 'cloud infrastructure',
        context: 'Scenario-based cloud operations work',
      },
      lessonMode: 'skill',
      durationMinutes: 30,
      languageDirective: 'Teach in English.',
    },
    outcomes: [
      {
        id: 'lo_1',
        statement: 'Explain autoscaling choices in a cloud environment.',
        type: 'knowledge',
        priority: 'core',
      },
    ],
    prerequisites: [
      {
        id: 'pre_1',
        statement: 'Basic familiarity with cloud workloads.',
        required: true,
        canBeActivatedInLesson: false,
      },
    ],
    themeGraph: [
      {
        id: 'theme_1',
        title: 'Scaling signals and decisions',
        dependsOn: [],
        rationale: 'Learners need a practical decision frame before detailed practice.',
      },
    ],
    scenePlan: approvedOutlines.map((outline) => ({
      id: outline.id,
      title: outline.title,
      type: outline.type,
      order: outline.order,
      themeIds: outline.pedagogicalMetadata?.themeIds || ['theme_1'],
      learningObjectiveIds: outline.pedagogicalMetadata?.learningObjectiveIds || ['lo_1'],
      description: outline.description,
      keyPoints: outline.keyPoints,
      estimatedMinutes: 6,
      pedagogicalRole:
        outline.pedagogicalMetadata?.pedagogicalRole ||
        makePedagogicalMetadata(outline.id, 'demonstration').pedagogicalRole,
      scaffolding:
        outline.pedagogicalMetadata?.scaffolding ||
        makePedagogicalMetadata(outline.id, 'demonstration').scaffolding,
      reflectionDesign:
        outline.pedagogicalMetadata?.reflectionDesign ||
        makePedagogicalMetadata(outline.id, 'demonstration').reflectionDesign,
      factualRisk:
        outline.pedagogicalMetadata?.factualRisk ||
        makePedagogicalMetadata(outline.id, 'demonstration').factualRisk,
      ...(outline.quizConfig ? { quizConfig: outline.quizConfig } : {}),
      ...(outline.teachingObjective ? { teachingObjective: outline.teachingObjective } : {}),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  generateSceneOutlinesFromRequirementsMock.mockResolvedValue({
    success: true,
    data: {
      languageDirective: 'Teach in English.',
      outlines: [
        makeOutline({
          id: 'outline_1',
          order: 1,
          title: 'Autoscaling framing',
          keyPoints: ['Recognize changing demand', 'Frame the scaling problem'],
        }),
        makeOutline({
          id: 'outline_2',
          order: 2,
          title: 'Scaling metrics walkthrough',
          keyPoints: ['CPU and queue metrics', 'Threshold trade-offs'],
        }),
      ],
    },
  });

  generateSceneContentMock.mockImplementation(async (outline: SceneOutline) => {
    if (outline.type === 'quiz') {
      return {
        questions: [
          {
            id: `${outline.id}_q1`,
            type: 'single',
            question: `What is the best next step in ${outline.title}?`,
            options: [
              { label: 'Option A', value: 'A' },
              { label: 'Option B', value: 'B' },
            ],
            answer: ['A'],
            analysis: 'Use the approved decision rule.',
            hasAnswer: true,
          },
        ],
      };
    }

    return {
      elements: [],
      background: { type: 'solid', color: '#ffffff' },
    };
  });

  generateSceneActionsMock.mockResolvedValue([]);
  persistClassroomMock.mockImplementation(async ({ id }, baseUrl: string) => ({
    id,
    url: `${baseUrl}/classroom/${id}`,
    createdAt: '2026-04-21T21:00:00.000Z',
  }));
  generateMediaForClassroomMock.mockResolvedValue({});
  generateTTSForClassroomMock.mockResolvedValue(undefined);
  callLLMMock.mockResolvedValue(
    JSON.stringify({
      agents: [
        {
          name: 'Teacher Nova',
          role: 'teacher',
          persona: 'Guides learners through decisions with calm clarity.',
        },
        {
          name: 'Assistant Kai',
          role: 'assistant',
          persona: 'Offers concise hints and checks for understanding.',
        },
      ],
    }),
  );
});

describe('classroom generation blueprint integration', () => {
  it('uses approved outlines after blueprint review and persists the pedagogical blueprint', async () => {
    const approvedOutlines: SceneOutline[] = [
      makeOutline({
        id: 'approved_1',
        order: 1,
        title: 'Autoscaling problem framing',
        pedagogicalMetadata: makePedagogicalMetadata('approved_1', 'problem'),
      }),
      makeOutline({
        id: 'approved_2',
        order: 2,
        title: 'Metric walkthrough',
        pedagogicalMetadata: makePedagogicalMetadata('approved_2', 'demonstration'),
      }),
      makeOutline({
        id: 'approved_3',
        order: 3,
        type: 'quiz',
        title: 'Decision checkpoint',
        keyPoints: ['Choose a safer threshold', 'Justify the choice'],
        quizConfig: { questionCount: 2, difficulty: 'medium', questionTypes: ['single', 'text'] },
        pedagogicalMetadata: makePedagogicalMetadata('approved_3', 'application'),
      }),
    ];

    runBlueprintReviewGateMock.mockReturnValue({
      blueprint: makeBlueprint(approvedOutlines),
      reviewerResults: makeReviewers(),
      adjudication: makeAdjudication(),
      approvedOutlines,
      revisionCount: 1,
    });

    const progressUpdates: Array<{ step: string; totalScenes?: number; message: string }> = [];
    const result = await generateClassroom(
      {
        requirement:
          'Teach autoscaling decisions for second-year vocational cloud infrastructure students.',
      },
      {
        baseUrl: 'https://example.test',
        onProgress: (progress) => {
          progressUpdates.push({
            step: progress.step,
            totalScenes: progress.totalScenes,
            message: progress.message,
          });
        },
      },
    );

    expect(runBlueprintReviewGateMock).toHaveBeenCalledTimes(1);
    expect(
      generateSceneContentMock.mock.calls.map(([outline]) => (outline as SceneOutline).id),
    ).toEqual(['approved_1', 'approved_2', 'approved_3']);
    expect(generateSceneActionsMock).toHaveBeenCalledTimes(3);
    expect(result.stage.pedagogicalBlueprint?.lessonBlueprint.schemaVersion).toBe(
      'pedagogical-blueprint/v1',
    );
    expect(result.stage.pedagogicalBlueprint?.review.revisionCount).toBe(1);
    expect(result.scenesCount).toBe(3);
    expect(result.stage.name).toBe('Autoscaling problem framing');
    expect(progressUpdates.some((update) => update.step === 'reviewing_blueprint')).toBe(true);
    expect(
      progressUpdates.some(
        (update) =>
          update.step === 'reviewing_blueprint' &&
          update.message.includes('approved after 1 revision round'),
      ),
    ).toBe(true);
    expect(progressUpdates.at(-1)?.totalScenes).toBe(3);

    const persistedPayload = persistClassroomMock.mock.calls[0]?.[0];
    expect(persistedPayload.stage.pedagogicalBlueprint.review.reviewerResults).toHaveLength(3);
    expect(persistedPayload.scenes).toHaveLength(3);
  });

  it('falls back to default agentIds when generated agent creation fails', async () => {
    const approvedOutlines: SceneOutline[] = [
      makeOutline({
        id: 'approved_1',
        order: 1,
        title: 'Cloud intro',
        pedagogicalMetadata: makePedagogicalMetadata('approved_1', 'problem'),
      }),
    ];

    runBlueprintReviewGateMock.mockReturnValue({
      blueprint: makeBlueprint(approvedOutlines),
      reviewerResults: makeReviewers(),
      adjudication: makeAdjudication(),
      approvedOutlines,
      revisionCount: 0,
    });
    callLLMMock.mockRejectedValueOnce(new Error('LLM agent generation unavailable'));

    const result = await generateClassroom(
      {
        requirement: 'Teach cloud basics.',
        agentMode: 'generate',
      },
      {
        baseUrl: 'https://example.test',
      },
    );

    expect(result.stage.agentIds).toEqual([
      'default-1',
      'default-2',
      'default-3',
      'default-4',
      'default-5',
      'default-6',
    ]);
    expect(result.stage.generatedAgentConfigs).toBeUndefined();
  });

  it('stops before scene generation when the blueprint review gate fails', async () => {
    runBlueprintReviewGateMock.mockImplementation(() => {
      throw new Error('Blueprint review exceeded 1 revision round(s): blocking issue');
    });

    await expect(
      generateClassroom(
        {
          requirement: 'Teach a risky lesson that should fail blueprint review.',
        },
        {
          baseUrl: 'https://example.test',
        },
      ),
    ).rejects.toThrow('Blueprint review exceeded 1 revision round(s): blocking issue');

    expect(generateSceneContentMock).not.toHaveBeenCalled();
    expect(generateSceneActionsMock).not.toHaveBeenCalled();
    expect(persistClassroomMock).not.toHaveBeenCalled();
  });
});
