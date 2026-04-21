import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { CLASSROOM_JOBS_DIR } from '@/lib/server/classroom-storage';
import {
  createClassroomGenerationJob,
  markClassroomGenerationJobSucceeded,
  readClassroomGenerationJob,
} from '@/lib/server/classroom-job-store';
import type { GenerateClassroomResult } from '@/lib/server/classroom-generation';

const createdJobIds = new Set<string>();

function makeJobId(prefix: string): string {
  const jobId = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  createdJobIds.add(jobId);
  return jobId;
}

function makeGenerateResult(withBlueprint: boolean): GenerateClassroomResult {
  return {
    id: 'classroom_1',
    url: 'https://example.test/classroom/classroom_1',
    scenesCount: 3,
    createdAt: '2026-04-21T22:00:00.000Z',
    scenes: [],
    stage: {
      id: 'stage_1',
      name: 'Autoscaling decisions',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(withBlueprint
        ? {
            pedagogicalBlueprint: {
              lessonBlueprint: {
                schemaVersion: 'pedagogical-blueprint/v1',
                lessonIntent: {
                  topic: 'Autoscaling decisions',
                  targetLearner: {
                    level: 'second-year vocational learner',
                    program: 'cloud infrastructure',
                    context: 'Scenario-based cloud operations work',
                  },
                  lessonMode: 'skill',
                  durationMinutes: 25,
                  languageDirective: 'Teach in English.',
                },
                outcomes: [
                  {
                    id: 'lo_1',
                    statement: 'Explain an autoscaling decision.',
                    type: 'knowledge',
                    priority: 'core',
                  },
                ],
                prerequisites: [
                  {
                    id: 'pre_1',
                    statement: 'Basic cloud familiarity',
                    required: true,
                    canBeActivatedInLesson: false,
                  },
                ],
                themeGraph: [
                  {
                    id: 'theme_1',
                    title: 'Scaling signals',
                    dependsOn: [],
                    rationale: 'The learner needs a clear decision frame.',
                  },
                ],
                scenePlan: [
                  {
                    id: 'scene_plan_1',
                    title: 'Frame the autoscaling problem',
                    type: 'slide',
                    order: 1,
                    themeIds: ['theme_1'],
                    learningObjectiveIds: ['lo_1'],
                    description: 'Set up the decision problem.',
                    keyPoints: ['Recognize changing demand'],
                    estimatedMinutes: 5,
                    pedagogicalRole: {
                      merrillPhase: 'problem',
                      instructionalMove: 'introduce',
                      assessmentRole: 'none',
                      soloDepth: 'multistructural',
                    },
                    scaffolding: {
                      buildsOnSceneIds: [],
                      supportLevel: 'high',
                      workedExample: false,
                      commonMisconceptions: [],
                    },
                    reflectionDesign: {
                      reflectionInAction: false,
                      reflectionOnAction: false,
                      reframingPrompt: null,
                      judgmentPoint: null,
                    },
                    factualRisk: {
                      riskLevel: 'medium',
                      claimsNeedingReview: [],
                    },
                  },
                ],
              },
              review: {
                revisionCount: 1,
                reviewerResults: [
                  {
                    reviewer: 'sme',
                    verdict: 'pass',
                    overallScore: 4,
                    dimensionScores: { accuracy: 4 },
                    issues: [],
                    summary: 'SME review approved the blueprint.',
                  },
                  {
                    reviewer: 'merrill',
                    verdict: 'pass',
                    overallScore: 5,
                    dimensionScores: { sequence: 5 },
                    issues: [],
                    summary: 'Merrill review approved the blueprint.',
                  },
                  {
                    reviewer: 'schon',
                    verdict: 'pass',
                    overallScore: 4,
                    dimensionScores: { reflection: 4 },
                    issues: [],
                    summary: 'Schön review approved the blueprint.',
                  },
                ],
                adjudication: {
                  verdict: 'pass',
                  releaseForSceneGeneration: true,
                  blockingIssues: [],
                  requiredRevisions: [],
                  preserveConstraints: ['Keep the approved sequence intact.'],
                  summary: 'Approved for generation.',
                },
              },
            },
          }
        : {}),
    },
  };
}

afterEach(async () => {
  await Promise.all(
    Array.from(createdJobIds).map((jobId) =>
      fs.rm(path.join(CLASSROOM_JOBS_DIR, `${jobId}.json`), { force: true }),
    ),
  );
  createdJobIds.clear();
});

describe('classroom job store blueprint review summary', () => {
  it('persists a compact blueprint review summary on successful jobs', async () => {
    const jobId = makeJobId('job-blueprint');

    await createClassroomGenerationJob(jobId, {
      requirement: 'Teach autoscaling decisions for cloud learners.',
    });
    await markClassroomGenerationJobSucceeded(jobId, makeGenerateResult(true));

    const job = await readClassroomGenerationJob(jobId);

    expect(job?.result?.classroomId).toBe('classroom_1');
    expect(job?.result?.stageName).toBe('Autoscaling decisions');
    expect(job?.result?.blueprintReview).toEqual({
      revisionCount: 1,
      releaseForSceneGeneration: true,
      approvedSceneCount: 3,
      reviewerVerdicts: [
        { reviewer: 'sme', verdict: 'pass', score: 4 },
        { reviewer: 'merrill', verdict: 'pass', score: 5 },
        { reviewer: 'schon', verdict: 'pass', score: 4 },
      ],
    });
  });

  it('keeps successful job results backward-compatible when no blueprint is present', async () => {
    const jobId = makeJobId('job-plain');

    await createClassroomGenerationJob(jobId, {
      requirement: 'Teach a plain lesson without blueprint metadata.',
    });
    await markClassroomGenerationJobSucceeded(jobId, makeGenerateResult(false));

    const job = await readClassroomGenerationJob(jobId);

    expect(job?.result?.classroomId).toBe('classroom_1');
    expect(job?.result?.stageName).toBe('Autoscaling decisions');
    expect(job?.result?.blueprintReview).toBeUndefined();
  });
});
