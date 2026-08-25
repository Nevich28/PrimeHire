/**
 * Suggested fixes.
 *
 * The rules engine says what is wrong. For most of what it finds there is one
 * obvious way to put it right, and the product already knows enough to work it
 * out: who is free and qualified tomorrow morning, or which hour of the day
 * actually fits inside a site's access window.
 *
 * A suggestion is only offered when it survives the same rules engine that
 * produced the problem — the fix must remove the issue it targets and must not
 * introduce a blocker of its own. Anything the product cannot resolve cleanly
 * gets no button, because a wrong one-tap fix is worse than none.
 */

import { formatTimeRange, fromZurichWallClock, parseInstant, toZurichIso, toZurichParts } from './datetime.ts';
import { evaluateInspection, rankInspectorsForSlot } from './rules.ts';
import type { Issue, RuleContext } from './rules.ts';
import { minutesOfDay, siteAccessFor } from './site-access.ts';
import type { Inspection } from './types.ts';

export type Resolution = {
  /** Button text, e.g. `Assign David Baumann`. */
  label: string;
  /** Sentence describing what will happen, for the undo message. */
  description: string;
  /** The inspection as it would be after applying the fix. */
  next: Inspection;
};

/** Does this candidate still have the issue we are trying to remove? */
function stillHas(candidate: Inspection, code: Issue['code'], context: RuleContext): boolean {
  return evaluateInspection(candidate, context).some((issue) => issue.code === code);
}

function introducesBlocker(candidate: Inspection, context: RuleContext): boolean {
  return evaluateInspection(candidate, context).some((issue) => issue.severity === 'blocker');
}

/**
 * Somebody who is free, qualified, and does not create a new problem.
 *
 * `rankInspectorsForSlot` already orders candidates the way the picker shows
 * them, so this takes the best one and then verifies it rather than trusting
 * the ranking.
 */
function suggestInspector(
  inspection: Inspection,
  context: RuleContext
): { inspectorId: string; name: string } | null {
  const best = rankInspectorsForSlot(inspection, context).find(
    (option) => option.available && option.matchesSpecialty && option.issues.length === 0
  );
  return best ? { inspectorId: best.inspector.id, name: best.inspector.name } : null;
}

/**
 * The latest slot of the same length that fits inside the site's access window.
 *
 * Later is better than earlier: work on site tends to run on, so pulling an
 * inspection forward by more than necessary is its own kind of wrong. The slot
 * has to start no earlier than the site opens, arrive before the last permitted
 * arrival, and finish before the gate closes.
 */
function suggestSlot(inspection: Inspection, context: RuleContext): Inspection | null {
  const project = context.projects[inspection.projectId];
  const access = project ? siteAccessFor(project) : null;
  if (!access) return null;

  const start = parseInstant(inspection.startsAt);
  const end = parseInstant(inspection.endsAt);
  const durationMinutes = Math.round((end - start) / 60_000);

  const opens = access.opensAt ? minutesOfDay(access.opensAt) : 0;
  const closes = access.closesAt ? minutesOfDay(access.closesAt) : 24 * 60;
  const latestArrival = access.latestArrival ? minutesOfDay(access.latestArrival) : closes;

  const latestStart = Math.min(latestArrival, closes - durationMinutes);
  if (latestStart < opens) return null; // The visit cannot fit in the window at all.

  const parts = toZurichParts(start);
  const currentStart = parts.hour * 60 + parts.minute;
  if (currentStart <= latestStart && currentStart >= opens) return null; // Already fits.

  const targetStart = Math.max(opens, latestStart);
  const nextStart = fromZurichWallClock(
    parts.year,
    parts.month,
    parts.day,
    Math.floor(targetStart / 60),
    targetStart % 60
  );

  return {
    ...inspection,
    startsAt: toZurichIso(nextStart),
    endsAt: toZurichIso(nextStart + durationMinutes * 60_000),
  };
}

/** The one-tap fix for an issue, or null when there is no clean one. */
export function suggestResolution(
  issue: Issue,
  inspection: Inspection,
  context: RuleContext
): Resolution | null {
  switch (issue.code) {
    // Nobody is going: find somebody who can.
    case 'unassigned':
    // Already booked elsewhere: the fix is the same, somebody else goes.
    case 'double_booked':
    case 'inspector_inactive': {
      const candidate = suggestInspector(inspection, context);
      if (!candidate) return null;
      const next = { ...inspection, inspectorId: candidate.inspectorId };
      if (stillHas(next, issue.code, context) || introducesBlocker(next, context)) return null;
      return {
        label: `Assign ${candidate.name}`,
        description: `${candidate.name} is now going to ${context.projects[inspection.projectId]?.code ?? 'site'}.`,
        next,
      };
    }

    // Outside the site's access window: move it to an hour that fits.
    case 'site_access': {
      const next = suggestSlot(inspection, context);
      if (!next) return null;
      if (stillHas(next, 'site_access', context) || introducesBlocker(next, context)) return null;
      const start = parseInstant(next.startsAt);
      const end = parseInstant(next.endsAt);
      return {
        label: `Move to ${formatTimeRange(start, end)}`,
        description: `Moved to ${formatTimeRange(start, end)}, inside the site access window.`,
        next,
      };
    }

    // Travel time, discipline and project status all need a human decision.
    default:
      return null;
  }
}
