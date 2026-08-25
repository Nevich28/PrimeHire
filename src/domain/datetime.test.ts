import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  calendarDaysBetween,
  formatDayDistance,
  formatDayHeading,
  fromZurichWallClock,
  overlaps,
  parseInstant,
  toZurichIso,
  zurichDayKey,
  zurichOffset,
} from './datetime.ts';

const data = JSON.parse(readFileSync(new URL('../../data.json', import.meta.url), 'utf8'));
const NOW = parseInstant('2026-08-25T17:00:00+02:00');
const utc = (iso: string) => Date.parse(iso);

test('every timestamp in data.json survives a parse/format round trip', () => {
  let checked = 0;
  for (const inspection of data.inspections) {
    for (const key of ['startsAt', 'endsAt', 'createdAt', 'completedAt', 'cancelledAt']) {
      const iso = inspection[key];
      if (!iso) continue;
      assert.equal(toZurichIso(parseInstant(iso)), iso, `${inspection.id}.${key}`);
      checked++;
    }
  }
  assert.ok(checked > 50, 'expected the dataset to carry plenty of timestamps');
});

test('Zurich switches between CET and CEST on the correct instants', () => {
  const CET = 3_600_000;
  const CEST = 7_200_000;
  assert.equal(zurichOffset(utc('2026-01-15T12:00:00Z')), CET);
  assert.equal(zurichOffset(utc('2026-07-15T12:00:00Z')), CEST);
  // Last Sunday of March 2026 is the 29th; the switch happens at 01:00 UTC.
  assert.equal(zurichOffset(utc('2026-03-29T00:59:00Z')), CET);
  assert.equal(zurichOffset(utc('2026-03-29T01:00:00Z')), CEST);
  // Last Sunday of October 2026 is the 25th.
  assert.equal(zurichOffset(utc('2026-10-25T00:59:00Z')), CEST);
  assert.equal(zurichOffset(utc('2026-10-25T01:00:00Z')), CET);
  assert.equal(toZurichIso(utc('2026-01-15T12:00:00Z')), '2026-01-15T13:00:00+01:00');
});

test('wall clock input maps to the right instant in both halves of the year', () => {
  assert.equal(toZurichIso(fromZurichWallClock(2026, 8, 26, 8, 0)), '2026-08-26T08:00:00+02:00');
  assert.equal(toZurichIso(fromZurichWallClock(2026, 12, 3, 14, 30)), '2026-12-03T14:30:00+01:00');
  // Rolling past the end of a month is expected to normalise forward.
  assert.equal(toZurichIso(fromZurichWallClock(2026, 8, 32, 9, 0)), '2026-09-01T09:00:00+02:00');
});

test('days are grouped by Zurich calendar date, not by the viewer timezone', () => {
  assert.equal(zurichDayKey(NOW), '2026-08-25');
  // 22:00 local is still the same working day, even though it is a late slot.
  assert.equal(zurichDayKey(parseInstant('2026-08-23T22:00:00+02:00')), '2026-08-23');
  assert.equal(calendarDaysBetween(NOW, parseInstant('2026-08-26T08:00:00+02:00')), 1);
});

test('day headings read the way an operations coordinator expects', () => {
  assert.equal(formatDayHeading(NOW, NOW), 'Today');
  assert.equal(formatDayHeading(parseInstant('2026-08-26T08:00:00+02:00'), NOW), 'Tomorrow');
  assert.equal(formatDayHeading(parseInstant('2026-08-24T08:00:00+02:00'), NOW), 'Yesterday');
  assert.equal(formatDayHeading(parseInstant('2026-09-03T08:30:00+02:00'), NOW), 'Thu 3 Sep');
  assert.equal(formatDayDistance(parseInstant('2026-09-01T09:00:00+02:00'), NOW), 'in 7 days');
});

test('overlap treats intervals as half-open, so back-to-back slots do not clash', () => {
  const at = (iso: string) => parseInstant(iso);
  assert.equal(
    overlaps(
      at('2026-08-26T15:30:00+02:00'), at('2026-08-26T16:30:00+02:00'),
      at('2026-08-26T15:45:00+02:00'), at('2026-08-26T16:45:00+02:00')
    ),
    true,
    'the two Anna Keller inspections on 26 August genuinely overlap'
  );
  assert.equal(
    overlaps(
      at('2026-08-26T09:00:00+02:00'), at('2026-08-26T10:00:00+02:00'),
      at('2026-08-26T10:00:00+02:00'), at('2026-08-26T11:00:00+02:00')
    ),
    false
  );
});
