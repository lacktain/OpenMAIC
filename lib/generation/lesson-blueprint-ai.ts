import { nanoid } from 'nanoid';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import {
  lessonBlueprintSchema,
  type LessonBlueprint,
  type BlueprintReviewerResult,
  type BlueprintReviewIssue,
  type BlueprintAdjudicationResult,
} from '@/lib/types/blueprint';
import { parseJsonResponse } from './json-repair';
import type { AICallFn } from './pipeline-types';

export type BlueprintReviewMode = 'heuristic' | 'prompt' | 'hybrid';

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function clampScore(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score)));
}

function mergeUniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function verdictRank(verdict: BlueprintReviewerResult['verdict']): number {
  switch (verdict) {
    case 'fail':
      return 3;
    case 'revise':
      return 2;
    case 'pass':
    default:
      return 1;
  }
}

function chooseStricterVerdict<
  T extends BlueprintReviewerResult['verdict'] | BlueprintAdjudicationResult['verdict'],
>(...verdicts: T[]): T {
  return verdicts.reduce((worst, current) =>
    verdictRank(current) > verdictRank(worst) ? current : worst,
  );
}

function issueFingerprint(issue: BlueprintReviewIssue): string {
  return [issue.scope, issue.targetId, issue.type, normalizeText(issue.message)].join('::');
}

function normalizeIssue(
  raw: unknown,
  fallback: BlueprintReviewIssue | undefined,
  index: number,
): BlueprintReviewIssue | null {
  if (!raw || typeof raw !== 'object') {
    return fallback || null;
  }

  const candidate = raw as Partial<BlueprintReviewIssue>;
  const message = typeof candidate.message === 'string' ? normalizeText(candidate.message) : '';
  if (!message) return fallback || null;

  const severity: BlueprintReviewIssue['severity'] =
    candidate.severity === 'critical' ||
    candidate.severity === 'major' ||
    candidate.severity === 'minor'
      ? candidate.severity
      : fallback?.severity || 'major';

  const scope: BlueprintReviewIssue['scope'] =
    candidate.scope === 'lesson' || candidate.scope === 'theme' || candidate.scope === 'scene'
      ? candidate.scope
      : fallback?.scope || 'lesson';

  return {
    id:
      typeof candidate.id === 'string' && candidate.id.trim().length > 0
        ? candidate.id
        : fallback?.id || `issue_${nanoid(8)}`,
    severity,
    scope,
    targetId:
      typeof candidate.targetId === 'string' && candidate.targetId.trim().length > 0
        ? candidate.targetId
        : fallback?.targetId || (scope === 'scene' ? `scene_${index + 1}` : 'lesson'),
    type:
      typeof candidate.type === 'string' && candidate.type.trim().length > 0
        ? candidate.type
        : fallback?.type || `prompt_issue_${index + 1}`,
    message,
    suggestedRevision:
      typeof candidate.suggestedRevision === 'string' &&
      candidate.suggestedRevision.trim().length > 0
        ? normalizeText(candidate.suggestedRevision)
        : fallback?.suggestedRevision ||
          'Revise this part of the blueprint with a clearer instructional fix.',
  };
}

function normalizeIssues(
  rawIssues: unknown,
  fallbackIssues: BlueprintReviewIssue[],
): BlueprintReviewIssue[] {
  if (!Array.isArray(rawIssues)) return fallbackIssues;

  const normalized = rawIssues
    .map((raw, index) => normalizeIssue(raw, fallbackIssues[index], index))
    .filter((issue): issue is BlueprintReviewIssue => !!issue);

  return normalized.length > 0 ? normalized : fallbackIssues;
}

function normalizeReviewerResult(
  raw: unknown,
  reviewer: BlueprintReviewerResult['reviewer'],
  fallback: BlueprintReviewerResult,
): BlueprintReviewerResult {
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const candidate = raw as Partial<BlueprintReviewerResult>;
  const fallbackDimensions = fallback.dimensionScores;
  const rawDimensions =
    candidate.dimensionScores && typeof candidate.dimensionScores === 'object'
      ? (candidate.dimensionScores as Record<string, unknown>)
      : {};

  const dimensionScores = Object.fromEntries(
    Object.keys(fallbackDimensions).map((key) => {
      const value = rawDimensions[key];
      const numeric = typeof value === 'number' ? value : fallbackDimensions[key];
      return [key, clampScore(numeric)];
    }),
  );

  const issues = normalizeIssues(candidate.issues, fallback.issues);
  const overallScore = clampScore(
    typeof candidate.overallScore === 'number'
      ? candidate.overallScore
      : Object.values(dimensionScores).reduce((sum, value) => sum + value, 0) /
          Math.max(1, Object.keys(dimensionScores).length),
  );

  const verdict: BlueprintReviewerResult['verdict'] =
    candidate.verdict === 'pass' || candidate.verdict === 'revise' || candidate.verdict === 'fail'
      ? candidate.verdict
      : fallback.verdict;

  return {
    reviewer,
    verdict,
    overallScore,
    dimensionScores,
    issues,
    summary:
      typeof candidate.summary === 'string' && candidate.summary.trim().length > 0
        ? normalizeText(candidate.summary)
        : fallback.summary,
  };
}

