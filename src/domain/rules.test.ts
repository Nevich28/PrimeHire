import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parseInstant } from './datetime.ts';
import {
  dedupeSymmetricIssues,
  evaluateInspection,
  evaluateSchedule,
  groupIssuesByInspection,
} from './rules.ts';
import type { RuleContext } from './rules.ts';
import type { Dataset, Inspection } from './types.ts';

/**
 * These tests are written against the real `data.json`, not against fixtures.
 * The dataset is seeded with genuine operational problems, and the point of the
 * product is to find them, so the test suite pins each one by id. If a rule
 * regresses, a named real-world scenario fails rather than an abstract case.
 */
const data: Dataset = JSON.parse(
  readFileSync(new URL('../../data.json', import.meta.url), 'utf8')
);

const NOW = parseInstant('2026-08-25T17:00:00+02:00');

const context: RuleContext = {
  inspections: data.inspections,
  projects: Object.fromEntries(data.projects.map((p) => [p.id, p])),
  inspectors: Object.fromEntries(data.inspectors.map((i) => [i.id, i])),
  now: NOW,
};

const byInspection = groupIssuesByInspection(evaluateSchedule(context));
const codesFor = (id: string) => (byInspection[id] ?? []).map((issue) => issue.code).sort();
const inspection = (id: string): Inspection => {
  const found = data.inspections.find((i) => i.id === id);
  assert.ok(found, `${id} missing from data.json`);
  return found;
};

test('the critical crack review tomorrow morning has nobody assigned', () => {
  const target = inspection('insp-1001');
  assert.equal(target.priority, 'critical');
  assert.deepEqual(codesFor('insp-1001'), ['unassigned']);
});

test('the second unassigned inspection is caught too', () => {
  assert.ok(codesFor('insp-1017').includes('unassigned'));
});

test('Anna Keller is double booked on 26 August, and both sides are flagged', () => {
  assert.ok(codesFor('insp-1002').includes('double_booked'));
  assert.ok(codesFor('insp-1003').includes('double_booked'));

  const clash = byInspection['insp-1002'].find((i) => i.code === 'double_booked');
  assert.equal(clash?.relatedInspectionId, 'insp-1003');
  assert.match(clash!.message, /Anna Keller is already booked on A12-NB-019/);
});

test('an overlap is reported as a clash, not as a travel-time warning', () => {
  // Reporting both would be noise: the overlap already makes the pair impossible.
  assert.ok(!codesFor('insp-1002').includes('tight_travel'));
  assert.ok(!codesFor('insp-1003').includes('tight_travel'));
});

test('inspections that break a site access rule are flagged', () => {
  // A12-NA-018: the security gate closes at 16:00, last arrival 15:45.
  assert.ok(codesFor('insp-1002').includes('site_access'));
  const late = byInspection['insp-1007'].find((i) => i.code === 'site_access');
  assert.match(late!.message, /arrives at 16:30 and runs until 17:15/);
  assert.match(late!.message, /security gate closes at 16:00/);

  // SG-RD-311: the traffic control team leaves at 14:30.
  const drainage = byInspection['insp-1005'].find((i) => i.code === 'site_access');
  assert.match(drainage!.message, /runs until 15:00/);
  assert.match(drainage!.message, /traffic control team/);
});

test('inspections inside their site access window are left alone', () => {
  assert.ok(!codesFor('insp-1022').includes('site_access')); // 13:00–13:45 on A12-NA-018
  assert.ok(!codesFor('insp-1008').includes('site_access')); // 07:00–07:45 on SG-RD-311
});

test('a discipline the inspector is not signed off for is surfaced as information', () => {
  const mismatch = byInspection['insp-1006'].find((i) => i.code === 'specialty_mismatch');
  assert.equal(mismatch?.severity, 'info');
  assert.match(mismatch!.message, /David Baumann is not signed off for safety work/);
});

test('singular and plural discipline names are treated as the same specialty', () => {
  // Inspection type is `facade`; David Baumann's specialty is spelled `facades`.
  assert.ok(!codesFor('insp-1011').includes('specialty_mismatch'));
  assert.ok(!codesFor('insp-1024').includes('specialty_mismatch'));
});

test('cancelled and completed inspections never raise issues', () => {
  // insp-1015 sits on a project that is on hold, but it is already cancelled.
  assert.deepEqual(codesFor('insp-1015'), []);
  // insp-1013 sits on a completed project and was itself completed in April.
  assert.deepEqual(codesFor('insp-1013'), []);
  // insp-1012 was carried out by an inspector who is no longer active.
  assert.deepEqual(codesFor('insp-1012'), []);
});

test('nothing in the seed data is silently overdue', () => {
  const overdue = Object.values(byInspection)
    .flat()
    .filter((issue) => issue.code === 'overdue');
  assert.deepEqual(overdue, []);
});

test('a draft that has not been saved yet is validated the same way', () => {
  const draft: Inspection = {
    id: 'draft',
    projectId: 'prj-001',
    inspectorId: 'ins-001',
    title: 'Draft inspection',
    type: 'structural',
    status: 'scheduled',
    priority: 'normal',
    startsAt: '2026-08-26T16:00:00+02:00',
    endsAt: '2026-08-26T17:00:00+02:00',
    notes: null,
    createdAt: '2026-08-25T17:00:00+02:00',
    cancellationReason: null,
  };

  const codes = evaluateInspection(draft, context).map((i) => i.code);
  assert.ok(codes.includes('double_booked'), 'clashes with Anna Keller at 15:45');
  assert.ok(codes.includes('site_access'), 'arrives after the gate has closed');
});

