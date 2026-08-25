/**
 * The rules engine.
 *
 * This is the part of the product that replaces the phone calls. Operations
 * staff do not need a list of inspections — they can already get that from a
 * spreadsheet. What they cannot get from a spreadsheet is the answer to
 * "what is about to go wrong?".
 *
 * Every rule is a pure function of (inspection, the rest of the schedule, now).
 * Nothing here touches React, storage or navigation, which means the same code
 * powers two different surfaces:
 *
 *   - the attention feed on the schedule screen, run over everything;
 *   - live validation inside the scheduling form, run over a draft that has not
 *     been saved yet.
 *
 * One implementation, one set of messages, no chance of the dashboard and the
 * form disagreeing about what counts as a clash.
 */

import {
  formatTime,
  formatTimeRange,
  overlaps,
  parseInstant,
  toZurichParts,
  zurichDayKey,
} from './datetime.ts';
import { minutesOfDay, siteAccessFor } from './site-access.ts';
import type { Inspection, Inspector, Project } from './types.ts';

export type IssueSeverity = 'blocker' | 'warning' | 'info';

export type IssueCode =
  | 'unassigned'
  | 'overdue'
  | 'double_booked'
  | 'tight_travel'
  | 'site_access'
  | 'inspector_inactive'
  | 'project_not_active'
  | 'specialty_mismatch';

export type Issue = {
  code: IssueCode;
  severity: IssueSeverity;
  /** Short label for badges and filters. */
  label: string;
  /** One line written for a coordinator, not a developer. */
  message: string;
  inspectionId: string;
  /** The other inspection involved, when the issue is a clash. */
  relatedInspectionId?: string;
};

export type RuleContext = {
  inspections: Inspection[];
  projects: Record<string, Project>;
  inspectors: Record<string, Inspector>;
  now: number;
};

/**
 * How long an inspector realistically needs between two different sites.
 * The dataset has no coordinates, so a flat buffer is the honest approximation:
 * these are cantonal projects spread across eastern Switzerland, and 45 minutes
 * is a conservative floor rather than a routing estimate.
 */
export const TRAVEL_BUFFER_MINUTES = 45;

const SEVERITY_RANK: Record<IssueSeverity, number> = { blocker: 0, warning: 1, info: 2 };

/** `facade` and `facades` are the same discipline; the data uses both forms. */
function normaliseDiscipline(value: string): string {
  const lower = value.trim().toLowerCase();
  return lower.endsWith('s') ? lower.slice(0, -1) : lower;
}

function timeOfDayMinutes(instant: number): number {
  const parts = toZurichParts(instant);
  return parts.hour * 60 + parts.minute;
}

/** Last segment of a Swiss address is the town, which is what people say aloud. */
function townOf(address: string): string {
  const tail = address.split(',').pop()?.trim() ?? '';
  return tail.replace(/^\d{4}\s+/, '') || 'another site';
}

/**
 * Evaluate a single inspection against the rest of the schedule.
 *
 * `candidate` does not have to exist in `context.inspections` — the scheduling
 * form passes an unsaved draft through here to warn before anything is written.
 */