function mergeReviewerResults(
  promptResult: BlueprintReviewerResult,
  fallback: BlueprintReviewerResult,
): BlueprintReviewerResult {
  const allIssues = [...promptResult.issues, ...fallback.issues];
  const mergedIssues = Array.from(
    new Map(allIssues.map((issue) => [issueFingerprint(issue), issue])).values(),
  );

  const dimensionScores = Object.fromEntries(
    Object.keys(fallback.dimensionScores).map((key) => {
      const promptScore = promptResult.dimensionScores[key] ?? fallback.dimensionScores[key];
      const fallbackScore = fallback.dimensionScores[key];
      return [key, clampScore((promptScore + fallbackScore) / 2)];
    }),
  );

  const extraIssueCount = mergedIssues.length - promptResult.issues.length;

  return {
    reviewer: promptResult.reviewer,
    verdict: chooseStricterVerdict(promptResult.verdict, fallback.verdict),
    overallScore: clampScore((promptResult.overallScore + fallback.overallScore) / 2),
    dimensionScores,
    issues: mergedIssues,
    summary:
      extraIssueCount > 0
        ? `${promptResult.summary} Heuristic cross-check added ${extraIssueCount} corroborating issue${extraIssueCount === 1 ? '' : 's'}.`
        : promptResult.summary,
  };
}

function normalizeAdjudication(
  raw: unknown,
  fallback: BlueprintAdjudicationResult,
): BlueprintAdjudicationResult {
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const candidate = raw as Partial<BlueprintAdjudicationResult>;
  const verdict: BlueprintAdjudicationResult['verdict'] =
    candidate.verdict === 'pass' || candidate.verdict === 'revise' || candidate.verdict === 'fail'
      ? candidate.verdict
      : fallback.verdict;

  const requiredRevisions = Array.isArray(candidate.requiredRevisions)
    ? candidate.requiredRevisions
        .map((revision) => {
          if (!revision || typeof revision !== 'object') return null;
          const candidateRevision = revision as { targetId?: unknown; instruction?: unknown };
          const targetId =
            typeof candidateRevision.targetId === 'string' &&
            candidateRevision.targetId.trim().length > 0
              ? candidateRevision.targetId
              : 'lesson';
          const instruction =
            typeof candidateRevision.instruction === 'string' &&
            candidateRevision.instruction.trim().length > 0
              ? normalizeText(candidateRevision.instruction)
              : '';
          if (!instruction) return null;
          return { targetId, instruction };
        })
        .filter(
          (
            revision,
          ): revision is {
            targetId: string;
            instruction: string;
          } => !!revision,
        )
    : fallback.requiredRevisions;

  return {
    verdict,
    releaseForSceneGeneration:
      verdict === 'pass' &&
      Boolean(candidate.releaseForSceneGeneration ?? fallback.releaseForSceneGeneration),
    blockingIssues: Array.isArray(candidate.blockingIssues)
      ? mergeUniqueStrings(
          candidate.blockingIssues.filter((issue): issue is string => typeof issue === 'string'),
        )
      : fallback.blockingIssues,
    requiredRevisions:
      requiredRevisions.length > 0 || verdict === 'pass'
        ? requiredRevisions
        : fallback.requiredRevisions,
    preserveConstraints: Array.isArray(candidate.preserveConstraints)
      ? mergeUniqueStrings(
          candidate.preserveConstraints.filter(
            (constraint): constraint is string => typeof constraint === 'string',
          ),
        )
      : fallback.preserveConstraints,
    summary:
      typeof candidate.summary === 'string' && candidate.summary.trim().length > 0
        ? normalizeText(candidate.summary)
        : fallback.summary,
  };
}

