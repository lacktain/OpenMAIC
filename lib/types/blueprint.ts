import { z } from 'zod';

const sceneTypeSchema = z.enum(['slide', 'quiz', 'interactive', 'pbl']);
const widgetTypeSchema = z.enum(['simulation', 'diagram', 'code', 'game', 'visualization3d']);

export const lessonModeSchema = z.enum([
  'concept',
  'skill',
  'exam_prep',
  'project',
  'case',
  'mixed',
]);
export const outcomeTypeSchema = z.enum(['knowledge', 'skill', 'judgment', 'reflection']);
export const outcomePrioritySchema = z.enum(['core', 'supporting']);
export const merrillPhaseSchema = z.enum([
  'problem',
  'activation',
  'demonstration',
  'application',
  'integration',
]);
export const instructionalMoveSchema = z.enum([
  'introduce',
  'model',
  'guided_practice',
  'independent_practice',
  'reflection',
  'assessment',
  'transfer',
]);
export const assessmentRoleSchema = z.enum(['none', 'diagnostic', 'formative', 'summative']);
export const soloDepthSchema = z.enum([
  'prestructural',
  'unistructural',
  'multistructural',
  'relational',
  'extended_abstract',
]);
export const supportLevelSchema = z.enum(['high', 'medium', 'low']);
export const factualRiskLevelSchema = z.enum(['low', 'medium', 'high']);
export const reviewVerdictSchema = z.enum(['pass', 'revise', 'fail']);
export const reviewSeveritySchema = z.enum(['critical', 'major', 'minor']);
export const reviewScopeSchema = z.enum(['lesson', 'theme', 'scene']);

export const blueprintOutcomeSchema = z.object({
  id: z.string(),
  statement: z.string(),
  type: outcomeTypeSchema,
  priority: outcomePrioritySchema,
});

export const blueprintPrerequisiteSchema = z.object({
  id: z.string(),
  statement: z.string(),
  required: z.boolean(),
  canBeActivatedInLesson: z.boolean(),
});

export const blueprintThemeSchema = z.object({
  id: z.string(),
  title: z.string(),
  dependsOn: z.array(z.string()),
  rationale: z.string(),
});

export const pedagogicalRoleSchema = z.object({
  merrillPhase: merrillPhaseSchema,
  instructionalMove: instructionalMoveSchema,
  assessmentRole: assessmentRoleSchema,
  soloDepth: soloDepthSchema,
});

export const scaffoldingSchema = z.object({
  buildsOnSceneIds: z.array(z.string()),
  supportLevel: supportLevelSchema,
  workedExample: z.boolean(),
  commonMisconceptions: z.array(z.string()),
});

export const reflectionDesignSchema = z.object({
  reflectionInAction: z.boolean(),
  reflectionOnAction: z.boolean(),
  reframingPrompt: z.string().nullable(),
  judgmentPoint: z.string().nullable(),
});

export const factualRiskSchema = z.object({
  riskLevel: factualRiskLevelSchema,
  claimsNeedingReview: z.array(z.string()),
});

export const pedagogicalSceneMetadataSchema = z.object({
  scenePlanId: z.string(),
  themeIds: z.array(z.string()),
  learningObjectiveIds: z.array(z.string()),
  pedagogicalRole: pedagogicalRoleSchema,
  scaffolding: scaffoldingSchema,
  reflectionDesign: reflectionDesignSchema,
  factualRisk: factualRiskSchema,
  preserveConstraints: z.array(z.string()),
});

