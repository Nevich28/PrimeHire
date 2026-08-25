/**
 * Read models.
 *
 * Screens should not be joining ids to entities or re-parsing timestamps, so
 * everything the UI renders is shaped here first: inspections resolved against
 * their project and inspector, grouped into days, and ranked for assignment.
 * All of it is pure, which keeps the screens declarative and the logic testable.
 */

import { parseInstant, startOfZurichDay, zurichDayKey } from './datetime.ts';
import type { RuleContext } from './rules.ts';
import { INSPECTORS, PROJECTS } from './seed.ts';
import type { Inspection, Project, ResolvedInspection } from './types.ts';

export function buildRuleContext(inspections: Inspection[], now: number): RuleContext {
  return { inspections, projects: PROJECTS, inspectors: INSPECTORS, now };
}

/** A project that is missing from the reference data still has to render. */
const UNKNOWN_PROJECT: Project = {
  id: 'unknown',
  code: '—',
  name: 'Unknown project',
  client: '—',
  address: '—',
  status: 'active',
  siteNote: null,
  contact: { name: '—', phone: null },
};

export function resolveInspection(inspection: Inspection): ResolvedInspection {
  return {
    inspection,
    project: PROJECTS[inspection.projectId] ?? UNKNOWN_PROJECT,
    inspector: inspection.inspectorId ? (INSPECTORS[inspection.inspectorId] ?? null) : null,
    start: parseInstant(inspection.startsAt),
    end: parseInstant(inspection.endsAt),
  };
}

export function resolveAll(inspections: Inspection[]): ResolvedInspection[] {
  return inspections.map(resolveInspection).sort((a, b) => a.start - b.start);
}

export type DayGroup = {
  /** `YYYY-MM-DD` in Zurich. */
  key: string;
  /** Midnight of that day, for formatting the heading. */
  date: number;
  items: ResolvedInspection[];
};

export function groupByDay(items: ResolvedInspection[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const item of items) {
    const key = zurichDayKey(item.start);
    let group = groups.get(key);
    if (!group) {
      group = { key, date: startOfZurichDay(item.start), items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()].sort((a, b) => a.date - b.date);
}

/**
 * Schedule filters.
 *
 * "Upcoming" is anything still open — scheduled work that has not finished yet.
 * Work that is scheduled but whose slot has already passed stays in this list
 * rather than quietly dropping into history: it is a problem to resolve, not a
 * record of what happened.
 */
export function isOpen(item: ResolvedInspection): boolean {
  return item.inspection.status === 'scheduled';
}

/** Everything an inspector is booked on, for the workload view. */
export function workloadFor(
  inspectorId: string,
  items: ResolvedInspection[],
  now: number
): ResolvedInspection[] {
  return items.filter(
    (item) =>
      item.inspection.inspectorId === inspectorId && isOpen(item) && item.end >= now
  );
}
