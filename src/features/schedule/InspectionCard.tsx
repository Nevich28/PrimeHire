/**
 * One row of the schedule.
 *
 * The card answers, in reading order, the four questions a coordinator asks:
 * when is it, what is it, where is it, and who is going. Anything wrong with it
 * is stated in words on the card itself rather than hidden behind a colour, so
 * the schedule can be scanned without opening anything.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { durationLabel, formatTime } from '@/domain/datetime';
import type { Issue } from '@/domain/rules';
import { worstSeverity } from '@/domain/rules';
import type { ResolvedInspection } from '@/domain/types';
import { AppText, Badge, toneColors, type PressableState } from '@/ui/primitives';
import {
  disciplineIcon,
  priorityPresentation,
  severityPresentation,
  statusPresentation,
} from '@/ui/presentation';
import { colors, elevation, radius, spacing } from '@/ui/theme';

export function InspectionCard({
  item,
  issues,
  selected = false,
  onPress,
}: {
  item: ResolvedInspection;
  issues: Issue[];
  selected?: boolean;
  onPress: () => void;
}) {
  const { inspection, project, inspector } = item;
  const severity = worstSeverity(issues);
  const accent = severity ? toneColors(severityPresentation[severity].tone).fg : 'transparent';
  const priority = priorityPresentation[inspection.priority];
  const status = statusPresentation[inspection.status];
  const isOpen = inspection.status === 'scheduled';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${inspection.title}, ${project.code}, ${formatTime(item.start)}`}
      onPress={onPress}
      style={({ pressed, hovered }: PressableState) => [
        styles.card,
        elevation.card,
        selected && styles.cardSelected,
        (hovered || pressed) && !selected && styles.cardHovered,
        !isOpen && styles.cardClosed,
      ]}
    >
      {/* A severity stripe repeats what the issue rows say, for fast scanning. */}
      <View style={[styles.stripe, { backgroundColor: accent }]} />

      <View style={styles.body}>
        <View style={styles.headline}>
          <AppText variant="bodyStrong" mono color={colors.text}>
            {formatTime(item.start)}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {durationLabel(item.start, item.end)}
          </AppText>

          <View style={styles.headlineSpacer} />

          {priority.showBadge ? <Badge label={priority.label} tone={priority.tone} /> : null}
          {!isOpen ? <Badge label={status.label} tone={status.tone} /> : null}
        </View>

        <AppText variant="bodyStrong" numberOfLines={2} style={styles.title}>
          {inspection.title}
        </AppText>

        <View style={styles.metaRow}>
          <Ionicons name={disciplineIcon(inspection.type)} size={14} color={colors.textMuted} />
          <AppText variant="caption" mono color={colors.textSecondary}>
            {project.code}
          </AppText>
          <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
            {project.name}
          </AppText>
        </View>

        <View style={styles.metaRow}>
          <Ionicons
            name={inspector ? 'person-outline' : 'person-remove-outline'}
            size={14}
            color={inspector ? colors.textMuted : colors.blocker}
          />
          <AppText
            variant="caption"
            color={inspector ? colors.textSecondary : colors.blocker}
            numberOfLines={1}
          >
            {inspector ? inspector.name : 'No inspector assigned'}
          </AppText>
        </View>

        {issues.length > 0 ? (
          <View style={styles.issues}>
            {issues.map((issue) => {
              const presentation = severityPresentation[issue.severity];
              const tone = toneColors(presentation.tone);
              return (
                <View key={`${issue.code}-${issue.relatedInspectionId ?? ''}`} style={styles.issueRow}>
                  <Ionicons name={presentation.icon} size={13} color={tone.fg} />
                  <AppText variant="caption" color={tone.fg} numberOfLines={2} style={styles.flex}>
                    {issue.message}
                  </AppText>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  cardHovered: { borderColor: colors.borderStrong },
  cardClosed: { backgroundColor: colors.surfaceMuted },
  stripe: { width: 3 },
  body: { flex: 1, padding: spacing.md, gap: spacing.xs },
  headline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headlineSpacer: { flex: 1 },
  title: { marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  issues: {
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  issueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
