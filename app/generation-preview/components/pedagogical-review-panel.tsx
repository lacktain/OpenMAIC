'use client';

import { ArrowRight, CheckCircle2, AlertTriangle, XCircle, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PedagogicalPreflightResult } from '@/lib/generation/pedagogical-preflight';

function verdictTone(verdict: 'pass' | 'revise' | 'fail') {
  switch (verdict) {
    case 'pass':
      return {
        badgeClass:
          'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        cardClass: 'border-emerald-500/20 bg-emerald-500/[0.04]',
        icon: CheckCircle2,
      };
    case 'revise':
      return {
        badgeClass: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        cardClass: 'border-amber-500/20 bg-amber-500/[0.04]',
        icon: AlertTriangle,
      };
    case 'fail':
    default:
      return {
        badgeClass: 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300',
        cardClass: 'border-red-500/20 bg-red-500/[0.04]',
        icon: XCircle,
      };
  }
}

export function PedagogicalReviewPanel({
  review,
  waitingForApproval,
  onApprove,
}: {
  review: PedagogicalPreflightResult;
  waitingForApproval: boolean;
  onApprove: () => void;
}) {
  const approvedOutlinePreview = review.approvedOutlines.slice(0, 6);

  return (
    <div className="mt-6 w-full max-w-3xl space-y-4 rounded-3xl border border-slate-200/70 bg-white/85 p-5 text-left shadow-xl backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            >
              Pedagogical checkpoint passed
            </Badge>
            <Badge variant="outline">Mode: {review.reviewMode}</Badge>
            <Badge variant="outline">Revision rounds: {review.revisionCount}</Badge>
            <Badge variant="outline">Approved scenes: {review.approvedOutlines.length}</Badge>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Teacher review before generation continues
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              The outline has been reviewed through SME, Merrill, and Schön lenses. Inspect the
              verdicts below, then explicitly approve before scene generation starts.
            </p>
          </div>
        </div>

        <Button onClick={onApprove} className="md:min-w-56" disabled={!waitingForApproval}>
          Approve blueprint and continue
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {review.reviewerResults.map((result) => {
          const tone = verdictTone(result.verdict);
          const VerdictIcon = tone.icon;
          return (
            <div
              key={result.reviewer}
              className={cn('rounded-2xl border p-4 shadow-sm', tone.cardClass)}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {result.reviewer}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {result.overallScore}/5
                  </p>
                </div>
                <Badge variant="outline" className={tone.badgeClass}>
                  <VerdictIcon className="mr-1 size-3" />
                  {result.verdict}
                </Badge>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200">{result.summary}</p>
              {result.issues.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {result.issues.slice(0, 2).map((issue) => (
                    <li key={issue.id} className="flex gap-2">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-current opacity-70" />
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.95fr]">
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="mb-2 flex items-center gap-2">
            <ListChecks className="size-4 text-slate-500" />
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">Review timeline</h4>
          </div>
          <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {review.events.map((event, index) => (
              <div key={`${event.phase}-${event.round ?? 'final'}-${index}`} className="flex gap-3">
                <div className="mt-2 size-2 shrink-0 rounded-full bg-slate-400/70" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{event.message}</p>
                  {event.reviewerVerdicts && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {event.reviewerVerdicts
                        .map(
                          (verdict) =>
                            `${verdict.reviewer}: ${verdict.verdict} (${verdict.score}/5)`,
                        )
                        .join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <h4 className="font-semibold text-slate-900 dark:text-slate-100">
            Approved outline preview
          </h4>
          <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {approvedOutlinePreview.map((outline) => (
              <div
                key={outline.id}
                className="rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/70"
              >
                <p className="font-medium text-slate-900 dark:text-slate-100">{outline.title}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {outline.pedagogicalMetadata?.pedagogicalRole.merrillPhase || 'unclassified'} ·{' '}
                  {outline.type}
                </p>
              </div>
            ))}
            {review.approvedOutlines.length > approvedOutlinePreview.length && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                +{review.approvedOutlines.length - approvedOutlinePreview.length} more approved
                scene
                {review.approvedOutlines.length - approvedOutlinePreview.length === 1 ? '' : 's'}
              </p>
            )}
          </div>

          {review.adjudication.preserveConstraints.length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Preserve constraints
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {review.adjudication.preserveConstraints.slice(0, 3).map((constraint) => (
                  <li key={constraint} className="flex gap-2">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-current opacity-70" />
                    <span>{constraint}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
