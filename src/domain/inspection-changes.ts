/**
 * State transitions for an inspection, as pure functions.
 *
 * Every change the product can make to an inspection lives here rather than in
 * the store, for two reasons. It keeps the store down to subscription and
 * storage, and it makes the part that actually matters — what a cancellation
 * does to a record, which id a new inspection gets — testable without a React
 * tree or a storage backend.
 */

import { toZurichIso } from './datetime.ts';
import type { Inspection, InspectionType, Priority } from './types.ts';

export type InspectionDraft = {
  projectId: string;
  inspectorId: string | null;
  title: string;
  type: InspectionType;
  priority: Priority;
  startsAt: string;
  endsAt: string;
  notes: string | null;
};

/**
 * Ids continue the sequence already present in the data (`insp-1024` and up)
 * instead of using random uuids: it keeps the dataset readable, keeps new
 * records sortable by age, and avoids a dependency for something this small.
 */
export function nextInspectionId(existing: Inspection[]): string {
  const highest = existing.reduce((max, inspection) => {
    const match = /^insp-(\d+)$/.exec(inspection.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 1000);
  return `insp-${highest + 1}`;
}

/** Applies the editable fields of a draft, normalising blank text to null. */
export function applyDraft(inspection: Inspection, draft: InspectionDraft): Inspection {
  return {
    ...inspection,
    projectId: draft.projectId,
    inspectorId: draft.inspectorId,
    title: draft.title.trim(),
    type: draft.type,
    priority: draft.priority,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    notes: draft.notes?.trim() ? draft.notes.trim() : null,
  };
}

export function createInspection(
  draft: InspectionDraft,
  existing: Inspection[],
  now: number
): Inspection {
  return applyDraft(
    {
      id: nextInspectionId(existing),
      projectId: draft.projectId,
      inspectorId: draft.inspectorId,
      title: draft.title,
      type: draft.type,
      status: 'scheduled',
      priority: draft.priority,
      startsAt: draft.startsAt,
      endsAt: draft.endsAt,
      notes: draft.notes,
      createdAt: toZurichIso(now),
      cancellationReason: null,
    },
    draft
  );
}

/**
 * Cancelling keeps the record and the reason.
 *
 * The delivered dataset works this way — every cancelled inspection carries the
 * sentence explaining it — and that sentence is what stops the next person
 * ringing round to ask what happened.
 */
export function cancelInspection(
  inspection: Inspection,
  reason: string,
  now: number
): Inspection {
  return {
    ...inspection,
    status: 'cancelled',
    cancelledAt: toZurichIso(now),
    cancellationReason: reason.trim() || 'No reason given.',
  };
}

export function completeInspection(inspection: Inspection, now: number): Inspection {
  return {
    ...inspection,
    status: 'completed',
    completedAt: toZurichIso(now),
  };
}

/** Puts a cancelled or completed inspection back on the schedule. */
export function reopenInspection(inspection: Inspection): Inspection {
  return {
    ...inspection,
    status: 'scheduled',
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
  };
}
