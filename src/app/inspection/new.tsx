import { router } from 'expo-router';

import { InspectionForm } from '@/features/inspection/InspectionForm';

/** Scheduling new work. Saving lands on the inspection that was just created. */
export default function NewInspectionRoute() {
  return (
    <InspectionForm
      onDone={(id) => router.replace({ pathname: '/inspection/[id]', params: { id } })}
      onCancel={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
