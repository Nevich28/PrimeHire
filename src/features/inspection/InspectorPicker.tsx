/**
 * Choosing who goes to site.
 *
 * This is the moment the product is worth the most, so it does not present a
 * flat alphabetical list. Every inspector is run through the rules engine
 * against the slot being scheduled and sorted by how well they actually fit:
 * free and qualified first, then free, then whoever is already booked — with
 * the clash spelled out rather than implied.
 *
 * Nothing is forbidden. A coordinator sometimes knows something the data does
 * not, so a booked inspector can still be chosen; the consequence is just
 * stated plainly before they commit.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { rankInspectorsForSlot } from '@/domain/rules';
import type { RuleContext } from '@/domain/rules';
import type { Inspection } from '@/domain/types';
import { AppText, Badge, toneColors, type PressableState } from '@/ui/primitives';
import { severityPresentation } from '@/ui/presentation';
import { Sheet } from '@/ui/Sheet';
import { colors, radius, spacing } from '@/ui/theme';

export function InspectorPicker({
  visible,
  draft,
  context,
  onClose,
  onSelect,
}: {
  visible: boolean;
  /** The inspection as it currently stands in the form. */
  draft: Inspection;
  context: RuleContext;
  onClose: () => void;
  onSelect: (inspectorId: string | null) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const options = rankInspectorsForSlot(draft, context);

  // The sheet stays mounted between openings, so the expanded list has to be
  // put away again; otherwise the next inspection opens on somebody else's
  // long list.
  useEffect(() => {
    if (!visible) setShowAll(false);
  }, [visible]);

  /**
   * Who to put in front of the coordinator first.
   *
   * Hiding the rest outright was the obvious alternative and it is wrong here.
   * There are six inspectors covering seven disciplines, so filtering by
   * specialty regularly leaves one candidate — and when that one is busy, an
   * empty list is not an answer to "somebody has to go tomorrow morning". The
   * delivered data makes the same point: a safety inspection on the Luzern
   * hospital is assigned to an inspector signed off for structures and facades.
   * That is how this work actually goes.
   *
   * So the ones who fit lead, everybody else is one tap away, and whoever is
   * currently assigned always stays visible — otherwise you could not see who
   * you were replacing.
   */
  const recommended = options.filter(
    (option) => option.issues.length === 0 || option.inspector.id === draft.inspectorId
  );
  const others = options.filter((option) => !recommended.includes(option));
  const visibleOptions = showAll || recommended.length === 0 ? options : recommended;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Assign an inspector"
      subtitle={
        recommended.length > 0
          ? 'Free at this time and signed off for this discipline.'
          : 'Nobody is both free and signed off, so everybody is listed.'
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Leave unassigned"
        onPress={() => onSelect(null)}
        style={({ hovered }: PressableState) => [
          styles.option,
          hovered && { backgroundColor: colors.surfaceMuted },
          draft.inspectorId === null && styles.optionSelected,
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.neutralSoft }]}>
          <Ionicons name="person-remove-outline" size={16} color={colors.textMuted} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">Leave unassigned</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            It will stay at the top of the schedule until somebody is assigned.
          </AppText>
        </View>
      </Pressable>

      {visibleOptions.map((option) => {
        const { inspector } = option;
        const selected = inspector.id === draft.inspectorId;
        const initials = inspector.name
          .split(' ')
          .map((part) => part[0])
          .join('');

        return (
          <Pressable
            key={inspector.id}
            accessibilityRole="button"
            accessibilityLabel={[
              inspector.name,
              option.available ? 'available' : 'already booked',
              ...option.issues.map((issue) => issue.message),
            ].join('. ')}
            accessibilityState={{ selected }}
            onPress={() => onSelect(inspector.id)}
            style={({ hovered }: PressableState) => [
              styles.option,
              hovered && { backgroundColor: colors.surfaceMuted },
              selected && styles.optionSelected,
            ]}
          >
            <View
              style={[
                styles.avatar,
                { backgroundColor: option.available ? colors.accentSoft : colors.blockerSoft },
              ]}
            >
              <AppText
                variant="micro"
                color={option.available ? colors.accent : colors.blocker}
              >
                {initials}
              </AppText>
            </View>

            <View style={styles.flex}>
              <View style={styles.nameRow}>
                <AppText variant="bodyStrong">{inspector.name}</AppText>
                {option.available && option.matchesSpecialty ? (
                  <Badge label="Best fit" tone="success" icon="checkmark" />
                ) : null}
                {!inspector.active ? <Badge label="Inactive" tone="warning" /> : null}
              </View>

              <AppText variant="caption" color={colors.textMuted}>
                {inspector.specialties.join(' · ')}
              </AppText>

              {option.issues.length === 0 ? (
                <AppText variant="caption" color={colors.success}>
                  Free at this time.
                </AppText>
              ) : (
                option.issues.map((issue, index) => {
                  const tone = toneColors(severityPresentation[issue.severity].tone);
                  return (
                    <View key={`${issue.code}-${index}`} style={styles.issueRow}>
                      <Ionicons
                        name={severityPresentation[issue.severity].icon}
                        size={12}
                        color={tone.fg}
                      />
                      <AppText variant="caption" color={tone.fg} style={styles.flex}>
                        {issue.message}
                      </AppText>
                    </View>
                  );
                })
              )}
            </View>

            {selected ? (
              <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
            ) : null}
          </Pressable>
        );
      })}

      {!showAll && others.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Show ${others.length} more inspectors`}
          onPress={() => setShowAll(true)}
          style={({ hovered }: PressableState) => [
            styles.more,
            hovered && { backgroundColor: colors.surfaceMuted },
          ]}
        >
          <Ionicons name="people-outline" size={15} color={colors.accent} />
          <AppText variant="label" color={colors.accent}>
            Show {others.length} more{' '}
            {others.length === 1 ? 'inspector' : 'inspectors'}
          </AppText>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  issueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
});
