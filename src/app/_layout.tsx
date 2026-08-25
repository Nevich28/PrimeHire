import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useInspectionStore } from '@/domain/store';
import { ViewportProvider } from '@/ui/primitives';
import { colors } from '@/ui/theme';

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

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
});
