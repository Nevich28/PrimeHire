/**
 * The attention feed.
 *
 * This is the product's opinion, and it sits above the schedule for a reason:
 * the client's team already has a list of inspections, what they do not have is
 * something that tells them which ones are about to fail. Blockers first, then
 * warnings, each one a sentence a coordinator can act on without translation.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDayDistance, formatTime } from '@/domain/datetime';
import type { Issue } from '@/domain/rules';
import type { ResolvedInspection } from '@/domain/types';
import { AppText, Card, toneColors } from '@/ui/primitives';
import { severityPresentation } from '@/ui/presentation';
import { colors, radius, spacing } from '@/ui/theme';

const COLLAPSED_COUNT = 4;

export function AttentionFeed({
  issues,
  byId,
  now,
  onSelect,
}: {
  issues: Issue[];
  byId: Record<string, ResolvedInspection>;
  now: number;
  onSelect: (inspectionId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const blockers = issues.filter((issue) => issue.severity === 'blocker').length;
  const warnings = issues.filter((issue) => issue.severity === 'warning').length;

  if (issues.length === 0) {
    return (
      <Card style={styles.clear}>
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color={colors.success}>
            Everything is covered
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            Every open inspection has an inspector, fits its site access window and has no clashes.
          </AppText>
        </View>
      </Card>
    );
  }

  const visible = expanded ? issues : issues.slice(0, COLLAPSED_COUNT);

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="alert-circle" size={18} color={colors.blocker} />
        <AppText variant="heading">Needs attention</AppText>
        <View style={styles.flex} />
        <AppText variant="caption" color={colors.textSecondary}>
          {blockers > 0 ? `${blockers} blocking` : null}
          {blockers > 0 && warnings > 0 ? ' · ' : null}
          {warnings > 0 ? `${warnings} to check` : null}
        </AppText>
      </View>

      <View style={styles.rows}>
        {visible.map((issue, index) => (
          <AttentionRow
            key={`${issue.inspectionId}-${issue.code}-${index}`}
            issue={issue}
            item={byId[issue.inspectionId]}
            now={now}
            onPress={() => onSelect(issue.inspectionId)}
          />
        ))}
      </View>

      {issues.length > COLLAPSED_COUNT ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded((value) => !value)}
          style={styles.more}
        >
          <AppText variant="label" color={colors.accent}>
            {expanded ? 'Show less' : `Show all ${issues.length}`}
          </AppText>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.accent}
          />
        </Pressable>
      ) : null}
    </Card>
  );
}

function AttentionRow({
  issue,
  item,
  now,
  onPress,
}: {
  issue: Issue;
  item: ResolvedInspection | undefined;
  now: number;
  onPress: () => void;
}) {
  const presentation = severityPresentation[issue.severity];
  const tone = toneColors(presentation.tone);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${issue.message} ${item ? item.inspection.title : ''}`}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        (hovered || pressed) && { backgroundColor: colors.surfaceMuted },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
        <Ionicons name={presentation.icon} size={14} color={tone.fg} />
      </View>

      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {item ? item.inspection.title : 'Inspection'}
        </AppText>
        <AppText variant="caption" color={tone.fg} numberOfLines={2}>
          {issue.message}
        </AppText>
        {item ? (
          <AppText variant="caption" color={colors.textMuted}>
            {item.project.code} · {formatDayDistance(item.start, now)} at {formatTime(item.start)}
          </AppText>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.sm },
  clear: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.successSoft,
    borderColor: '#CBE5D6',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  rows: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  rowIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
