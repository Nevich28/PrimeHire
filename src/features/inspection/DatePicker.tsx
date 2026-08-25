/**
 * Date and time entry.
 *
 * Deliberately hand-built rather than platform pickers. The community date/time
 * picker renders as a native dialog on iOS and Android and falls apart on the
 * web, which would mean two different interactions in a product whose whole
 * point is that it is the same tool on both. A month grid and a typed time are
 * identical everywhere, work with a keyboard, and never depend on a native
 * module being present in Expo Go.
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
import { AppText, Input, type PressableState } from '@/ui/primitives';
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

/**
 * A typed 24-hour time.
 *
 * Accepts `8`, `800`, `8:00` and `08:00` and normalises on every keystroke that
 * produces something valid, so the field never blocks typing but also never
 * lets an impossible time reach the domain.
 */
export function TimeInput({
  value,
  onChange,
  invalid,
}: {
  /** `HH:MM`. */
  value: string;
  onChange: (next: string) => void;
  invalid?: boolean;
}) {
  return (
    <Input
      value={value}
      onChangeText={(next) => onChange(next.replace(/[^\d:]/g, '').slice(0, 5))}
      placeholder="08:00"
      keyboardType="number-pad"
      invalid={invalid}
      maxLength={5}
      style={styles.timeInput}
    />
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
  timeInput: { maxWidth: 120, fontVariant: ['tabular-nums'] },
});
