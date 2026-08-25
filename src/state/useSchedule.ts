/**
 * The single hook every screen reads from.
 *
 * It joins the store to the domain layer once — resolve, evaluate, group — and
 * memoises the result, so no screen ever runs the rules engine twice and every
 * surface is looking at exactly the same verdict.
 */

import { useMemo } from 'react';

import { now } from '@/domain/clock';
import { dedupeSymmetricIssues, evaluateSchedule, groupIssuesByInspection } from '@/domain/rules';
import type { Issue, RuleContext } from '@/domain/rules';
import { buildRuleContext, resolveAll } from '@/domain/selectors';
import { useInspectionStore } from '@/domain/store';
import type { ResolvedInspection } from '@/domain/types';

export type Schedule = {
  items: ResolvedInspection[];
  byId: Record<string, ResolvedInspection>;
  /** Every issue, from every affected inspection's point of view. */
  issues: Issue[];
  /** One entry per actual problem: two-sided clashes counted once. */
  feedIssues: Issue[];
  issuesByInspection: Record<string, Issue[]>;
  context: RuleContext;
  now: number;
  hydrated: boolean;
};

export function useSchedule(): Schedule {
  const inspections = useInspectionStore((state) => state.inspections);
  const hydrated = useInspectionStore((state) => state.hydrated);
  const nowMs = now();

  return useMemo(() => {
    const items = resolveAll(inspections);
    const context = buildRuleContext(inspections, nowMs);
    const issues = evaluateSchedule(context);

    return {
      items,
      byId: Object.fromEntries(items.map((item) => [item.inspection.id, item])),
      issues,
      feedIssues: dedupeSymmetricIssues(issues),
      issuesByInspection: groupIssuesByInspection(issues),
      context,
      now: nowMs,
      hydrated,
    };
  }, [inspections, nowMs, hydrated]);
}