export function evaluateInspection(candidate: Inspection, context: RuleContext): Issue[] {
  const issues: Issue[] = [];
  if (candidate.status !== 'scheduled') return issues;

  const project = context.projects[candidate.projectId];
  const inspector = candidate.inspectorId ? context.inspectors[candidate.inspectorId] : null;
  const start = parseInstant(candidate.startsAt);
  const end = parseInstant(candidate.endsAt);

  const add = (issue: Omit<Issue, 'inspectionId'>) => {
    issues.push({ ...issue, inspectionId: candidate.id });
  };

  // 1. Nobody is going to site.
  if (!candidate.inspectorId) {
    add({
      code: 'unassigned',
      severity: 'blocker',
      label: 'No inspector',
      message: 'No inspector is assigned yet, so nobody is going to site.',
    });
  }

  // 2. The slot has already passed and the inspection was never closed out.
  if (end < context.now) {
    add({
      code: 'overdue',
      severity: 'blocker',
      label: 'Overdue',
      message: 'This slot has passed and the inspection was never completed or cancelled.',
    });
  }

  // 3. Work booked on a project that is not running.
  if (project && project.status !== 'active') {
    const state = project.status === 'on_hold' ? 'on hold' : 'completed';
    add({
      code: 'project_not_active',
      severity: 'warning',
      label: 'Project not active',
      message: `${project.code} is ${state}, so site work may not be taking place.`,
    });
  }

  if (inspector) {
    // 4. Assigned to somebody who has left the roster.
    if (!inspector.active) {
      add({
        code: 'inspector_inactive',
        severity: 'warning',
        label: 'Inspector inactive',
        message: `${inspector.name} is no longer an active inspector and needs replacing.`,
      });
    }

    // 5. Discipline the inspector is not signed off for.
    const required = normaliseDiscipline(candidate.type);
    const covered = inspector.specialties.map(normaliseDiscipline);
    if (!covered.includes(required)) {
      add({
        code: 'specialty_mismatch',
        severity: 'info',
        label: 'Outside specialty',
        message: `${inspector.name} is not signed off for ${candidate.type} work.`,
      });
    }

    // 6 & 7. Clashes with the same inspector's other commitments.
    for (const other of context.inspections) {
      if (other.id === candidate.id) continue;
      if (other.status !== 'scheduled') continue;
      if (other.inspectorId !== candidate.inspectorId) continue;

      const otherStart = parseInstant(other.startsAt);
      const otherEnd = parseInstant(other.endsAt);
      const otherProject = context.projects[other.projectId];
      const otherCode = otherProject?.code ?? 'another project';

      if (overlaps(start, end, otherStart, otherEnd)) {
        add({
          code: 'double_booked',
          severity: 'blocker',
          label: 'Double booked',
          message:
            `${inspector.name} is already booked on ${otherCode} ` +
            `from ${formatTimeRange(otherStart, otherEnd)}.`,
          relatedInspectionId: other.id,
        });
        continue;
      }

      // Two different sites on the same day with no time to travel between them.
      if (
        otherProject &&
        otherProject.id !== candidate.projectId &&
        zurichDayKey(otherStart) === zurichDayKey(start)
      ) {
        const gapMinutes =
          otherStart >= end
            ? Math.round((otherStart - end) / 60_000)
            : Math.round((start - otherEnd) / 60_000);
        if (gapMinutes < TRAVEL_BUFFER_MINUTES) {
          add({
            code: 'tight_travel',
            severity: 'warning',
            label: 'Tight travel',
            message:
              `Only ${gapMinutes} min between this and ${otherCode} ` +
              `in ${townOf(otherProject.address)}.`,
            relatedInspectionId: other.id,
          });
        }
      }
    }
  }

  // 8. Site access rules transcribed from the project's site note.
  const access = project ? siteAccessFor(project) : null;
  if (access) {
    const startMinutes = timeOfDayMinutes(start);
    const endMinutes = timeOfDayMinutes(end);
    const breaches: string[] = [];

    if (access.opensAt && startMinutes < minutesOfDay(access.opensAt)) {
      breaches.push(`starts at ${formatTime(start)}`);
    }
    if (access.latestArrival && startMinutes > minutesOfDay(access.latestArrival)) {
      breaches.push(`arrives at ${formatTime(start)}`);
    }
    if (access.closesAt && endMinutes > minutesOfDay(access.closesAt)) {
      breaches.push(`runs until ${formatTime(end)}`);
    }

    if (breaches.length > 0) {
      add({
        code: 'site_access',
        severity: 'warning',
        label: 'Site access',
        message: `This ${breaches.join(' and ')}, but ${access.reason}.`,
      });
    }
  }

  return issues;
}

/** Every issue across the whole schedule, worst first, then soonest first. */
export function evaluateSchedule(context: RuleContext): Issue[] {
  const issues = context.inspections.flatMap((inspection) =>
    evaluateInspection(inspection, context)
  );
  const startOf = new Map(
    context.inspections.map((i) => [i.id, parseInstant(i.startsAt)] as const)
  );
  return issues.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return (startOf.get(a.inspectionId) ?? 0) - (startOf.get(b.inspectionId) ?? 0);
  });
}

/**
 * Clashes are reported from both sides, because each inspection genuinely has
 * the problem and each card has to show it. A list of things to fix is a
 * different list: a double booking is one problem, not two, and resolving
 * either side clears both.
 */
const SYMMETRIC_CODES: IssueCode[] = ['double_booked', 'tight_travel'];

/**
 * Collapse each two-sided clash into a single entry.
 *
 * The surviving entry is the one on the earlier inspection, since
 * `evaluateSchedule` has already ordered them — which is also the one a
 * coordinator reads first.
 */
export function dedupeSymmetricIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (!issue.relatedInspectionId || !SYMMETRIC_CODES.includes(issue.code)) return true;
    const pair = [issue.inspectionId, issue.relatedInspectionId].sort().join('|');
    const key = `${issue.code}:${pair}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Issues bucketed by inspection id, for rendering badges on list rows. */
export function groupIssuesByInspection(issues: Issue[]): Record<string, Issue[]> {
  const grouped: Record<string, Issue[]> = {};
  for (const issue of issues) {
    (grouped[issue.inspectionId] ??= []).push(issue);
  }
  return grouped;
}

/** The most severe level present in a set of issues, or null when clean. */
export function worstSeverity(issues: Issue[]): IssueSeverity | null {
  if (issues.length === 0) return null;
  return issues.reduce<IssueSeverity>(
    (worst, issue) =>
      SEVERITY_RANK[issue.severity] < SEVERITY_RANK[worst] ? issue.severity : worst,
    'info'
  );
}

/* ------------------------------------------------------- inspector fit -- */

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
