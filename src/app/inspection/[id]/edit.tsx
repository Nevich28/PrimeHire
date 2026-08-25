import { router, useLocalSearchParams } from 'expo-router';

import { InspectionForm } from '@/features/inspection/InspectionForm';

/**
 * Editing and rescheduling are the same screen.
 *
 * Splitting them would mean two forms that can disagree with each other, and in
 * practice they happen together: work moves and the details move with it.
 * Reassigning is not here — that is one decision, and it happens in place on
 * the inspection rather than through a form.
 */
export default function EditInspectionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <InspectionForm
      inspectionId={id}
      onDone={(savedId) => router.replace({ pathname: '/inspection/[id]', params: { id: savedId } })}
      onCancel={() =>
        router.canGoBack()
          ? router.back()
          : router.replace({ pathname: '/inspection/[id]', params: { id } })
      }
    />
  );
}
