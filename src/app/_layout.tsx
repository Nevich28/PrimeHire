import { Stack } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useInspectionStore } from '@/domain/store';
import '@/ui/global-styles';
import { AppText, Button, Card, ViewportProvider } from '@/ui/primitives';
import { colors, CONTENT_MAX_WIDTH, spacing } from '@/ui/theme';

export default function RootLayout() {
  // Rendering the seed and then swapping in stored data would make the first
  // frame lie, so the app waits for AsyncStorage. In practice this is a frame
  // or two; the spinner exists for the case where it is not.
  const hydrated = useInspectionStore((state) => state.hydrated);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ViewportProvider>
        {hydrated ? (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.canvas },
              animation: 'slide_from_right',
            }}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}
      </ViewportProvider>
    </SafeAreaProvider>
  );
}

/**
 * What a crash looks like.
 *
 * The default is a blank screen on the web and a red box on device, and either
 * one strands somebody who is standing next to a site gate. This keeps the
 * schedule reachable, offers a retry, and says plainly that nothing they
 * entered has been lost — the working set is on the device, not in this render.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <ScrollView contentContainerStyle={styles.errorScreen}>
        <Card style={styles.errorCard}>
          <AppText variant="title">Something went wrong</AppText>
          <AppText variant="body" color={colors.textSecondary}>
            This screen failed to load. Your inspections are stored on this device and have not
            been affected.
          </AppText>

          <View style={styles.errorDetail}>
            <AppText variant="micro" color={colors.textMuted} uppercase>
              Details
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {error.message || 'No error message was provided.'}
            </AppText>
          </View>

          <Button label="Try again" icon="refresh-outline" onPress={retry} />
        </Card>
      </ScrollView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  errorScreen: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.canvas,
  },
  errorCard: {
    padding: spacing.xl,
    gap: spacing.md,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
  errorDetail: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
});