test('scheduling somebody who has left the roster is a warning', () => {
  const draft: Inspection = {
    ...inspection('insp-1022'),
    id: 'draft-inactive',
    inspectorId: 'ins-005', // Marco Rossi, active: false
  };
  const codes = evaluateInspection(draft, context).map((i) => i.code);
  assert.ok(codes.includes('inspector_inactive'));
});

test('work booked on a project that is on hold is a warning', () => {
  const draft: Inspection = {
    ...inspection('insp-1015'),
    id: 'draft-on-hold',
    status: 'scheduled',
    cancellationReason: null,
  };
  const codes = evaluateInspection(draft, context).map((i) => i.code);
  assert.ok(codes.includes('project_not_active'));
});

test('back-to-back work on two different sites warns about travel time', () => {
  const draft: Inspection = {
    id: 'draft-travel',
    projectId: 'prj-005', // St. Gallen
    inspectorId: 'ins-003', // Sofia Rossi, in Frauenfeld until 11:30 that day
    title: 'Draft travel check',
    type: 'electrical',
    status: 'scheduled',
    priority: 'normal',
    startsAt: '2026-08-27T12:00:00+02:00',
    endsAt: '2026-08-27T13:00:00+02:00',
    notes: null,
    createdAt: '2026-08-25T17:00:00+02:00',
    cancellationReason: null,
  };

  const travel = evaluateInspection(draft, context).find((i) => i.code === 'tight_travel');
  assert.ok(travel, 'expected a travel warning between Frauenfeld and St. Gallen');
  assert.match(travel!.message, /Only 30 min/);
  assert.match(travel!.message, /journey takes about 55 min/);
  assert.equal(travel!.relatedInspectionId, 'insp-1004');
});

test('two sites in the same town do not need an hour between them', () => {
  // Werkstrasse 4 and Oststrasse 77 are both in Frauenfeld. A twenty minute gap
  // is fine, and a flat buffer would have complained about it.
  const draft: Inspection = {
    id: 'draft-same-town',
    projectId: 'prj-002', // Frauenfeld
    inspectorId: 'ins-003', // Sofia Rossi, in Frauenfeld until 11:30 that day
    title: 'Draft same-town check',
    type: 'structural',
    status: 'scheduled',
    priority: 'normal',
    startsAt: '2026-08-27T11:50:00+02:00',
    endsAt: '2026-08-27T12:30:00+02:00',
    notes: null,
    createdAt: '2026-08-25T17:00:00+02:00',
    cancellationReason: null,
  };

  const codes = evaluateInspection(draft, context).map((issue) => issue.code);
  assert.ok(!codes.includes('tight_travel'), 'twenty minutes is enough to cross one town');
});

test('an hour and a half is not enough to cross the country', () => {
  // Basel to St. Gallen is most of a morning. A flat buffer of under an hour
  // would have said nothing at all about this.
  const draft: Inspection = {
    id: 'draft-cross-country',
    projectId: 'prj-005', // St. Gallen
    inspectorId: 'ins-002',
    title: 'Draft cross-country check',
    type: 'safety',
    status: 'scheduled',
    priority: 'normal',
    startsAt: '2026-09-10T11:00:00+02:00',
    endsAt: '2026-09-10T12:00:00+02:00',
    notes: null,
    createdAt: '2026-08-25T17:00:00+02:00',
    cancellationReason: null,
  };

  const inBasel: Inspection = {
    ...draft,
    id: 'draft-basel',
    projectId: 'prj-008', // Basel
    startsAt: '2026-09-10T08:30:00+02:00',
    endsAt: '2026-09-10T09:30:00+02:00',
  };

  const travel = evaluateInspection(draft, {
    ...context,
    inspections: [...data.inspections, inBasel],
  }).find((issue) => issue.code === 'tight_travel');

  assert.ok(travel, 'expected a warning: ninety minutes does not cover Basel to St. Gallen');
  assert.match(travel!.message, /Only 90 min/);
  assert.match(travel!.message, /takes about 135 min/);
});

test('a two-sided clash is one problem in the feed, but flagged on both cards', () => {
  const all = evaluateSchedule(context);
  const feed = dedupeSymmetricIssues(all);

  const clashesEverywhere = all.filter((issue) => issue.code === 'double_booked');
  assert.equal(clashesEverywhere.length, 2, 'both inspections carry the clash');

  const clashesInFeed = feed.filter((issue) => issue.code === 'double_booked');
  assert.equal(clashesInFeed.length, 1, 'the feed counts the clash once');
  assert.equal(clashesInFeed[0].inspectionId, 'insp-1002', 'kept on the earlier inspection');
  assert.equal(clashesInFeed[0].relatedInspectionId, 'insp-1003');

  // Nothing else is lost on the way.
  assert.equal(all.length - feed.length, 1);
  assert.equal(
    feed.filter((issue) => issue.severity === 'blocker').length,
    3,
    'two unassigned inspections and one double booking'
  );
});

test('the attention feed is ordered worst first', () => {
  const feed = evaluateSchedule(context);
  const severities = feed.map((issue) => issue.severity);
  const firstWarning = severities.indexOf('warning');
  const lastBlocker = severities.lastIndexOf('blocker');
  assert.ok(lastBlocker < firstWarning, 'all blockers must come before any warning');
});
