import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInspectionStore } from '@/domain/store';
import { CancelDialog } from '@/features/inspection/CancelDialog';
import { InspectionDetail } from '@/features/inspection/InspectionDetail';
import { ScheduleShell } from '@/features/schedule/ScheduleShell';
import { useSchedule } from '@/state/useSchedule';
import { AppText, Button, EmptyState, IconButton, useIsWide } from '@/ui/primitives';
import { colors, spacing } from '@/ui/theme';

/**
 * One inspection.
 *
 * The route is the same on both layouts, so a link to an inspection works from
 * a phone, from a browser address bar and from the back button. Wide screens
 * render it inside the schedule; narrow screens render it as its own screen.
 */
export default function InspectionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isWide = useIsWide();
  const insets = useSafeAreaInsets();
  const schedule = useSchedule();
  const [cancelling, setCancelling] = useState(false);

  const completeInspection = useInspectionStore((state) => state.completeInspection);
  const reopenInspection = useInspectionStore((state) => state.reopenInspection);

  const item = id ? schedule.byId[id] : undefined;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const detail = item ? (
    <InspectionDetail
      item={item}
      issues={schedule.issuesByInspection[item.inspection.id] ?? []}
      now={schedule.now}
      onEdit={() =>
        router.push({ pathname: '/inspection/[id]/edit', params: { id: item.inspection.id } })
      }
      onAssign={() =>
        router.push({
          pathname: '/inspection/[id]/edit',
          params: { id: item.inspection.id, focus: 'inspector' },
        })
      }
      onCancel={() => setCancelling(true)}
      onComplete={() => completeInspection(item.inspection.id)}
      onReopen={() => reopenInspection(item.inspection.id)}
    />
  ) : (
    <EmptyState
      icon="help-circle-outline"
      title="Inspection not found"
      message="It may have been removed since this link was shared."
      action={<Button label="Back to schedule" onPress={() => router.replace('/')} />}
    />
  );

  const dialog = item ? (
    <CancelDialog
      visible={cancelling}
      item={item}
      onClose={() => setCancelling(false)}
      onCancelled={() => {
        setCancelling(false);
        if (!isWide) goBack();
      }}
    />
  ) : null;

  if (isWide) {
    return (
      <>
        <ScheduleShell
          selectedId={id}
          detail={detail}
          onSelect={(next) => router.replace({ pathname: '/inspection/[id]', params: { id: next } })}
          onCreate={() => router.push('/inspection/new')}
          onOpenInspectors={() => router.push('/inspectors')}
        />
        {dialog}
      </>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <IconButton icon="chevron-back" label="Back to schedule" onPress={goBack} />
        <AppText variant="heading" numberOfLines={1} style={styles.headerTitle}>
          {item ? item.project.code : 'Inspection'}
        </AppText>
      </View>
      {detail}
      {dialog}
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
  headerTitle: { flex: 1 },
});
