import { parseInstant } from './datetime.ts';

/**
 * The exercise pins "today" to 25 August 2026, so the app runs against a fixed
 * clock rather than the machine's. That keeps the demo reproducible for anyone
 * opening it later, and it keeps rule evaluation deterministic in tests.
 *
 * 17:00 is deliberate: it is the end of the working day, eighteen minutes after
 * the critical crack review on the Limmat bridge was raised and left unassigned
 * for tomorrow morning. That is exactly the moment this product has to earn its
 * keep.
 *
 * Everything reads `now()` rather than `Date.now()`, so switching to a live
 * clock later is a one-line change.
 */
export const FIXED_NOW = parseInstant('2026-08-25T17:00:00+02:00');

export function now(): number {
  return FIXED_NOW;
}
