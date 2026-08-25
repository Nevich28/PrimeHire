/**
 * Date and time entry.
 *
 * Deliberately hand-built rather than platform pickers. The community date/time
 * picker renders as a native dialog on iOS and Android and falls apart on the
 * web, which would mean two different interactions in a product whose whole
 * point is that it is the same tool on both. A month grid and a pair of hour
 * and minute grids behave identically everywhere, work with a keyboard, and
 * never depend on a native module being present in Expo Go.
 *
 * Weeks start on Monday, as they do in Switzerland.
 */

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  calendarDaysBetween,
  formatLongDate,
  fromZurichWallClock,
  toZurichParts,
  zurichDayKey,
} from '@/domain/datetime';
import { minutesOfDay } from '@/domain/site-access';
import type { SiteAccessWindow } from '@/domain/site-access';
import { AppText, Button, Field, type PressableState } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { colors, radius, spacing } from '@/ui/theme';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Cell = { instant: number; inMonth: boolean };

/** Six weeks of cells covering the month that contains `anchor`. */
function buildMonth(anchor: number): Cell[] {
  const { year, month } = toZurichParts(anchor);
  const first = fromZurichWallClock(year, month, 1);
  // getUTCDay is Sunday-based; shift so Monday is column zero.
  const leading = (toZurichParts(first).weekday + 6) % 7;

  return Array.from({ length: 42 }, (_, index) => {
    const instant = fromZurichWallClock(year, month, 1 - leading + index);
    return { instant, inMonth: toZurichParts(instant).month === month };
  });
}

