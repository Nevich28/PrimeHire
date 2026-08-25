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
      onSelect={(id) => router.push({ pathname: '/inspection/[id]', params: { id } })}
      onCreate={() => router.push('/inspection/new')}
      onOpenInspectors={() => router.push('/inspectors')}
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
