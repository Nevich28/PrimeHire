import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parseInstant } from './datetime.ts';
import { suggestResolution } from './resolutions.ts';
import { evaluateInspection, evaluateSchedule, groupIssuesByInspection } from './rules.ts';
import type { Issue, RuleContext } from './rules.ts';
import type { Dataset, Inspection } from './types.ts';

const data: Dataset = JSON.parse(
  readFileSync(new URL('../../data.json', import.meta.url), 'utf8')
);

const context: RuleContext = {
  inspections: data.inspections,
  projects: Object.fromEntries(data.projects.map((p) => [p.id, p])),
  inspectors: Object.fromEntries(data.inspectors.map((i) => [i.id, i])),
  now: parseInstant('2026-08-25T17:00:00+02:00'),
};

const byInspection = groupIssuesByInspection(evaluateSchedule(context));
const inspection = (id: string): Inspection => data.inspections.find((i) => i.id === id)!;
const issueOf = (id: string, code: Issue['code']): Issue =>
  byInspection[id].find((issue) => issue.code === code)!;

test('the unassigned critical review is offered somebody who is free and qualified', () => {
  const target = inspection('insp-1001'); // structural, tomorrow 08:00, nobody assigned
  const fix = suggestResolution(issueOf('insp-1001', 'unassigned'), target, context);

  assert.ok(fix, 'expected a suggestion for the most urgent inspection in the dataset');
  assert.match(fix.label, /^Assign /);

  const inspector = context.inspectors[fix.next.inspectorId!];
  assert.ok(inspector.active, 'never suggest somebody who has left the roster');
  assert.ok(
    inspector.specialties.some((s) => s.replace(/s$/, '') === 'structural'),
    'the suggested inspector must be signed off for the discipline'
  );
  assert.deepEqual(evaluateInspection(fix.next, context), [], 'the fix resolves it completely');
});

test('an inspection arriving after the gate has closed is offered a slot that fits', () => {
  // insp-1007 runs 16:30–17:15 on A12-NA-018, where the last permitted arrival
  // is 15:45 and the gate closes at 16:00.
  const fix = suggestResolution(
    issueOf('insp-1007', 'site_access'),
    inspection('insp-1007'),
    context
  );

  assert.ok(fix, 'expected a reschedule suggestion');
  assert.equal(fix.next.startsAt, '2026-08-28T15:15:00+02:00');
  assert.equal(fix.next.endsAt, '2026-08-28T16:00:00+02:00', 'ends exactly as the gate closes');
  assert.equal(fix.label, 'Move to 15:15 – 16:00');
  assert.ok(
    !evaluateInspection(fix.next, context).some((issue) => issue.code === 'site_access'),
    'the site access breach is gone'
  );
});

test('no fix is offered when moving the slot would leave a blocker behind', () => {
  // insp-1002 also breaks the A12 gate rule, and an earlier slot on the same
  // day would fit it — but Anna Keller is double booked across that afternoon,
  // so the move would look like a fix while leaving her in two places at once.
  assert.equal(
    suggestResolution(issueOf('insp-1002', 'site_access'), inspection('insp-1002'), context),
    null
  );
});

test('the suggested slot keeps the original duration', () => {
  // insp-1005 runs 14:00–15:00 on SG-RD-311, whose window closes at 14:30.
  const fix = suggestResolution(
    issueOf('insp-1005', 'site_access'),
    inspection('insp-1005'),
    context
  );

  assert.ok(fix);
  const start = parseInstant(fix.next.startsAt);
  const end = parseInstant(fix.next.endsAt);
  assert.equal(end - start, 60 * 60_000, 'still an hour long');
  assert.equal(fix.next.startsAt, '2026-08-27T13:30:00+02:00', 'latest hour that fits the window');
});

test('a suggestion is withheld when it would create a new blocker', () => {
  // Every active inspector is booked solid across this slot, so there is nobody
  // to suggest and the product must stay quiet rather than guess.
  const busy: Inspection = {
    ...inspection('insp-1001'),
    id: 'draft-crowded',
    inspectorId: null,
  };
  const crowded: RuleContext = {
    ...context,
    inspections: [
      ...data.inspections,
      ...Object.values(context.inspectors)
        .filter((i) => i.active)
        .map((inspector, index) => ({
          ...inspection('insp-1001'),
          id: `blocker-${index}`,
          inspectorId: inspector.id,
        })),
    ],
  };

  const issue = evaluateInspection(busy, crowded).find((i) => i.code === 'unassigned')!;
  assert.equal(suggestResolution(issue, busy, crowded), null);
});

test('issues that need a human decision get no one-tap fix', () => {
  const travel: Issue = {
    code: 'tight_travel',
    severity: 'warning',
    label: 'Tight travel',
    message: '',
    inspectionId: 'insp-1002',
  };
  assert.equal(suggestResolution(travel, inspection('insp-1002'), context), null);

  const mismatch = issueOf('insp-1006', 'specialty_mismatch');
  assert.equal(suggestResolution(mismatch, inspection('insp-1006'), context), null);
});

test('an inspection already inside its window is not offered a pointless move', () => {
  const fine: Issue = {
    code: 'site_access',
    severity: 'warning',
    label: 'Site access',
    message: '',
    inspectionId: 'insp-1022',
  };
  // insp-1022 runs 13:00–13:45 on A12-NA-018 and breaks nothing.
  assert.equal(suggestResolution(fine, inspection('insp-1022'), context), null);
});
