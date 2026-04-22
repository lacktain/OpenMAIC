import { nanoid } from 'nanoid';
import type { SceneOutline } from '@/lib/types/generation';
import {
  lessonBlueprintSchema,
  type LessonBlueprint,
  type LessonBlueprintScene,
  type LessonMode,
  type BlueprintOutcome,
  type BlueprintPrerequisite,
  type BlueprintTheme,
  type BlueprintReviewerResult,
  type BlueprintReviewIssue,
  type BlueprintAdjudicationResult,
  type PedagogicalSceneMetadata,
} from '@/lib/types/blueprint';
import type { AICallFn } from './pipeline-types';
import {
  getCloudCurriculumStrandById,
  isCloudCurriculumContext,
  matchCloudCurriculumStrands,
  matchCloudCurriculumStrandForOutline,
  type CloudCurriculumStrand,
} from './cloud-curriculum-profile';
import {
  adjudicateBlueprintWithPromptModule,
  reviewBlueprintWithPromptModules,
  reviseBlueprintWithPromptModule,
  type BlueprintReviewMode,
} from './lesson-blueprint-ai';

export interface CreateLessonBlueprintInput {
  requirement: string;
  languageDirective: string;
  outlines: SceneOutline[];
}

export interface BlueprintReviewGateResult {
  blueprint: LessonBlueprint;
  reviewerResults: BlueprintReviewerResult[];
  adjudication: BlueprintAdjudicationResult;
  approvedOutlines: SceneOutline[];
  revisionCount: number;
  reviewMode: BlueprintReviewMode;
  reviewRounds: BlueprintReviewRound[];
}

export interface BlueprintReviewRound {
  round: number;
  mode: BlueprintReviewMode;
  reviewerResults: BlueprintReviewerResult[];
  adjudication: BlueprintAdjudicationResult;
}

export interface BlueprintReviewGateOptions {
  maxRevisionRounds?: number;
  aiCall?: AICallFn;
  reviewMode?: BlueprintReviewMode;
  onReviewRound?: (reviewRound: BlueprintReviewRound) => Promise<void> | void;
}

export class BlueprintReviewError extends Error {
  readonly failureType: 'fail' | 'max_revisions';
  readonly reviewMode: BlueprintReviewMode;
  readonly revisionCount: number;
  readonly reviewRounds: BlueprintReviewRound[];
  readonly lastReviewerResults: BlueprintReviewerResult[];
  readonly lastAdjudication: BlueprintAdjudicationResult;

  constructor(params: {
    message: string;
    failureType: 'fail' | 'max_revisions';
    reviewMode: BlueprintReviewMode;
    revisionCount: number;
    reviewRounds: BlueprintReviewRound[];
    lastReviewerResults: BlueprintReviewerResult[];
    lastAdjudication: BlueprintAdjudicationResult;
  }) {
    super(params.message);
    this.name = 'BlueprintReviewError';
    this.failureType = params.failureType;
    this.reviewMode = params.reviewMode;
    this.revisionCount = params.revisionCount;
    this.reviewRounds = params.reviewRounds;
    this.lastReviewerResults = params.lastReviewerResults;
    this.lastAdjudication = params.lastAdjudication;
  }
}

const CLOUD_KEYWORDS = [
  'cloud',
  'azure',
  'aws',
  'gcp',
  'terraform',
  'kubernetes',
  'container',
  'containers',
  'hybrid network',
  'serverless',
  'vm',
  'virtual machine',
  'observability',
  'rbac',
  'compliance',
  'infrastructure',
  'devops',
  'sre',
];

const SKILL_KEYWORDS = [
  'build',
  'configure',
  'deploy',
  'operate',
  'troubleshoot',
  'lab',
  'hands-on',
  'exercise',
  'practice',
  'implement',
  'set up',
  'setup',
  'fix',
];

const CASE_KEYWORDS = ['case', 'scenario', 'incident', 'decision', 'trade-off', 'tradeoff'];
const EXAM_KEYWORDS = ['exam', 'test prep', 'interview', 'certification', 'assessment'];
const PROJECT_KEYWORDS = ['project', 'build a', 'deliverable', 'portfolio'];
const REFLECTION_KEYWORDS = [
  'reflect',
  'reflection',
  'justify',
  'judgment',
  'trade-off',
  'decision',
];

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function firstNonEmpty<T>(values: Array<T | undefined | null>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function clampScore(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score)));
}

