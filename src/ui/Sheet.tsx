/**
 * Modal surface.
 *
 * The same content is presented the way each device expects it: a sheet rising
 * from the bottom edge on a phone, a centred dialog on a desktop. Both dismiss
 * on backdrop press and on Escape, which people expect on the web and which
 * costs nothing on native.
 */

import { useEffect, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, IconButton, useIsWide } from './primitives';
import { colors, elevation, radius, spacing } from './theme';

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const isWide = useIsWide();
  const insets = useSafeAreaInsets();

  // `onRequestClose` covers the Android back gesture. On the web, dismissing a
  // dialog with Escape is something people simply expect, and React Native's
  // Modal does not wire it up.
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      // On the web, react-native-web keeps an animated modal mounted until the
      // CSS animation reports back, so a dropped animationend event leaves a
      // dialog that will not close. A desktop dialog appearing instantly is
      // normal anyway; the phone keeps the sheet transition it should have.
      animationType={Platform.OS === 'web' ? 'none' : isWide ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <View
          style={[
            isWide ? styles.dialog : styles.sheet,
            elevation.raised,
            !isWide && { paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          {!isWide ? <View style={styles.grabber} /> : null}

          <View style={styles.header}>
            <View style={styles.headerText}>
              <AppText variant="title">{title}</AppText>
              {subtitle ? (
                <AppText variant="caption" color={colors.textSecondary}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(21, 26, 33, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    paddingTop: spacing.sm,
    maxHeight: '92%',
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    width: 560,
    maxWidth: '92%',
    maxHeight: '86%',
    alignSelf: 'center',
    marginVertical: 'auto',
    paddingTop: spacing.sm,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerText: { flex: 1, gap: 2 },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
