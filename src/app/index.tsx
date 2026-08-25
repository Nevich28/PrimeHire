import { router } from 'expo-router';

import { ScheduleShell } from '@/features/schedule/ScheduleShell';
import { EmptyState, useIsWide } from '@/ui/primitives';

/**
 * The schedule with nothing selected.
 *
 * On a phone this is the whole screen. On a wide screen the right-hand pane is
 * a prompt rather than a blank area, because an empty half of the window reads
 * as something failing to load.
 */
export default function ScheduleRoute() {
  const isWide = useIsWide();

  return (
    <ScheduleShell
      // navigate rather than push: tapping the same row twice, which is easy to
      // do on a phone, should not stack the same screen on top of itself.
      onSelect={(id) => router.navigate({ pathname: '/inspection/[id]', params: { id } })}
      onCreate={() => router.navigate('/inspection/new')}
      onOpenInspectors={() => router.navigate('/inspectors')}
      detail={
        isWide ? (
          <EmptyState
            icon="documents-outline"
            title="Select an inspection"
            message="Pick anything on the left to see the site, the contact numbers and what needs doing."
          />
        ) : null
      }
    />
  );
}