export function DatePicker({
  value,
  now,
  onChange,
}: {
  /** Any instant on the selected day. */
  value: number;
  now: number;
  onChange: (instant: number) => void;
}) {
  const [anchor, setAnchor] = useState(value);
  const cells = useMemo(() => buildMonth(anchor), [anchor]);
  const anchorParts = toZurichParts(anchor);
  const selectedKey = zurichDayKey(value);
  const todayKey = zurichDayKey(now);

  const shiftMonth = (delta: number) => {
    setAnchor(fromZurichWallClock(anchorParts.year, anchorParts.month + delta, 1));
  };

  return (
    <View style={styles.calendar}>
      <View style={styles.monthHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => shiftMonth(-1)}
          style={({ hovered }: PressableState) => [
            styles.monthNav,
            hovered && { backgroundColor: colors.neutralSoft },
          ]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
        </Pressable>

        <AppText variant="bodyStrong">
          {MONTH_LABELS[anchorParts.month - 1]} {anchorParts.year}
        </AppText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => shiftMonth(1)}
          style={({ hovered }: PressableState) => [
            styles.monthNav,
            hovered && { backgroundColor: colors.neutralSoft },
          ]}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.weekdays}>
        {WEEKDAY_LABELS.map((label) => (
          <AppText key={label} variant="micro" color={colors.textMuted} style={styles.weekdayText}>
            {label}
          </AppText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => {
          const key = zurichDayKey(cell.instant);
          const selected = key === selectedKey;
          const isToday = key === todayKey;
          const isPast = calendarDaysBetween(now, cell.instant) < 0;

          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={formatLongDate(cell.instant)}
              accessibilityState={{ selected }}
              onPress={() => onChange(cell.instant)}
              style={({ hovered }: PressableState) => [
                styles.cell,
                selected && { backgroundColor: colors.accent },
                !selected && isToday && { borderColor: colors.accent, borderWidth: 1 },
                !selected && hovered && { backgroundColor: colors.accentSoft },
              ]}
            >
              <AppText
                variant="caption"
                color={
                  selected
                    ? colors.textInverse
                    : !cell.inMonth
                      ? colors.textMuted
                      : isPast
                        ? colors.textMuted
                        : colors.text
                }
                style={styles.cellText}
              >
                {toZurichParts(cell.instant).day}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = [0, 15, 30, 45];

const pad2 = (value: number) => String(value).padStart(2, '0');

/**
 * Picking a start time.
 *
 * This was a text field, and typing a time on a phone is the worst of both
 * worlds: it summons the numeric keyboard over the form, and it accepts
 * half-finished input — a lone "0" reads as midnight and the summary line
 * cheerfully agrees.
 *
 * Choosing an hour and then a quarter is two taps, needs no keyboard, and
 * cannot produce a time that does not exist. Site work runs on quarter hours,
 * so the granularity is the real one rather than an arbitrary restriction.
 *
 * Hours the site cannot be entered are marked rather than removed — the same
 * stance the rest of the product takes about warnings.
 */
export function TimeField({
  value,
  onChange,
  access,
}: {
  /** `HH:MM`. */
  value: string;
  onChange: (next: string) => void;
  /** Used to mark hours outside the site's access window. */
  access?: SiteAccessWindow | null;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseTimeInput(value) ?? { hour: 8, minute: 0 };

  const opens = access?.opensAt ? minutesOfDay(access.opensAt) : null;
  const closes = access?.closesAt ? minutesOfDay(access.closesAt) : null;

  const outsideWindow = (hour: number) => {
    const atHour = hour * 60;
    if (opens !== null && atHour < opens) return true;
    if (closes !== null && atHour >= closes) return true;
    return false;
  };

  const apply = (hour: number, minute: number) => onChange(`${pad2(hour)}:${pad2(minute)}`);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Start time ${value}. Change it`}
        onPress={() => setOpen(true)}
        style={({ hovered }: PressableState) => [
          styles.timeField,
          hovered && { borderColor: colors.borderStrong },
        ]}
      >
        <AppText variant="bodyStrong" mono>
          {value}
        </AppText>
        <Ionicons name="time-outline" size={18} color={colors.textMuted} />
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Start time"
        subtitle={
          access ? `This site: ${access.reason}.` : 'Site work runs on quarter hours.'
        }
        footer={<Button label="Done" onPress={() => setOpen(false)} />}
      >
        <Field label="Hour">
          <View style={styles.timeGrid}>
            {HOURS.map((hour) => {
              const selected = hour === parsed.hour;
              const marked = outsideWindow(hour);
              return (
                <Pressable
                  key={hour}
                  accessibilityRole="button"
                  accessibilityLabel={`${pad2(hour)} hundred${marked ? ', outside the site access window' : ''}`}
                  accessibilityState={{ selected }}
                  onPress={() => apply(hour, parsed.minute)}
                  style={({ hovered }: PressableState) => [
                    styles.timeCell,
                    marked && styles.timeCellMarked,
                    selected && styles.timeCellSelected,
                    !selected && hovered && { borderColor: colors.borderStrong },
                  ]}
                >
                  <AppText
                    variant="label"
                    mono
                    color={
                      selected ? colors.textInverse : marked ? colors.textMuted : colors.text
                    }
                  >
                    {pad2(hour)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Minutes">
          <View style={styles.minuteRow}>
            {MINUTES.map((minute) => {
              const selected = minute === parsed.minute;
              return (
                <Pressable
                  key={minute}
                  accessibilityRole="button"
                  accessibilityLabel={`${minute} minutes past`}
                  accessibilityState={{ selected }}
                  onPress={() => apply(parsed.hour, minute)}
                  style={({ hovered }: PressableState) => [
                    styles.minuteCell,
                    selected && styles.timeCellSelected,
                    !selected && hovered && { borderColor: colors.borderStrong },
                  ]}
                >
                  <AppText
                    variant="label"
                    mono
                    color={selected ? colors.textInverse : colors.text}
                  >
                    :{pad2(minute)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Field>
      </Sheet>
    </>
  );
}

/** Parses the loose forms a person types into `HH:MM`, or null if impossible. */
export function parseTimeInput(raw: string): { hour: number; minute: number } | null {
  const cleaned = raw.trim();
  const match = /^(\d{1,2})[:.]?(\d{2})?$/.exec(cleaned);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

const styles = StyleSheet.create({
  calendar: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  monthNav: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdays: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  weekdayText: { width: `${100 / 7}%`, textAlign: 'center', paddingVertical: 2 },
  cellText: { textAlign: 'center' },
  timeField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 48,
    maxWidth: 160,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeCell: {
    width: 52,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  timeCellMarked: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  timeCellSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  minuteRow: { flexDirection: 'row', gap: spacing.sm },
  minuteCell: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
