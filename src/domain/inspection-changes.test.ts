import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parseInstant } from './datetime.ts';
import {
  applyDraft,
  cancelInspection,
  completeInspection,
  createInspection,
  nextInspectionId,
  reopenInspection,
} from './inspection-changes.ts';
import type { InspectionDraft } from './inspection-changes.ts';
import type { Dataset } from './types.ts';

const data: Dataset = JSON.parse(
  readFileSync(new URL('../../data.json', import.meta.url), 'utf8')
);

const NOW = parseInstant('2026-08-25T17:00:00+02:00');

const draft: InspectionDraft = {
  projectId: 'prj-004',
  inspectorId: 'ins-003',
  title: '  Tunnel ventilation duct pressure test  ',
  type: 'electrical',
  priority: 'high',
  startsAt: '2026-08-27T13:00:00+02:00',
  endsAt: '2026-08-27T14:00:00+02:00',
  notes: '   ',
};

test('a new inspection continues the id sequence in the delivered data', () => {
  assert.equal(nextInspectionId(data.inspections), 'insp-1025');
  const created = createInspection(draft, data.inspections, NOW);
  assert.equal(created.id, 'insp-1025');
  // And again, once it is part of the set.
  assert.equal(nextInspectionId([...data.inspections, created]), 'insp-1026');
});

test('a new inspection is scheduled, stamped and trimmed', () => {
  const created = createInspection(draft, data.inspections, NOW);
  assert.equal(created.status, 'scheduled');
  assert.equal(created.title, 'Tunnel ventilation duct pressure test');
  assert.equal(created.notes, null, 'whitespace-only notes become null, not an empty string');
  assert.equal(created.createdAt, '2026-08-25T17:00:00+02:00');
  assert.equal(created.cancellationReason, null);
  assert.equal(created.projectId, 'prj-004');
  assert.equal(created.inspectorId, 'ins-003');
  assert.equal(created.priority, 'high');
});

test('editing changes the editable fields and leaves the record identity alone', () => {
  const original = data.inspections.find((i) => i.id === 'insp-1022')!;
  const edited = applyDraft(original, {
    ...draft,
    title: 'Rescheduled scaffold access review',
    notes: 'Moved to the afternoon at the site team’s request.',
  });

  assert.equal(edited.id, original.id);
  assert.equal(edited.createdAt, original.createdAt);
  assert.equal(edited.status, original.status);
  assert.equal(edited.title, 'Rescheduled scaffold access review');
  assert.equal(edited.startsAt, '2026-08-27T13:00:00+02:00');
  assert.equal(edited.notes, 'Moved to the afternoon at the site team’s request.');
});

test('cancelling keeps the record and records why', () => {
  const original = data.inspections.find((i) => i.id === 'insp-1022')!;
  const cancelled = cancelInspection(original, '  Works delayed on site.  ', NOW);

  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancellationReason, 'Works delayed on site.');
  assert.equal(cancelled.cancelledAt, '2026-08-25T17:00:00+02:00');
  // Nothing about the original booking is lost.
  assert.equal(cancelled.startsAt, original.startsAt);
  assert.equal(cancelled.inspectorId, original.inspectorId);
});

test('an empty cancellation reason still leaves something readable behind', () => {
  const original = data.inspections.find((i) => i.id === 'insp-1022')!;
  assert.equal(cancelInspection(original, '   ', NOW).cancellationReason, 'No reason given.');
});

test('completing stamps the time it was closed out', () => {
  const original = data.inspections.find((i) => i.id === 'insp-1022')!;
  const completed = completeInspection(original, NOW);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.completedAt, '2026-08-25T17:00:00+02:00');
});

test('reopening clears every closure field, so no stale reason survives', () => {
  const cancelled = data.inspections.find((i) => i.id === 'insp-1015')!;
  assert.ok(cancelled.cancellationReason, 'this fixture is expected to carry a reason');

  const reopened = reopenInspection(cancelled);
  assert.equal(reopened.status, 'scheduled');
  assert.equal(reopened.cancellationReason, null);
  assert.equal(reopened.cancelledAt, null);
  assert.equal(reopened.completedAt, null);
});
