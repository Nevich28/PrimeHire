import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDayHeading, formatTimeRange } from '@/domain/datetime';
import { workloadFor } from '@/domain/selectors';
import { INSPECTOR_LIST } from '@/domain/seed';
import { useSchedule } from '@/state/useSchedule';
import { AppText, Badge, Card, EmptyState, IconButton, type PressableState } from '@/ui/primitives';
import { colors, CONTENT_MAX_WIDTH, radius, spacing } from '@/ui/theme';

/**
 * Who is doing what.
 *
 * The schedule answers "what is happening"; this answers "who is loaded and who
 * is free", which is the other half of the same conversation. It is read-only
 * on purpose — the roster is reference data, and reassignment belongs on the
 * inspection it affects.
 */
export default function InspectorsRoute() {
  const insets = useSafeAreaInsets();
  const schedule = useSchedule();

  const active = INSPECTOR_LIST.filter((inspector) => inspector.active);
  const inactive = INSPECTOR_LIST.filter((inspector) => !inspector.active);

  return (
    <View style={[styles.screen, { paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton
          icon="chevron-back"
          label="Back to schedule"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <AppText variant="heading" style={styles.flex}>
          Inspectors
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {active.map((inspector) => {
          const workload = workloadFor(inspector.id, schedule.items, schedule.now);
          return (
            <Card key={inspector.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{inspector.name}</AppText>
                  <AppText variant="caption" color={colors.textMuted}>
                    {inspector.specialties.join(' · ')}
                  </AppText>
                </View>
                <Badge
                  label={workload.length === 0 ? 'Free' : `${workload.length} booked`}
                  tone={workload.length === 0 ? 'success' : 'accent'}
                />
              </View>

              {workload.length === 0 ? (
                <AppText variant="caption" color={colors.textSecondary}>
                  Nothing on the schedule.
                </AppText>
              ) : (
                workload.map((item) => {
                  const issues = schedule.issuesByInspection[item.inspection.id] ?? [];
                  const clashing = issues.some((issue) => issue.severity === 'blocker');
                  return (
                    <Pressable
                      key={item.inspection.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.inspection.title}, ${item.project.code}, ${formatDayHeading(item.start, schedule.now)} ${formatTimeRange(item.start, item.end)}`}
                      onPress={() =>
                        router.navigate({
                          pathname: '/inspection/[id]',
                          params: { id: item.inspection.id },
                        })
                      }
                      style={({ hovered, pressed }: PressableState) => [
                        styles.row,
                        (hovered || pressed) && { backgroundColor: colors.surfaceMuted },
                      ]}
                    >
                      <View style={styles.rowBody}>
                        <View style={styles.rowWhen}>
                          <AppText variant="caption" mono color={colors.textSecondary}>
                            {formatDayHeading(item.start, schedule.now)}
                          </AppText>
                          <AppText variant="caption" mono color={colors.textMuted}>
                            {formatTimeRange(item.start, item.end)}
                          </AppText>
                          {clashing ? (
                            <Ionicons name="alert-circle" size={13} color={colors.blocker} />
                          ) : null}
                        </View>
                        <AppText variant="caption" numberOfLines={1}>
                          {item.project.code} · {item.inspection.title}
                        </AppText>
                      </View>

                      {/* The row opens the inspection. On a phone there is no
                          hover to hint at that, so it says so with a chevron. */}
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                  );
                })
              )}
            </Card>
          );
        })}

        {inactive.length > 0 ? (
          <>
            <AppText variant="label" color={colors.textSecondary} style={styles.sectionLabel}>
              No longer active
            </AppText>
            {inactive.map((inspector) => (
              <Card key={inspector.id} style={[styles.card, styles.inactiveCard]}>
                <View style={styles.cardHeader}>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" color={colors.textSecondary}>
                      {inspector.name}
                    </AppText>
                    <AppText variant="caption" color={colors.textMuted}>
                      {inspector.specialties.join(' · ')}
                    </AppText>
                  </View>
                  <Badge label="Inactive" tone="warning" />
                </View>
                <AppText variant="caption" color={colors.textSecondary}>
                  Kept for the record on past inspections; cannot be assigned new work.
                </AppText>
              </Card>
            ))}
          </>
        ) : null}

        {INSPECTOR_LIST.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No inspectors"
            message="The roster is empty, so nothing can be assigned."
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  card: { padding: spacing.lg, gap: spacing.sm },
  inactiveCard: { backgroundColor: colors.surfaceMuted },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowBody: { flex: 1, gap: 2 },
  rowWhen: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionLabel: { marginTop: spacing.md },
});
