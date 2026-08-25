/**
 * Read models.
 *
 * Screens should not be joining ids to entities or re-parsing timestamps, so
 * everything the UI renders is shaped here first: inspections resolved against
 * their project and inspector, grouped into days, and ranked for assignment.
 * All of it is pure, which keeps the screens declarative and the logic testable.
 */

import { parseInstant, startOfZurichDay, zurichDayKey } from './datetime.ts';
import { evaluateInspection } from './rules.ts';
import type { Issue, RuleContext } from './rules.ts';
import { INSPECTORS, PROJECTS } from './seed.ts';
import type { Inspection, Inspector, Project, ResolvedInspection } from './types.ts';

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

export function isHistory(item: ResolvedInspection, now: number): boolean {
  return item.inspection.status !== 'scheduled' || item.end < now;
}

export type ScheduleCounts = {
  open: number;
  unassigned: number;
  blockers: number;
  warnings: number;
};

export function countSchedule(items: ResolvedInspection[], issues: Issue[]): ScheduleCounts {
  const openItems = items.filter(isOpen);
  return {
    open: openItems.length,
    unassigned: openItems.filter((item) => !item.inspection.inspectorId).length,
    blockers: issues.filter((issue) => issue.severity === 'blocker').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
  };
}

export type InspectorOption = {
  inspector: Inspector;
  /** Nothing else booked in this slot. */
  available: boolean;
  /** Signed off for the discipline this inspection needs. */
  matchesSpecialty: boolean;
  /** What would be wrong if this person took the job. */
  issues: Issue[];
};

/**
 * Rank inspectors for a slot.
 *
 * This is the moment the product is most useful: somebody has to go to site
 * tomorrow morning and the coordinator needs to know who actually can. Rather
 * than offering a flat alphabetical list, every candidate is run through the
 * rules engine against the draft and sorted by how well they fit.
 *
 * Inactive inspectors are excluded, except when one is already assigned — they
 * still have to be visible so they can be replaced.
 */
export function rankInspectorsForSlot(
  candidate: Inspection,
  context: RuleContext
): InspectorOption[] {
  const options = Object.values(context.inspectors)
    .filter((inspector) => inspector.active || inspector.id === candidate.inspectorId)
    .map((inspector) => {
      const issues = evaluateInspection({ ...candidate, inspectorId: inspector.id }, context).filter(
        (issue) =>
          issue.code === 'double_booked' ||
          issue.code === 'tight_travel' ||
          issue.code === 'specialty_mismatch' ||
          issue.code === 'inspector_inactive'
      );
      return {
        inspector,
        available: !issues.some((issue) => issue.code === 'double_booked'),
        matchesSpecialty: !issues.some((issue) => issue.code === 'specialty_mismatch'),
        issues,
      };
    });

  return options.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    if (a.matchesSpecialty !== b.matchesSpecialty) return a.matchesSpecialty ? -1 : 1;
    if (a.issues.length !== b.issues.length) return a.issues.length - b.issues.length;
    return a.inspector.name.localeCompare(b.inspector.name);
  });
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
