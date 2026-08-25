import type { Project } from './types.ts';

/**
 * Site access rules.
 *
 * `data.json` carries these as prose inside `project.siteNote`, for example
 * "Security gate closes at 16:00. Last permitted site arrival is 15:45." A
 * human reads that fine; the product cannot warn anyone about it unless the
 * rule is structured. In a real system this would be a field on the project, so
 * that is how it is modelled here — transcribed from the notes, never guessed,
 * and the original note is still shown verbatim next to it.
 *
 * Parsing the sentences at runtime was considered and rejected: it would be a
 * regex guessing game against free text an operations team can rewrite at any
 * time, and it would fail silently when it guesses wrong.
 */
export type SiteAccessWindow = {
  /** Earliest wall-clock time work can start on site, `HH:MM`. */
  opensAt?: string;
  /** Time after which nobody may be on site, `HH:MM`. */
  closesAt?: string;
  /** Latest time an inspector may arrive, `HH:MM`. */
  latestArrival?: string;
  /** Short reason, shown to the user when a rule is violated. */
  reason: string;
};

const SITE_ACCESS: Record<string, SiteAccessWindow> = {
  // "Security gate closes at 16:00. Last permitted site arrival is 15:45."
  'prj-001': {
    closesAt: '16:00',
    latestArrival: '15:45',
    reason: 'the security gate closes at 16:00 (last arrival 15:45)',
  },
  // "Traffic control team is available only between 06:30 and 14:30."
  'prj-005': {
    opensAt: '06:30',
    closesAt: '14:30',
    reason: 'the traffic control team is only on site between 06:30 and 14:30',
  },
};

export function siteAccessFor(project: Project): SiteAccessWindow | null {
  return SITE_ACCESS[project.id] ?? null;
}

/** Minutes since midnight for an `HH:MM` string. */
export function minutesOfDay(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}
