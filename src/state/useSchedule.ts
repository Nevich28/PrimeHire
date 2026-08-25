/**
 * The single hook every screen reads from.
 *
 * It joins the store to the domain layer once — resolve, evaluate, group — and
 * memoises the result, so no screen ever runs the rules engine twice and every
 * surface is looking at exactly the same verdict.
 */

import { useMemo } from 'react';

import { now } from '@/domain/clock';
import { evaluateSchedule, groupIssuesByInspection } from '@/domain/rules';
import type { Issue, RuleContext } from '@/domain/rules';
import { buildRuleContext, countSchedule, resolveAll } from '@/domain/selectors';
import type { ScheduleCounts } from '@/domain/selectors';
import { useInspectionStore } from '@/domain/store';
import type { ResolvedInspection } from '@/domain/types';

export type Schedule = {
  items: ResolvedInspection[];
  byId: Record<string, ResolvedInspection>;
  issues: Issue[];
  issuesByInspection: Record<string, Issue[]>;
  counts: ScheduleCounts;
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
      issuesByInspection: groupIssuesByInspection(issues),
      counts: countSchedule(items, issues),
      context,
      now: nowMs,
      hydrated,
    };
  }, [inspections, nowMs, hydrated]);
}
