/**
 * Undo for the last change.
 *
 * Every action in this product is something a coordinator does quickly, often
 * on a phone, often on the wrong row. Cancelling an inspection, closing one out
 * or accepting a suggested fix are all one tap away from being a mistake, so
 * each of them leaves a way back for a few seconds.
 *
 * It expires on its own rather than sitting there: an undo bar that never
 * leaves stops reading as a fresh consequence of what you just did.
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useInspectionStore } from '@/domain/store';
import { AppText } from '@/ui/primitives';
import { colors, elevation, radius, spacing } from '@/ui/theme';

const VISIBLE_FOR_MS = 8000;

export function UndoBar({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const undo = useInspectionStore((state) => state.undo);
  const undoLastChange = useInspectionStore((state) => state.undoLastChange);
  const dismissUndo = useInspectionStore((state) => state.dismissUndo);

  const message = undo?.message;

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(dismissUndo, VISIBLE_FOR_MS);
    return () => clearTimeout(timer);
  }, [message, dismissUndo]);

  if (!undo) return null;

  return (
    <View style={[styles.bar, elevation.raised, { bottom: bottomOffset + spacing.lg }]}>
      <Ionicons name="checkmark-circle" size={16} color={colors.textInverse} />
      <AppText variant="label" color={colors.textInverse} style={styles.message} numberOfLines={2}>
        {undo.message}
      </AppText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Undo: ${undo.message}`}
        onPress={undoLastChange}
        style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
          styles.action,
          (hovered || pressed) && { backgroundColor: 'rgba(255,255,255,0.16)' },
        ]}
      >
        <AppText variant="label" color={colors.textInverse}>
          Undo
        </AppText>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={dismissUndo}
        style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
          styles.close,
          (hovered || pressed) && { backgroundColor: 'rgba(255,255,255,0.16)' },
        ]}
      >
        <Ionicons name="close" size={16} color={colors.textInverse} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    maxWidth: 560,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.text,
  },
  message: { flex: 1 },
  action: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  close: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
});