function mergeAdjudications(
  promptAdjudication: BlueprintAdjudicationResult,
  fallback: BlueprintAdjudicationResult,
): BlueprintAdjudicationResult {
  const verdict = chooseStricterVerdict(promptAdjudication.verdict, fallback.verdict);

  return {
    verdict,
    releaseForSceneGeneration:
      verdict === 'pass' &&
      promptAdjudication.releaseForSceneGeneration &&
      fallback.releaseForSceneGeneration,
    blockingIssues: mergeUniqueStrings([
      ...promptAdjudication.blockingIssues,
      ...fallback.blockingIssues,
    ]),
    requiredRevisions: Array.from(
      new Map(
        [...promptAdjudication.requiredRevisions, ...fallback.requiredRevisions].map((revision) => [
          `${revision.targetId}::${normalizeText(revision.instruction)}`,
          revision,
        ]),
      ).values(),
    ),
    preserveConstraints: mergeUniqueStrings([
      ...promptAdjudication.preserveConstraints,
      ...fallback.preserveConstraints,
    ]),
    summary:
      promptAdjudication.summary === fallback.summary
        ? promptAdjudication.summary
        : `${promptAdjudication.summary} Heuristic adjudication remained aligned with the stricter verdict.`,
  };
}

async function callPrompt<T>(
  promptId: keyof typeof PROMPT_IDS,
  variables: Record<string, unknown>,
  aiCall: AICallFn,
): Promise<T | null> {
  const prompts = buildPrompt(PROMPT_IDS[promptId], variables);
  if (!prompts) return null;

  const response = await aiCall(prompts.system, prompts.user);
  return parseJsonResponse<T>(response);
}

export async function reviewBlueprintWithPromptModules(params: {
  blueprint: LessonBlueprint;
  aiCall: AICallFn;
  fallbackReviewerResults: BlueprintReviewerResult[];
  mode: Exclude<BlueprintReviewMode, 'heuristic'>;
}): Promise<BlueprintReviewerResult[]> {
  const { blueprint, aiCall, fallbackReviewerResults, mode } = params;

  const reviewerPromptIds: Record<BlueprintReviewerResult['reviewer'], keyof typeof PROMPT_IDS> = {
    sme: 'BLUEPRINT_REVIEW_SME',
    merrill: 'BLUEPRINT_REVIEW_MERRILL',
    schon: 'BLUEPRINT_REVIEW_SCHON',
  };

  return Promise.all(
    fallbackReviewerResults.map(async (fallback) => {
      const raw = await callPrompt<BlueprintReviewerResult>(
        reviewerPromptIds[fallback.reviewer],
        {
          blueprintJson: blueprint,
          heuristicReviewJson: fallback,
        },
        aiCall,
      ).catch(() => null);

      const normalized = normalizeReviewerResult(raw, fallback.reviewer, fallback);
      return mode === 'hybrid' ? mergeReviewerResults(normalized, fallback) : normalized;
    }),
  );
}

export async function adjudicateBlueprintWithPromptModule(params: {
  blueprint: LessonBlueprint;
  reviewerResults: BlueprintReviewerResult[];
  fallbackAdjudication: BlueprintAdjudicationResult;
  aiCall: AICallFn;
  mode: Exclude<BlueprintReviewMode, 'heuristic'>;
}): Promise<BlueprintAdjudicationResult> {
  const { blueprint, reviewerResults, fallbackAdjudication, aiCall, mode } = params;

  const raw = await callPrompt<BlueprintAdjudicationResult>(
    'BLUEPRINT_REVIEW_ADJUDICATOR',
    {
      blueprintJson: blueprint,
      reviewerResultsJson: reviewerResults,
      heuristicAdjudicationJson: fallbackAdjudication,
    },
    aiCall,
  ).catch(() => null);

  const normalized = normalizeAdjudication(raw, fallbackAdjudication);
  return mode === 'hybrid' ? mergeAdjudications(normalized, fallbackAdjudication) : normalized;
}

export async function reviseBlueprintWithPromptModule(params: {
  blueprint: LessonBlueprint;
  reviewerResults: BlueprintReviewerResult[];
  adjudication: BlueprintAdjudicationResult;
  aiCall: AICallFn;
}): Promise<LessonBlueprint | null> {
  const { blueprint, reviewerResults, adjudication, aiCall } = params;

  const raw = await callPrompt<LessonBlueprint>(
    'BLUEPRINT_REVIEW_REVISION',
    {
      blueprintJson: blueprint,
      reviewerResultsJson: reviewerResults,
      adjudicationJson: adjudication,
    },
    aiCall,
  ).catch(() => null);

  if (!raw) return null;

  try {
    return lessonBlueprintSchema.parse(raw);
  } catch {
    return null;
  }
}
