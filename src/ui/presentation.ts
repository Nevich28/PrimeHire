/**
 * How domain concepts are shown.
 *
 * Kept separate from both the rules engine and the components so that the
 * vocabulary of the product — what a status is called, which colour a severity
 * gets, which icon means "clash" — is defined exactly once.
 */

import { Ionicons } from '@expo/vector-icons';

import type { IssueSeverity } from '@/domain/rules';
import type { InspectionStatus, Priority } from '@/domain/types';

import type { Tone } from './primitives';

type IconName = keyof typeof Ionicons.glyphMap;

export const statusPresentation: Record<
  InspectionStatus,
  { label: string; tone: Tone; icon: IconName }
> = {
  scheduled: { label: 'Scheduled', tone: 'accent', icon: 'calendar-outline' },
  completed: { label: 'Completed', tone: 'success', icon: 'checkmark-circle-outline' },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: 'close-circle-outline' },
};

export const priorityPresentation: Record<
  Priority,
  { label: string; tone: Tone; showBadge: boolean }
> = {
  // Normal is the default and gets no badge — a screen where everything is
  // labelled is a screen where nothing stands out.
  normal: { label: 'Normal', tone: 'neutral', showBadge: false },
  high: { label: 'High', tone: 'warning', showBadge: true },
  critical: { label: 'Critical', tone: 'blocker', showBadge: true },
};

export const severityPresentation: Record<
  IssueSeverity,
  { tone: Tone; icon: IconName; heading: string }
> = {
  blocker: { tone: 'blocker', icon: 'alert-circle', heading: 'Blocking' },
  warning: { tone: 'warning', icon: 'warning-outline', heading: 'Check' },
  info: { tone: 'info', icon: 'information-circle-outline', heading: 'Note' },
};

const DISCIPLINE_ICONS: Record<string, IconName> = {
  structural: 'construct-outline',
  concrete: 'cube-outline',
  electrical: 'flash-outline',
  safety: 'shield-checkmark-outline',
  drainage: 'water-outline',
  facade: 'business-outline',
  environmental: 'leaf-outline',
};

export function disciplineIcon(type: string): IconName {
  return DISCIPLINE_ICONS[type.toLowerCase()] ?? 'clipboard-outline';
}

/** `structural` reads as `Structural` in the UI. */
export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export const projectStatusLabel: Record<string, string> = {
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
};
