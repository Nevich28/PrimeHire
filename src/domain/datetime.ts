/**
 * Date/time handling for a single fixed operating timezone: Europe/Zurich.
 *
 * Why this exists instead of `Intl.DateTimeFormat` with a `timeZone` option:
 * the app has to render identically in a browser (whatever the viewer's local
 * timezone happens to be) and inside Hermes on a phone, where full ICU data is
 * not something we want to depend on. Every timestamp in the domain is stored
 * as an absolute instant (epoch milliseconds) and only ever *displayed* through
 * the helpers below, which apply Switzerland's DST rules explicitly.
 *
 * Zurich observes CET (UTC+1) in winter and CEST (UTC+2) in summer. The switch
 * happens on the last Sunday of March and the last Sunday of October, both at
 * 01:00 UTC, per the EU-wide rule Switzerland follows.
 */

const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

const CET = 1 * HOUR_MS;
const CEST = 2 * HOUR_MS;

/** Epoch ms of the last Sunday of `month` (0-based) in `year`, at 01:00 UTC. */
function lastSundayAt01Utc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const daysBack = lastDay.getUTCDay(); // 0 = Sunday
  return Date.UTC(year, month, lastDay.getUTCDate() - daysBack, 1, 0, 0, 0);
}

/** Zurich's UTC offset, in ms, at the given absolute instant. */
export function zurichOffset(instant: number): number {
  const year = new Date(instant).getUTCFullYear();
  const dstStart = lastSundayAt01Utc(year, 2); // last Sunday of March
  const dstEnd = lastSundayAt01Utc(year, 9); // last Sunday of October
  return instant >= dstStart && instant < dstEnd ? CEST : CET;
}

export type ZurichParts = {
  year: number;
  /** 1-based, unlike `Date`. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday. */
  weekday: number;
};

/** Break an absolute instant into Zurich wall-clock parts. */
export function toZurichParts(instant: number): ZurichParts {
  const shifted = new Date(instant + zurichOffset(instant));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * Turn Zurich wall-clock components into an absolute instant.
 *
 * The offset depends on the instant we are trying to compute, so we guess with
 * summer time, then re-check against the actual rule and correct once. Wall
 * clock times inside the one hour skipped every spring do not exist; they are
 * normalised forward, which is the behaviour a scheduler wants.
 */
export function fromZurichWallClock(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0
): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const guess = naive - CEST;
  const actual = zurichOffset(guess);
  return actual === CEST ? guess : naive - actual;
}

/** Parse an ISO 8601 string that carries an explicit offset. */
export function parseInstant(iso: string): number {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    throw new Error(`Unparseable timestamp: ${iso}`);
  }
  return parsed;
}

/** Serialise an instant back to ISO 8601 with Zurich's offset, e.g. `+02:00`. */
export function toZurichIso(instant: number): string {
  const p = toZurichParts(instant);
  const offsetMinutes = zurichOffset(instant) / 60_000;
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  return (
    `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}` +
    `T${pad(p.hour)}:${pad(p.minute)}:00` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Midnight in Zurich at the start of the day containing `instant`. */
export function startOfZurichDay(instant: number): number {
  const p = toZurichParts(instant);
  return fromZurichWallClock(p.year, p.month, p.day, 0, 0);
}

/** Stable `YYYY-MM-DD` key for grouping by Zurich calendar day. */
export function zurichDayKey(instant: number): string {
  const p = toZurichParts(instant);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** Whole Zurich calendar days between the two instants (`b` minus `a`). */
export function calendarDaysBetween(a: number, b: number): number {
  return Math.round((startOfZurichDay(b) - startOfZurichDay(a)) / DAY_MS);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/** `15:30` — 24-hour clock, which is what Swiss site work runs on. */
export function formatTime(instant: number): string {
  const p = toZurichParts(instant);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** `15:30 – 16:30` */
export function formatTimeRange(start: number, end: number): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** `Wednesday, 26 August 2026` */
export function formatLongDate(instant: number): string {
  const p = toZurichParts(instant);
  return `${WEEKDAYS[p.weekday]}, ${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

/** Day heading used by the schedule: `Today`, `Tomorrow`, or `Wed 26 Aug`. */
export function formatDayHeading(instant: number, now: number): string {
  const offset = calendarDaysBetween(now, instant);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  if (offset === -1) return 'Yesterday';
  const p = toZurichParts(instant);
  return `${WEEKDAYS[p.weekday].slice(0, 3)} ${p.day} ${MONTHS[p.month - 1].slice(0, 3)}`;
}

/** Human distance in days, e.g. `in 3 days`, `tomorrow`, `12 days ago`. */
export function formatDayDistance(instant: number, now: number): string {
  const offset = calendarDaysBetween(now, instant);
  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  if (offset === -1) return 'yesterday';
  if (offset > 0) return `in ${offset} days`;
  return `${Math.abs(offset)} days ago`;
}

export function durationLabel(start: number, end: number): string {
  const minutes = Math.round((end - start) / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

/** Do two [start, end) intervals overlap? Touching endpoints do not count. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}