export const quizConfigSchema = z.object({
  questionCount: z.number().int().positive(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  questionTypes: z.array(z.enum(['single', 'multiple', 'text', 'short_answer'])),
});

export const pblConfigSchema = z.object({
  projectTopic: z.string(),
  projectDescription: z.string(),
  targetSkills: z.array(z.string()),
  issueCount: z.number().int().positive().optional(),
});

export const lessonBlueprintSceneSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: sceneTypeSchema,
  order: z.number().int().positive(),
  themeIds: z.array(z.string()),
  learningObjectiveIds: z.array(z.string()),
  description: z.string(),
  keyPoints: z.array(z.string()),
  teachingObjective: z.string().optional(),
  estimatedMinutes: z.number().positive(),
  pedagogicalRole: pedagogicalRoleSchema,
  scaffolding: scaffoldingSchema,
  reflectionDesign: reflectionDesignSchema,
  factualRisk: factualRiskSchema,
  quizConfig: quizConfigSchema.optional(),
  widgetType: widgetTypeSchema.optional(),
  widgetOutline: z.record(z.string(), z.unknown()).optional(),
  pblConfig: pblConfigSchema.optional(),
  sourceSceneId: z.string().optional(),
});

export const lessonBlueprintSchema = z.object({
  schemaVersion: z.literal('pedagogical-blueprint/v1'),
  lessonIntent: z.object({
    topic: z.string(),
    targetLearner: z.object({
      level: z.string(),
      program: z.string(),
      context: z.string(),
    }),
    lessonMode: lessonModeSchema,
    durationMinutes: z.number().positive(),
    languageDirective: z.string(),
  }),
  outcomes: z.array(blueprintOutcomeSchema),
  prerequisites: z.array(blueprintPrerequisiteSchema),
  themeGraph: z.array(blueprintThemeSchema),
  scenePlan: z.array(lessonBlueprintSceneSchema),
});

export const blueprintReviewIssueSchema = z.object({
  id: z.string(),
  severity: reviewSeveritySchema,
  scope: reviewScopeSchema,
  targetId: z.string(),
  type: z.string(),
  message: z.string(),
  suggestedRevision: z.string(),
});

export const blueprintReviewerResultSchema = z.object({
  reviewer: z.enum(['sme', 'merrill', 'schon']),
  verdict: reviewVerdictSchema,
  overallScore: z.number().min(1).max(5),
  dimensionScores: z.record(z.string(), z.number().min(1).max(5)),
  issues: z.array(blueprintReviewIssueSchema),
  summary: z.string(),
});

export const blueprintAdjudicationResultSchema = z.object({
  verdict: reviewVerdictSchema,
  releaseForSceneGeneration: z.boolean(),
  blockingIssues: z.array(z.string()),
  requiredRevisions: z.array(
    z.object({
      targetId: z.string(),
      instruction: z.string(),
    }),
  ),
  preserveConstraints: z.array(z.string()),
  summary: z.string(),
});

export type LessonMode = z.infer<typeof lessonModeSchema>;
export type BlueprintOutcome = z.infer<typeof blueprintOutcomeSchema>;
export type BlueprintPrerequisite = z.infer<typeof blueprintPrerequisiteSchema>;
export type BlueprintTheme = z.infer<typeof blueprintThemeSchema>;
export type PedagogicalRole = z.infer<typeof pedagogicalRoleSchema>;
export type ScaffoldingPlan = z.infer<typeof scaffoldingSchema>;
export type ReflectionDesign = z.infer<typeof reflectionDesignSchema>;
export type FactualRisk = z.infer<typeof factualRiskSchema>;
export type PedagogicalSceneMetadata = z.infer<typeof pedagogicalSceneMetadataSchema>;
export type LessonBlueprintScene = z.infer<typeof lessonBlueprintSceneSchema>;
export type LessonBlueprint = z.infer<typeof lessonBlueprintSchema>;
export type BlueprintReviewIssue = z.infer<typeof blueprintReviewIssueSchema>;
export type BlueprintReviewerResult = z.infer<typeof blueprintReviewerResultSchema>;
export type BlueprintAdjudicationResult = z.infer<typeof blueprintAdjudicationResultSchema>;

export interface PedagogicalBlueprintRecord {
  lessonBlueprint: LessonBlueprint;
  review: {
    revisionCount: number;
    reviewerResults: BlueprintReviewerResult[];
    adjudication: BlueprintAdjudicationResult;
  };
}
