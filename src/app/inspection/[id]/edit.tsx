import { router, useLocalSearchParams } from 'expo-router';

import { InspectionForm } from '@/features/inspection/InspectionForm';

/**
 * Editing, rescheduling and reassigning are the same screen.
 *
 * Splitting them would mean three forms that can disagree with each other, and
 * in practice the three happen together: work moves and the person changes.
 * `?focus=inspector` opens straight into the inspector picker, so "assign"
 * still feels like one action rather than a detour through a form.
 */
export default function EditInspectionRoute() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();

  return (
    <InspectionForm
      inspectionId={id}
      focusInspector={focus === 'inspector'}
      onDone={(savedId) => router.replace({ pathname: '/inspection/[id]', params: { id: savedId } })}
      onCancel={() =>
        router.canGoBack()
          ? router.back()
          : router.replace({ pathname: '/inspection/[id]', params: { id } })
      }
    />
  );
}