function hasKeyword(text: string, keywords: string[]): boolean {
  const haystack = text.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

function topicFromRequirement(requirement: string, outlines: SceneOutline[]): string {
  return normalizeText(
    firstNonEmpty([
      outlines[0]?.teachingObjective,
      outlines[0]?.title,
      requirement.split(/[.!?\n]/)[0],
      requirement,
    ]) || 'Generated lesson',
  );
}

function inferLessonMode(requirement: string, outlines: SceneOutline[]): LessonMode {
  const joined = `${requirement} ${outlines.map((outline) => `${outline.title} ${outline.description}`).join(' ')}`;

  if (hasKeyword(joined, PROJECT_KEYWORDS) || outlines.some((outline) => outline.type === 'pbl')) {
    return 'project';
  }
  if (hasKeyword(joined, EXAM_KEYWORDS)) {
    return 'exam_prep';
  }
  if (hasKeyword(joined, CASE_KEYWORDS)) {
    return 'case';
  }
  if (
    hasKeyword(joined, SKILL_KEYWORDS) ||
    outlines.some((outline) => outline.type === 'interactive' || outline.type === 'quiz')
  ) {
    return 'skill';
  }
  if (outlines.some((outline) => outline.type === 'quiz' || outline.type === 'interactive')) {
    return 'mixed';
  }
  return 'concept';
}

function inferTargetLearner(
  requirement: string,
  lessonMode: LessonMode,
): LessonBlueprint['lessonIntent']['targetLearner'] {
  const text = requirement.toLowerCase();
  const isCloud = hasKeyword(text, CLOUD_KEYWORDS);
  const beginner = /beginner|intro|introduction|new to|grunnleggende|nybegynner/.test(text);
  const advanced = /advanced|expert|professional|senior|fordypning/.test(text);

  const level = isCloud
    ? 'second-year vocational learner'
    : beginner
      ? 'beginner'
      : advanced
        ? 'advanced'
        : lessonMode === 'exam_prep'
          ? 'assessment-ready learner'
          : 'intermediate learner';

  const program = isCloud ? 'cloud infrastructure' : 'general subject learning';
  const context = isCloud
    ? 'Vocationally oriented, scenario-based cloud operations and design work'
    : lessonMode === 'project'
      ? 'Project-based classroom context'
      : 'General classroom learning context';

  return { level, program, context };
}

function estimateLessonDurationMinutes(outlines: SceneOutline[]): number {
  const estimatedSeconds = outlines.reduce(
    (sum, outline) => sum + (outline.estimatedDuration || 120),
    0,
  );
  return Math.max(15, Math.round(estimatedSeconds / 60));
}

function inferOutcomeType(statement: string, lessonMode: LessonMode): BlueprintOutcome['type'] {
  const text = statement.toLowerCase();
  if (hasKeyword(text, REFLECTION_KEYWORDS)) return 'reflection';
  if (hasKeyword(text, SKILL_KEYWORDS) || lessonMode === 'skill' || lessonMode === 'project') {
    return 'skill';
  }
  if (hasKeyword(text, CASE_KEYWORDS) || /choose|decide|justify|evaluate|trade-off/.test(text)) {
    return 'judgment';
  }
  return 'knowledge';
}

function buildOutcomes(
  topic: string,
  requirement: string,
  lessonMode: LessonMode,
  outlines: SceneOutline[],
  cloudCurriculumStrands: CloudCurriculumStrand[],
): BlueprintOutcome[] {
  const outcomeStatements = new Map<string, BlueprintOutcome>();

  outlines.forEach((outline, index) => {
    const rawStatement = normalizeText(
      outline.teachingObjective ||
        outline.keyPoints[0] ||
        `Understand the role of ${outline.title.toLowerCase()} in ${topic.toLowerCase()}`,
    );
    if (!rawStatement) return;
    const key = rawStatement.toLowerCase();
    if (outcomeStatements.has(key)) return;

    outcomeStatements.set(key, {
      id: `lo_${outcomeStatements.size + 1}`,
      statement: rawStatement,
      type: inferOutcomeType(rawStatement, lessonMode),
      priority: index < 3 ? 'core' : 'supporting',
    });
  });

  if (outcomeStatements.size === 0) {
    outcomeStatements.set('default', {
      id: 'lo_1',
      statement: `Explain the core ideas behind ${topic}`,
      type: lessonMode === 'skill' ? 'skill' : 'knowledge',
      priority: 'core',
    });
  }

  if (isCloudCurriculumContext(requirement, outlines)) {
    const cloudOutcomes = [
      ...cloudCurriculumStrands.flatMap((strand) => strand.outcomes),
      'Explain the vocational choices involved in a stable and scalable cloud infrastructure solution',
      'Apply cloud knowledge to troubleshoot configuration, security, or reliability issues',
      'Reflect on user needs, business needs, and compliance when making cloud decisions',
    ];

    cloudOutcomes.forEach((statement) => {
      const key = statement.toLowerCase();
      if (!outcomeStatements.has(key)) {
        outcomeStatements.set(key, {
          id: `lo_${outcomeStatements.size + 1}`,
          statement,
          type: inferOutcomeType(statement, 'mixed'),
          priority: outcomeStatements.size < 3 ? 'core' : 'supporting',
        });
      }
    });
  }

  return Array.from(outcomeStatements.values()).slice(0, 6);
}

function buildPrerequisites(
  topic: string,
  lessonMode: LessonMode,
  outlines: SceneOutline[],
  cloudCurriculumStrands: CloudCurriculumStrand[],
): BlueprintPrerequisite[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const addCandidate = (statement: string) => {
    const normalized = normalizeText(statement);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push(statement);
  };

  if (cloudCurriculumStrands.length > 0) {
    cloudCurriculumStrands
      .flatMap((strand) => strand.prerequisites)
      .slice(0, 4)
      .forEach((statement) => addCandidate(statement));
  }

  const firstContentScene = outlines.find((outline) => outline.type !== 'quiz');
  firstContentScene?.keyPoints.slice(0, 2).forEach((keyPoint) => addCandidate(keyPoint));

  if (candidates.length === 0) {
    addCandidate(`Basic familiarity with the language and concepts used in ${topic}`);
  }

  if (lessonMode === 'skill' || lessonMode === 'project') {
    addCandidate('Willingness to try, observe feedback, and revise an approach during practice');
  }

  return candidates.slice(0, 3).map((statement, index) => ({
    id: `pre_${index + 1}`,
    statement,
    required: index === 0,
    canBeActivatedInLesson: index > 0,
  }));
}

function inferAssessmentRole(
  outline: SceneOutline,
  index: number,
  totalScenes: number,
): LessonBlueprintScene['pedagogicalRole']['assessmentRole'] {
  if (outline.type !== 'quiz') return 'none';
  if (index === 0) return 'diagnostic';
  if (index >= totalScenes - 2) return 'summative';
  return 'formative';
}

function inferMerrillPhase(
  outline: SceneOutline,
  index: number,
  totalScenes: number,
  lessonMode: LessonMode,
): LessonBlueprintScene['pedagogicalRole']['merrillPhase'] {
  if (index === 0 && outline.type === 'quiz') return 'activation';
  if (index === 0)
    return lessonMode === 'case' || lessonMode === 'project' ? 'problem' : 'activation';
  if (outline.type === 'interactive' || outline.type === 'pbl') return 'application';
  if (outline.type === 'quiz') return index >= totalScenes - 2 ? 'integration' : 'application';
  if (index >= totalScenes - 1) return 'integration';
  return 'demonstration';
}

function inferInstructionalMove(
  phase: LessonBlueprintScene['pedagogicalRole']['merrillPhase'],
  outline: SceneOutline,
): LessonBlueprintScene['pedagogicalRole']['instructionalMove'] {
  if (outline.type === 'quiz') return 'assessment';
  if (outline.type === 'interactive' || outline.type === 'pbl') return 'guided_practice';
  switch (phase) {
    case 'problem':
      return 'introduce';
    case 'activation':
      return 'introduce';
    case 'demonstration':
      return 'model';
    case 'application':
      return 'guided_practice';
    case 'integration':
      return 'reflection';
  }
}

function inferSoloDepth(
  index: number,
  totalScenes: number,
): LessonBlueprintScene['pedagogicalRole']['soloDepth'] {
  const ratio = totalScenes <= 1 ? 1 : index / (totalScenes - 1);
  if (ratio < 0.2) return 'unistructural';
  if (ratio < 0.5) return 'multistructural';
  if (ratio < 0.8) return 'relational';
  return 'extended_abstract';
}

function inferSupportLevel(
  index: number,
  totalScenes: number,
): LessonBlueprintScene['scaffolding']['supportLevel'] {
  const ratio = totalScenes <= 1 ? 1 : index / (totalScenes - 1);
  if (ratio < 0.34) return 'high';
  if (ratio < 0.67) return 'medium';
  return 'low';
}

function inferFactualRiskLevel(
  topic: string,
  outline: SceneOutline,
): LessonBlueprintScene['factualRisk']['riskLevel'] {
  const joined =
    `${topic} ${outline.title} ${outline.description} ${outline.keyPoints.join(' ')}`.toLowerCase();
  if (
    hasKeyword(joined, CLOUD_KEYWORDS) ||
    /standard|regulation|compliance|security|sla|pricing|policy/.test(joined)
  ) {
    return 'high';
  }
  if (/framework|formula|timeline|metric|version|benchmark|best practice/.test(joined)) {
    return 'medium';
  }
  return 'low';
}

function buildScenePlan(
  topic: string,
  lessonMode: LessonMode,
  outcomes: BlueprintOutcome[],
  outlines: SceneOutline[],
  cloudCurriculumStrands: CloudCurriculumStrand[],
): LessonBlueprintScene[] {
  return outlines.map((outline, index) => {
    const totalScenes = outlines.length;
    const phase = inferMerrillPhase(outline, index, totalScenes, lessonMode);
    const assessmentRole = inferAssessmentRole(outline, index, totalScenes);
    const relatedOutcome = outcomes[Math.min(index, outcomes.length - 1)] || outcomes[0];
    const matchedCloudStrand = matchCloudCurriculumStrandForOutline(
      outline,
      cloudCurriculumStrands,
    );
    const themeId = matchedCloudStrand?.id || `theme_${index + 1}`;
    const supportLevel = inferSupportLevel(index, totalScenes);
    const reflectionRelevant =
      phase === 'application' ||
      phase === 'integration' ||
      hasKeyword(outline.description, REFLECTION_KEYWORDS);
    const factualRiskLevel = inferFactualRiskLevel(topic, outline);

    return {
      id: outline.id,
      sourceSceneId: outline.id,
      title: outline.title,
      type: outline.type,
      order: index + 1,
      themeIds: [themeId],
      learningObjectiveIds: relatedOutcome ? [relatedOutcome.id] : [],
      description: outline.description,
      keyPoints: outline.keyPoints,
      teachingObjective: outline.teachingObjective,
      estimatedMinutes: Math.max(2, Math.round((outline.estimatedDuration || 120) / 60)),
      pedagogicalRole: {
        merrillPhase: phase,
        instructionalMove: inferInstructionalMove(phase, outline),
        assessmentRole,
        soloDepth: inferSoloDepth(index, totalScenes),
      },
      scaffolding: {
        buildsOnSceneIds: index > 0 ? [outlines[index - 1].id] : [],
        supportLevel,
        workedExample: phase === 'demonstration' && supportLevel === 'high',
        commonMisconceptions:
          factualRiskLevel === 'high'
            ? [
                `Over-simplifying ${outline.title.toLowerCase()} can lead to unsafe or misleading conclusions.`,
              ]
            : [],
      },
      reflectionDesign: {
        reflectionInAction:
          reflectionRelevant && (outline.type === 'interactive' || outline.type === 'pbl'),
        reflectionOnAction: phase === 'integration' || index === totalScenes - 1,
        reframingPrompt:
          phase === 'integration'
            ? `How would you adapt ${outline.title.toLowerCase()} if the learner's context changed?`
            : null,
        judgmentPoint: reflectionRelevant
          ? `Ask the learner to justify one decision related to ${outline.title.toLowerCase()}.`
          : null,
      },
      factualRisk: {
        riskLevel: factualRiskLevel,
        claimsNeedingReview: outline.keyPoints.slice(0, 3),
      },
      ...(outline.quizConfig ? { quizConfig: outline.quizConfig } : {}),
      ...(outline.widgetType ? { widgetType: outline.widgetType } : {}),
      ...(outline.widgetOutline
        ? { widgetOutline: outline.widgetOutline as Record<string, unknown> }
        : {}),
      ...(outline.pblConfig ? { pblConfig: outline.pblConfig } : {}),
    };
  });
}

function buildThemeGraph(scenePlan: LessonBlueprintScene[]): BlueprintTheme[] {
  const uniqueThemeIds = scenePlan.reduce<string[]>((themeIds, scene, index) => {
    const themeId = scene.themeIds[0] || `theme_${index + 1}`;
    if (!themeIds.includes(themeId)) {
      themeIds.push(themeId);
    }
    return themeIds;
  }, []);

  return uniqueThemeIds.map((themeId, index) => {
    const scene =
      scenePlan.find((candidate) => (candidate.themeIds[0] || `theme_${index + 1}`) === themeId) ||
      scenePlan[index];
    const cloudStrand = getCloudCurriculumStrandById(themeId);

    return {
      id: themeId,
      title: cloudStrand?.title || scene.title,
      dependsOn: index > 0 ? [uniqueThemeIds[index - 1]] : [],
      rationale: cloudStrand?.rationale
        ? cloudStrand.rationale
        : scene.pedagogicalRole.merrillPhase === 'integration'
          ? 'Closes the lesson by connecting and extending previous learning.'
          : scene.pedagogicalRole.merrillPhase === 'application'
            ? 'Lets the learner apply earlier ideas with guidance or feedback.'
            : index === 0
              ? 'Establishes the entry point and activates prior knowledge.'
              : 'Deepens or extends the previous scene in sequence.',
    };
  });
}

function normalizeScenePlan(
  scenePlan: LessonBlueprintScene[],
  topic: string,
  lessonMode: LessonMode,
): LessonBlueprintScene[] {
  return scenePlan
    .sort((a, b) => a.order - b.order)
    .map((scene, index, allScenes) => {
      const cloned = deepCopy(scene);
      const previousScene = allScenes[index - 1];
      const phase =
        cloned.pedagogicalRole?.merrillPhase ||
        inferMerrillPhase(
          {
            id: cloned.id,
            type: cloned.type,
            title: cloned.title,
            description: cloned.description,
            keyPoints: cloned.keyPoints,
            teachingObjective: cloned.teachingObjective,
            estimatedDuration: cloned.estimatedMinutes * 60,
            order: cloned.order,
            ...(cloned.quizConfig
              ? {
                  quizConfig: {
                    ...cloned.quizConfig,
                    questionTypes: cloned.quizConfig.questionTypes.map((type) =>
                      type === 'short_answer' ? 'text' : type,
                    ) as Array<'single' | 'multiple' | 'text'>,
                  },
                }
              : {}),
            ...(cloned.widgetType ? { widgetType: cloned.widgetType } : {}),
            ...(cloned.widgetOutline ? { widgetOutline: cloned.widgetOutline } : {}),
            ...(cloned.pblConfig ? { pblConfig: cloned.pblConfig } : {}),
          },
          index,
          allScenes.length,
          lessonMode,
        );

      cloned.order = index + 1;
      cloned.themeIds = cloned.themeIds.length > 0 ? cloned.themeIds : [`theme_${index + 1}`];
      cloned.learningObjectiveIds =
        cloned.learningObjectiveIds.length > 0 ? cloned.learningObjectiveIds : ['lo_1'];
      cloned.estimatedMinutes = Math.max(2, cloned.estimatedMinutes || 3);
      cloned.pedagogicalRole = {
        ...cloned.pedagogicalRole,
        merrillPhase: phase,
        instructionalMove:
          cloned.pedagogicalRole.instructionalMove ||
          (phase === 'integration'
            ? 'reflection'
            : cloned.type === 'quiz'
              ? 'assessment'
              : cloned.type === 'interactive' || cloned.type === 'pbl'
                ? 'guided_practice'
                : phase === 'demonstration'
                  ? 'model'
                  : 'introduce'),
        assessmentRole:
          cloned.pedagogicalRole.assessmentRole ||
          (cloned.type === 'quiz'
            ? index === 0
              ? 'diagnostic'
              : index >= allScenes.length - 2
                ? 'summative'
                : 'formative'
            : 'none'),
        soloDepth: cloned.pedagogicalRole.soloDepth || inferSoloDepth(index, allScenes.length),
      };
      cloned.scaffolding = {
        ...cloned.scaffolding,
        buildsOnSceneIds: previousScene ? [previousScene.id] : [],
        supportLevel: inferSupportLevel(index, allScenes.length),
        workedExample:
          cloned.scaffolding.workedExample ||
          (cloned.pedagogicalRole.merrillPhase === 'demonstration' && index <= 1),
      };
      cloned.reflectionDesign = {
        ...cloned.reflectionDesign,
        reflectionOnAction:
          cloned.reflectionDesign.reflectionOnAction ||
          cloned.pedagogicalRole.merrillPhase === 'integration',
        judgmentPoint:
          cloned.reflectionDesign.judgmentPoint ||
          (cloned.pedagogicalRole.merrillPhase === 'application' ||
          cloned.pedagogicalRole.merrillPhase === 'integration'
            ? `Ask the learner to justify one choice about ${topic.toLowerCase()}.`
            : null),
      };
      cloned.factualRisk = {
        riskLevel:
          cloned.factualRisk.riskLevel ||
          inferFactualRiskLevel(topic, {
            id: cloned.id,
            type: cloned.type,
            title: cloned.title,
            description: cloned.description,
            keyPoints: cloned.keyPoints,
            order: cloned.order,
          }),
        claimsNeedingReview:
          cloned.factualRisk.claimsNeedingReview.length > 0
            ? cloned.factualRisk.claimsNeedingReview
            : cloned.keyPoints.slice(0, 3),
      };
      return cloned;
    });
}

export function createLessonBlueprint(input: CreateLessonBlueprintInput): LessonBlueprint {
  const lessonMode = inferLessonMode(input.requirement, input.outlines);
  const topic = topicFromRequirement(input.requirement, input.outlines);
  const cloudCurriculumStrands = matchCloudCurriculumStrands(input.requirement, input.outlines);
  const outcomes = buildOutcomes(
    topic,
    input.requirement,
    lessonMode,
    input.outlines,
    cloudCurriculumStrands,
  );
  const scenePlan = normalizeScenePlan(
    buildScenePlan(topic, lessonMode, outcomes, input.outlines, cloudCurriculumStrands),
    topic,
    lessonMode,
  );

  return lessonBlueprintSchema.parse({
    schemaVersion: 'pedagogical-blueprint/v1',
    lessonIntent: {
      topic,
      targetLearner: inferTargetLearner(input.requirement, lessonMode),
      lessonMode,
      durationMinutes: estimateLessonDurationMinutes(input.outlines),
      languageDirective: input.languageDirective,
    },
    outcomes,
    prerequisites: buildPrerequisites(topic, lessonMode, input.outlines, cloudCurriculumStrands),
    themeGraph: buildThemeGraph(scenePlan),
    scenePlan,
  });
}

export function normalizeLessonBlueprint(blueprint: LessonBlueprint): LessonBlueprint {
  const topic = blueprint.lessonIntent.topic;
  const lessonMode = blueprint.lessonIntent.lessonMode;
  const scenePlan = normalizeScenePlan(blueprint.scenePlan, topic, lessonMode);

  return lessonBlueprintSchema.parse({
    ...blueprint,
    scenePlan,
    themeGraph: buildThemeGraph(scenePlan),
  });
}

function createIssue(
  severity: BlueprintReviewIssue['severity'],
  scope: BlueprintReviewIssue['scope'],
  targetId: string,
  type: string,
  message: string,
  suggestedRevision: string,
): BlueprintReviewIssue {
  return {
    id: `issue_${nanoid(8)}`,
    severity,
    scope,
    targetId,
    type,
    message,
    suggestedRevision,
  };
}

function presenceScore(present: boolean, partial = false): number {
  if (present) return 5;
  if (partial) return 3;
  return 2;
}

function reviewBlueprintWithSME(blueprint: LessonBlueprint): BlueprintReviewerResult {
  const issues: BlueprintReviewIssue[] = [];
  const firstScene = blueprint.scenePlan[0];
  const applicationIndex = blueprint.scenePlan.findIndex(
    (scene) => scene.pedagogicalRole.merrillPhase === 'application',
  );
  const demonstrationIndex = blueprint.scenePlan.findIndex(
    (scene) => scene.pedagogicalRole.merrillPhase === 'demonstration',
  );

  if (blueprint.outcomes.length === 0) {
    issues.push(
      createIssue(
        'major',
        'lesson',
        'lesson',
        'missing_outcomes',
        'The blueprint has no explicit learning outcomes to anchor later generation.',
        'Infer 2-4 concrete learning outcomes before full scene generation.',
      ),
    );
  }

  if (blueprint.prerequisites.length === 0) {
    issues.push(
      createIssue(
        'major',
        'lesson',
        'lesson',
        'missing_prerequisites',
        'The blueprint does not make prerequisite assumptions explicit.',
        'Add prerequisite statements or activation targets before detailed generation.',
      ),
    );
  }

  if (firstScene?.type === 'quiz') {
    issues.push(
      createIssue(
        'major',
        'scene',
        firstScene.id,
        'assessment_before_framing',
        'The lesson opens with assessment before topic framing or concept activation.',
        'Insert or convert the first scene into an activation/problem-framing scene.',
      ),
    );
  }

  if (
    applicationIndex !== -1 &&
    demonstrationIndex !== -1 &&
    applicationIndex < demonstrationIndex
  ) {
    issues.push(
      createIssue(
        'critical',
        'lesson',
        'lesson',
        'application_before_demonstration',
        'Application occurs before the lesson clearly demonstrates the concept or process.',
        'Move or insert a demonstration scene before application.',
      ),
    );
  }

  blueprint.scenePlan.forEach((scene) => {
    if (scene.keyPoints.length < 2) {
      issues.push(
        createIssue(
          'major',
          'scene',
          scene.id,
          'thin_scene_plan',
          `Scene "${scene.title}" has too few key points to support reliable generation.`,
          'Expand the scene with at least 2-3 concrete key points.',
        ),
      );
    }

    if (
      scene.factualRisk.riskLevel === 'high' &&
      scene.factualRisk.claimsNeedingReview.length === 0
    ) {
      issues.push(
        createIssue(
          'major',
          'scene',
          scene.id,
          'high_risk_without_claims',
          `Scene "${scene.title}" is marked high risk without any explicit claims to review.`,
          'List the claims or terminology that need factual verification.',
        ),
      );
    }
  });

  const criticalIssues = issues.filter((issue) => issue.severity === 'critical').length;
  const majorIssues = issues.filter((issue) => issue.severity === 'major').length;
  const factualCorrectness = clampScore(5 - criticalIssues - Math.min(majorIssues, 2));
  const conceptDecomposition = clampScore(
    5 - (issues.some((issue) => issue.type === 'thin_scene_plan') ? 2 : 0),
  );
  const prerequisiteOrdering = clampScore(
    5 - (issues.some((issue) => issue.type === 'missing_prerequisites') ? 2 : 0) - criticalIssues,
  );
  const terminology = clampScore(
    blueprint.scenePlan.some((scene) => scene.factualRisk.riskLevel === 'high') ? 4 : 5,
  );
  const curriculumFit = clampScore(
    blueprint.lessonIntent.targetLearner.program.includes('cloud') ? 5 : 4,
  );

  const overallScore = clampScore(
    (factualCorrectness +
      conceptDecomposition +
      prerequisiteOrdering +
      terminology +
      curriculumFit) /
      5,
  );

  const verdict =
    criticalIssues > 0 || overallScore <= 2 ? 'fail' : majorIssues > 0 ? 'revise' : 'pass';

  return {
    reviewer: 'sme',
    verdict,
    overallScore,
    dimensionScores: {
      factualCorrectness,
      conceptDecomposition,
      prerequisiteOrdering,
      terminology,
      curriculumFit,
    },
    issues,
    summary:
      verdict === 'pass'
        ? 'The blueprint is structurally explicit enough for factual review and downstream generation.'
        : 'The blueprint needs stronger prerequisite handling or claim visibility before expansion.',
  };
}

function reviewBlueprintWithMerrill(blueprint: LessonBlueprint): BlueprintReviewerResult {
  const issues: BlueprintReviewIssue[] = [];
  const phases = new Set(blueprint.scenePlan.map((scene) => scene.pedagogicalRole.merrillPhase));
  const firstTwo = blueprint.scenePlan
    .slice(0, 2)
    .map((scene) => scene.pedagogicalRole.merrillPhase);
  const lastTwo = blueprint.scenePlan.slice(-2).map((scene) => scene.pedagogicalRole.merrillPhase);
  const hasAssessment = blueprint.scenePlan.some(
    (scene) => scene.pedagogicalRole.assessmentRole !== 'none',
  );

  if (!firstTwo.some((phase) => phase === 'problem' || phase === 'activation')) {
    issues.push(
      createIssue(
        'major',
        'lesson',
        'lesson',
        'missing_activation',
        'The lesson does not clearly activate prior knowledge or frame a motivating problem early on.',
        'Add or repurpose an opening scene to activate prior knowledge and lesson relevance.',
      ),
    );
  }

  if (!phases.has('demonstration')) {
    issues.push(
      createIssue(
        'major',
        'lesson',
        'lesson',
        'missing_demonstration',
        'The blueprint lacks a clear demonstration or modelling phase.',
        'Insert a scene that models the concept, process, or reasoning step-by-step.',
      ),
    );
  }

  if (!phases.has('application')) {
    issues.push(
      createIssue(
        'major',
        'lesson',
        'lesson',
        'missing_application',
        'Learners are not given a clear opportunity to apply what was demonstrated.',
        'Add a guided or independent application scene before the wrap-up.',
      ),
    );
  }

  if (!lastTwo.includes('integration')) {
    issues.push(
      createIssue(
        'major',
        'lesson',
        'lesson',
        'missing_integration',
        'The lesson does not close with integration, transfer, or synthesis.',
        'Append or convert the final scene into a reflection/transfer scene.',
      ),
    );
  }

  if (!hasAssessment) {
    issues.push(
      createIssue(
        'minor',
        'lesson',
        'lesson',
        'missing_assessment_signal',
        'The blueprint does not include any explicit assessment role.',
        'Include a diagnostic, formative, or summative checkpoint.',
      ),
    );
  }

  const supportLevels = blueprint.scenePlan.map((scene) => scene.scaffolding.supportLevel);
  if (supportLevels.at(-1) === 'high') {
    issues.push(
      createIssue(
        'minor',
        'lesson',
        'lesson',
        'support_not_released',
        'Support remains high at the end of the lesson instead of tapering toward independence.',
        'Reduce end-of-lesson support or add a more independent closing task.',
      ),
    );
  }

  const problemCentered = presenceScore(firstTwo.some((phase) => phase === 'problem'));
  const activation = presenceScore(
    firstTwo.some((phase) => phase === 'activation'),
    firstTwo.length > 0,
  );
  const demonstration = presenceScore(phases.has('demonstration'));
  const application = presenceScore(phases.has('application'));
  const integration = presenceScore(lastTwo.includes('integration'));
  const scaffoldingCoherence = clampScore(
    5 - (issues.some((issue) => issue.type === 'support_not_released') ? 1 : 0),
  );
  const overallScore = clampScore(
    (problemCentered +
      activation +
      demonstration +
      application +
      integration +
      scaffoldingCoherence) /
      6,
  );
  const majorIssues = issues.filter((issue) => issue.severity === 'major').length;

  return {
    reviewer: 'merrill',
    verdict: majorIssues > 0 ? 'revise' : 'pass',
    overallScore,
    dimensionScores: {
      problemCentered,
      activation,
      demonstration,
      application,
      integration,
      scaffoldingCoherence,
    },
    issues,
    summary:
      majorIssues > 0
        ? 'The blueprint needs clearer activation, application, or integration to satisfy Merrill-aligned structure.'
        : 'The lesson has a recognizable instructional arc from activation through application and integration.',
  };
}

function reviewBlueprintWithSchon(blueprint: LessonBlueprint): BlueprintReviewerResult {
  const issues: BlueprintReviewIssue[] = [];
  const lessonMode = blueprint.lessonIntent.lessonMode;
  const requiresStrongReflection = ['skill', 'project', 'case', 'mixed'].includes(lessonMode);
  const applicationScenes = blueprint.scenePlan.filter(
    (scene) => scene.pedagogicalRole.merrillPhase === 'application',
  );
  const hasReflectionOnAction = blueprint.scenePlan.some(
    (scene) => scene.reflectionDesign.reflectionOnAction,
  );
  const hasJudgmentPoint = blueprint.scenePlan.some(
    (scene) => !!scene.reflectionDesign.judgmentPoint,
  );
  const hasActionFeedbackLoop = blueprint.scenePlan.some(
    (scene) => scene.type === 'quiz' || scene.type === 'interactive' || scene.type === 'pbl',
  );

  if (requiresStrongReflection && applicationScenes.length === 0) {
    issues.push(
      createIssue(
        'major',
        'lesson',
        'lesson',
        'missing_action_feedback_loop',
        'The lesson expects practice and judgment, but there is no action-feedback opportunity.',
        'Add a quiz, interactive task, or guided scenario that gives learners feedback on a choice.',
      ),
    );
  }

  if (!hasReflectionOnAction) {
    issues.push(
      createIssue(
        requiresStrongReflection ? 'major' : 'minor',
        'lesson',
        'lesson',
        'missing_reflection_on_action',
        'The blueprint does not explicitly prompt learners to reflect on what they did or learned.',
        'Add a final reflection or transfer scene with a concrete reflection prompt.',
      ),
    );
  }

  if (requiresStrongReflection && !hasJudgmentPoint) {
    issues.push(
      createIssue(
        'major',
        'lesson',
        'lesson',
        'missing_judgment_practice',
        'Learners are not asked to justify a choice, trade-off, or interpretation.',
        'Add a scene prompt that requires learners to justify one decision or trade-off.',
      ),
    );
  }

  if (requiresStrongReflection && !hasActionFeedbackLoop) {
    issues.push(
      createIssue(
        'major',
        'lesson',
        'lesson',
        'weak_reflective_loop',
        'The lesson lacks an action-feedback-reflection loop suitable for reflective practice.',
        'Introduce an application or checkpoint scene before the closing reflection.',
      ),
    );
  }

  applicationScenes.forEach((scene) => {
    if (!scene.reflectionDesign.reflectionInAction && requiresStrongReflection) {
      issues.push(
        createIssue(
          'minor',
          'scene',
          scene.id,
          'application_without_reflection',
          `Application scene "${scene.title}" does not explicitly support reflection-in-action.`,
          'Add an in-the-moment prompt that asks learners to observe, adapt, or justify a decision.',
        ),
      );
    }
  });

  const reflectionInAction = presenceScore(
    blueprint.scenePlan.some((scene) => scene.reflectionDesign.reflectionInAction),
    applicationScenes.length > 0,
  );
  const reflectionOnAction = presenceScore(hasReflectionOnAction);
  const reframing = presenceScore(
    blueprint.scenePlan.some((scene) => !!scene.reflectionDesign.reframingPrompt),
    hasJudgmentPoint,
  );
  const judgmentPractice = presenceScore(hasJudgmentPoint);
  const actionFeedbackLoop = presenceScore(hasActionFeedbackLoop);
  const overallScore = clampScore(
    (reflectionInAction + reflectionOnAction + reframing + judgmentPractice + actionFeedbackLoop) /
      5,
  );
  const majorIssues = issues.filter((issue) => issue.severity === 'major').length;

  return {
    reviewer: 'schon',
    verdict: majorIssues > 0 ? 'revise' : 'pass',
    overallScore,
    dimensionScores: {
      reflectionInAction,
      reflectionOnAction,
      reframing,
      judgmentPractice,
      actionFeedbackLoop,
    },
    issues,
    summary:
      majorIssues > 0
        ? 'The lesson needs more explicit learner judgment and reflection prompts before it is pedagogically ready.'
        : 'Reflective practice is visible enough for downstream scene generation.',
  };
}

export function reviewLessonBlueprint(blueprint: LessonBlueprint): BlueprintReviewerResult[] {
  return [
    reviewBlueprintWithSME(blueprint),
    reviewBlueprintWithMerrill(blueprint),
    reviewBlueprintWithSchon(blueprint),
  ];
}

export function adjudicateBlueprintReview(
  blueprint: LessonBlueprint,
  reviewerResults: BlueprintReviewerResult[],
): BlueprintAdjudicationResult {
  const allIssues = reviewerResults.flatMap((result) => result.issues);
  const blockingIssues = allIssues
    .filter((issue) => issue.severity === 'critical' || issue.severity === 'major')
    .map((issue) => issue.id);
  const preserveConstraints = [
    `Keep topic focus on ${blueprint.lessonIntent.topic}`,
    ...blueprint.outcomes
      .slice(0, 3)
      .map((outcome) => `Do not remove outcome ${outcome.id}: ${outcome.statement}`),
    ...blueprint.scenePlan
      .slice(0, 2)
      .map((scene) => `Preserve the relative order of scene ${scene.id}: ${scene.title}`),
  ];

  const requiredRevisions = allIssues
    .filter((issue) => issue.severity !== 'minor')
    .map((issue) => ({ targetId: issue.targetId, instruction: issue.suggestedRevision }));

  const verdict = reviewerResults.some((result) => result.verdict === 'fail')
    ? 'fail'
    : reviewerResults.some((result) => result.verdict === 'revise')
      ? 'revise'
      : 'pass';

  return {
    verdict,
    releaseForSceneGeneration: verdict === 'pass',
    blockingIssues,
    requiredRevisions,
    preserveConstraints,
    summary:
      verdict === 'pass'
        ? 'The reviewed blueprint can proceed to full scene generation.'
        : verdict === 'revise'
          ? 'The blueprint is promising but needs targeted revisions before scene generation.'
          : 'The blueprint should not proceed without deeper restructuring.',
  };
}

function createIntroScene(topic: string, learningObjectiveIds: string[]): LessonBlueprintScene {
  return {
    id: `scene_${nanoid(8)}`,
    title: `Why ${topic} matters`,
    type: 'slide',
    order: 1,
    themeIds: ['theme_intro'],
    learningObjectiveIds,
    description: `Frame the lesson around a realistic problem or motivation connected to ${topic}.`,
    keyPoints: [
      `Connect ${topic.toLowerCase()} to a concrete learner situation`,
      'Activate what learners already know',
      'State the question or challenge the lesson will solve',
    ],
    estimatedMinutes: 3,
    pedagogicalRole: {
      merrillPhase: 'problem',
      instructionalMove: 'introduce',
      assessmentRole: 'none',
      soloDepth: 'unistructural',
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
      judgmentPoint: `Ask learners why ${topic.toLowerCase()} matters in practice.`,
    },
    factualRisk: {
      riskLevel: 'low',
      claimsNeedingReview: [`Why ${topic} matters in the learner's context`],
    },
  };
}

function createApplicationScene(
  topic: string,
  learningObjectiveIds: string[],
  lessonMode: LessonMode,
): LessonBlueprintScene {
  const type = lessonMode === 'project' ? 'pbl' : 'quiz';

  return {
    id: `scene_${nanoid(8)}`,
    title: `Apply ${topic}`,
    type,
    order: 999,
    themeIds: ['theme_application'],
    learningObjectiveIds,
    description: `Give learners a guided chance to apply ${topic} in a realistic scenario before the lesson closes.`,
    keyPoints: hasKeyword(topic, CLOUD_KEYWORDS)
      ? [
          'Work through a realistic cloud scenario',
          'Choose and justify one configuration or operational decision',
          'Check the impact on stability, security, cost, or compliance',
        ]
      : [
          `Apply ${topic.toLowerCase()} to a concrete example`,
          'Explain why one choice works better than another',
          'Use feedback to refine the response',
        ],
    estimatedMinutes: 4,
    pedagogicalRole: {
      merrillPhase: 'application',
      instructionalMove: type === 'pbl' ? 'independent_practice' : 'guided_practice',
      assessmentRole: 'formative',
      soloDepth: 'relational',
    },
    scaffolding: {
      buildsOnSceneIds: [],
      supportLevel: 'medium',
      workedExample: false,
      commonMisconceptions: [
        'Treating the first plausible answer as sufficient without checking consequences.',
      ],
    },
    reflectionDesign: {
      reflectionInAction: true,
      reflectionOnAction: false,
      reframingPrompt: null,
      judgmentPoint: `Which decision would you make in this ${topic.toLowerCase()} scenario, and why?`,
    },
    factualRisk: {
      riskLevel: hasKeyword(topic, CLOUD_KEYWORDS) ? 'high' : 'medium',
      claimsNeedingReview: [
        `Operational choices and consequences in ${topic}`,
        'Any standards, metrics, or configuration claims used in the task',
      ],
    },
    ...(type === 'quiz'
      ? {
          quizConfig: {
            questionCount: 3,
            difficulty: 'medium' as const,
            questionTypes: ['single', 'multiple', 'text'] as const,
          },
        }
      : {
          pblConfig: {
            projectTopic: topic,
            projectDescription: `Complete a short scenario-based task that applies ${topic}.`,
            targetSkills: ['analysis', 'decision making', topic],
            issueCount: 2,
          },
        }),
  };
}

function createIntegrationScene(
  topic: string,
  learningObjectiveIds: string[],
): LessonBlueprintScene {
  return {
    id: `scene_${nanoid(8)}`,
    title: 'Reflect and transfer',
    type: 'slide',
    order: 1000,
    themeIds: ['theme_integration'],
    learningObjectiveIds,
    description: `Help learners consolidate ${topic} and transfer it to a new context.`,
    keyPoints: [
      `Summarize the most important idea about ${topic.toLowerCase()}`,
      'Reflect on one choice, trade-off, or misconception',
      'Name one next step or transfer scenario',
    ],
    estimatedMinutes: 3,
    pedagogicalRole: {
      merrillPhase: 'integration',
      instructionalMove: 'reflection',
      assessmentRole: 'none',
      soloDepth: 'extended_abstract',
    },
    scaffolding: {
      buildsOnSceneIds: [],
      supportLevel: 'low',
      workedExample: false,
      commonMisconceptions: [],
    },
    reflectionDesign: {
      reflectionInAction: false,
      reflectionOnAction: true,
      reframingPrompt: `How would your plan change if the context around ${topic.toLowerCase()} changed?`,
      judgmentPoint: `Which principle from ${topic.toLowerCase()} would you carry into the next task?`,
    },
    factualRisk: {
      riskLevel: 'low',
      claimsNeedingReview: [`Summary statements about ${topic}`],
    },
  };
}

function instructionIncludesAny(instructions: string[], keywords: string[]): boolean {
  return instructions.some((instruction) =>
    keywords.some((keyword) => instruction.includes(keyword)),
  );
}

export function reviseLessonBlueprint(
  blueprint: LessonBlueprint,
  reviewerResults: BlueprintReviewerResult[],
  adjudication?: BlueprintAdjudicationResult,
): LessonBlueprint {
  const revised = deepCopy(blueprint);
  let scenePlan = deepCopy(revised.scenePlan);
  const topic = revised.lessonIntent.topic;
  const lessonMode = revised.lessonIntent.lessonMode;
  const learningObjectiveIds = revised.outcomes.slice(0, 3).map((outcome) => outcome.id);
  const issueTypes = new Set(
    reviewerResults.flatMap((result) => result.issues.map((issue) => issue.type)),
  );
  const revisionInstructions = [
    ...reviewerResults.flatMap((result) => result.issues.map((issue) => issue.suggestedRevision)),
    ...(adjudication?.requiredRevisions.map((revision) => revision.instruction) || []),
  ].map((instruction) => normalizeText(instruction).toLowerCase());

  if (
    issueTypes.has('assessment_before_framing') ||
    issueTypes.has('missing_activation') ||
    instructionIncludesAny(revisionInstructions, [
      'activate prior knowledge',
      'motivating problem',
      'opening scene',
      'frame the lesson',
      'problem-framing',
    ])
  ) {
    const firstScene = scenePlan[0];
    if (!firstScene || firstScene.type === 'quiz') {
      scenePlan.unshift(createIntroScene(topic, learningObjectiveIds));
    } else {
      firstScene.pedagogicalRole.merrillPhase = 'problem';
      firstScene.pedagogicalRole.instructionalMove = 'introduce';
      firstScene.scaffolding.supportLevel = 'high';
      firstScene.reflectionDesign.judgmentPoint =
        firstScene.reflectionDesign.judgmentPoint ||
        `Why does ${topic.toLowerCase()} matter in practice?`;
    }
  }

  if (
    issueTypes.has('missing_demonstration') ||
    instructionIncludesAny(revisionInstructions, [
      'step-by-step',
      'worked example',
      'models the concept',
      'clear demonstration',
      'modelling phase',
    ])
  ) {
    const candidate =
      scenePlan.find(
        (scene, index) =>
          index > 0 &&
          scene.type === 'slide' &&
          scene.pedagogicalRole.merrillPhase !== 'activation',
      ) || scenePlan.find((scene) => scene.type === 'slide');
    if (candidate) {
      candidate.pedagogicalRole.merrillPhase = 'demonstration';
      candidate.pedagogicalRole.instructionalMove = 'model';
      candidate.scaffolding.workedExample = true;
      if (!candidate.keyPoints.some((point) => /example|worked|step-by-step/i.test(point))) {
        candidate.keyPoints = [
          ...candidate.keyPoints,
          'Show one worked example or modelled reasoning step-by-step',
        ];
      }
    }
  }

  if (
    issueTypes.has('missing_application') ||
    issueTypes.has('missing_action_feedback_loop') ||
    instructionIncludesAny(revisionInstructions, [
      'guided or independent application',
      'apply what was demonstrated',
      'action-feedback opportunity',
      'guided scenario',
      'application scene',
    ])
  ) {
    const hasApplication = scenePlan.some(
      (scene) => scene.pedagogicalRole.merrillPhase === 'application',
    );
    if (!hasApplication) {
      const integrationIndex = scenePlan.findIndex(
        (scene) => scene.pedagogicalRole.merrillPhase === 'integration',
      );
      const applicationScene = createApplicationScene(topic, learningObjectiveIds, lessonMode);
      if (integrationIndex === -1) {
        scenePlan.push(applicationScene);
      } else {
        scenePlan.splice(integrationIndex, 0, applicationScene);
      }
    }
  }

  if (
    issueTypes.has('missing_integration') ||
    issueTypes.has('missing_reflection_on_action') ||
    issueTypes.has('missing_judgment_practice') ||
    issueTypes.has('weak_reflective_loop') ||
    instructionIncludesAny(revisionInstructions, [
      'reflection/transfer scene',
      'closing reflection',
      'reflect on what they did',
      'justify one decision',
      'integration',
      'transfer',
    ])
  ) {
    const finalScene = scenePlan[scenePlan.length - 1];
    if (!finalScene || finalScene.pedagogicalRole.merrillPhase !== 'integration') {
      scenePlan.push(createIntegrationScene(topic, learningObjectiveIds));
    } else {
      finalScene.reflectionDesign.reflectionOnAction = true;
      finalScene.reflectionDesign.reframingPrompt =
        finalScene.reflectionDesign.reframingPrompt ||
        `How would you adapt ${topic.toLowerCase()} in a different context?`;
      finalScene.reflectionDesign.judgmentPoint =
        finalScene.reflectionDesign.judgmentPoint ||
        `Which decision from this lesson would you defend, and why?`;
    }
  }

  if (
    issueTypes.has('missing_prerequisites') ||
    instructionIncludesAny(revisionInstructions, ['prerequisite', 'prior knowledge'])
  ) {
    revised.prerequisites =
      revised.prerequisites.length > 0
        ? revised.prerequisites
        : [
            {
              id: 'pre_1',
              statement: `Basic familiarity with the terms and context used in ${topic}`,
              required: true,
              canBeActivatedInLesson: true,
            },
          ];
  }

  if (
    (issueTypes.has('missing_outcomes') ||
      instructionIncludesAny(revisionInstructions, ['learning outcome', 'explicit outcome'])) &&
    revised.outcomes.length === 0
  ) {
    revised.outcomes = [
      {
        id: 'lo_1',
        statement: `Explain the core ideas behind ${topic}`,
        type: lessonMode === 'skill' ? 'skill' : 'knowledge',
        priority: 'core',
      },
    ];
  }

  scenePlan = normalizeScenePlan(scenePlan, topic, lessonMode);

  revised.scenePlan = scenePlan;
  revised.themeGraph = buildThemeGraph(scenePlan);
  return normalizeLessonBlueprint(revised);
}

function buildPedagogicalMetadata(scene: LessonBlueprintScene): PedagogicalSceneMetadata {
  return {
    scenePlanId: scene.id,
    themeIds: scene.themeIds,
    learningObjectiveIds: scene.learningObjectiveIds,
    pedagogicalRole: scene.pedagogicalRole,
    scaffolding: scene.scaffolding,
    reflectionDesign: scene.reflectionDesign,
    factualRisk: scene.factualRisk,
    preserveConstraints: [
      `Preserve scene role: ${scene.pedagogicalRole.merrillPhase}`,
      ...scene.learningObjectiveIds.map((id) => `Keep learning objective ${id}`),
    ],
  };
}

export function blueprintToApprovedOutlines(blueprint: LessonBlueprint): SceneOutline[] {
  return blueprint.scenePlan.map((scene) => ({
    id: scene.id,
    type: scene.type,
    title: scene.title,
    description: scene.description,
    keyPoints: scene.keyPoints,
    teachingObjective: scene.teachingObjective,
    estimatedDuration: scene.estimatedMinutes * 60,
    order: scene.order,
    pedagogicalMetadata: buildPedagogicalMetadata(scene),
    ...(scene.quizConfig
      ? {
          quizConfig: {
            ...scene.quizConfig,
            questionTypes: scene.quizConfig.questionTypes.map((type) =>
              type === 'short_answer' ? 'text' : type,
            ) as Array<'single' | 'multiple' | 'text'>,
          },
        }
      : {}),
    ...(scene.widgetType ? { widgetType: scene.widgetType } : {}),
    ...(scene.widgetOutline ? { widgetOutline: scene.widgetOutline } : {}),
    ...(scene.pblConfig ? { pblConfig: scene.pblConfig } : {}),
  }));
}

function summarizeBlockingIssues(reviewerResults: BlueprintReviewerResult[]): string {
  return reviewerResults
    .flatMap((result) => result.issues)
    .filter((issue) => issue.severity !== 'minor')
    .map((issue) => issue.message)
    .slice(0, 4)
    .join(' | ');
}

export async function runBlueprintReviewGate(
  input: CreateLessonBlueprintInput,
  options?: BlueprintReviewGateOptions,
): Promise<BlueprintReviewGateResult> {
  const maxRevisionRounds = options?.maxRevisionRounds ?? 1;
  const reviewMode: BlueprintReviewMode = options?.aiCall
    ? options?.reviewMode || 'hybrid'
    : 'heuristic';
  let revisionCount = 0;
  let blueprint = createLessonBlueprint(input);
  const reviewRounds: BlueprintReviewRound[] = [];

  while (true) {
    const heuristicReviewerResults = reviewLessonBlueprint(blueprint);
    const reviewerResults =
      options?.aiCall && reviewMode !== 'heuristic'
        ? await reviewBlueprintWithPromptModules({
            blueprint,
            aiCall: options.aiCall,
            fallbackReviewerResults: heuristicReviewerResults,
            mode: reviewMode,
          })
        : heuristicReviewerResults;

    const heuristicAdjudication = adjudicateBlueprintReview(blueprint, reviewerResults);
    const adjudication =
      options?.aiCall && reviewMode !== 'heuristic'
        ? await adjudicateBlueprintWithPromptModule({
            blueprint,
            reviewerResults,
            fallbackAdjudication: heuristicAdjudication,
            aiCall: options.aiCall,
            mode: reviewMode,
          })
        : heuristicAdjudication;

    const reviewRound: BlueprintReviewRound = {
      round: reviewRounds.length + 1,
      mode: reviewMode,
      reviewerResults,
      adjudication,
    };
    reviewRounds.push(reviewRound);
    await options?.onReviewRound?.(reviewRound);

    if (adjudication.verdict === 'pass') {
      return {
        blueprint,
        reviewerResults,
        adjudication,
        approvedOutlines: blueprintToApprovedOutlines(blueprint),
        revisionCount,
        reviewMode,
        reviewRounds,
      };
    }

    if (adjudication.verdict === 'fail') {
      throw new BlueprintReviewError({
        message: `Blueprint review failed: ${summarizeBlockingIssues(reviewerResults) || adjudication.summary}`,
        failureType: 'fail',
        reviewMode,
        revisionCount,
        reviewRounds,
        lastReviewerResults: reviewerResults,
        lastAdjudication: adjudication,
      });
    }

    if (revisionCount >= maxRevisionRounds) {
      throw new BlueprintReviewError({
        message: `Blueprint review exceeded ${maxRevisionRounds} revision round(s): ${adjudication.summary}`,
        failureType: 'max_revisions',
        reviewMode,
        revisionCount,
        reviewRounds,
        lastReviewerResults: reviewerResults,
        lastAdjudication: adjudication,
      });
    }

    const promptRevision =
      options?.aiCall && reviewMode !== 'heuristic'
        ? await reviseBlueprintWithPromptModule({
            blueprint,
            reviewerResults,
            adjudication,
            aiCall: options.aiCall,
          })
        : null;

    blueprint = promptRevision
      ? normalizeLessonBlueprint(promptRevision)
      : reviseLessonBlueprint(blueprint, reviewerResults, adjudication);
    revisionCount += 1;
  }
}
