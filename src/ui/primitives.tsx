/**
 * The small set of primitives every screen is built from.
 *
 * React Native has no cascade, so shared styling has to live in components
 * rather than in stylesheets. Keeping the set deliberately small — text, badge,
 * card, button, chip, field — is what makes the phone and the desktop layouts
 * feel like the same product instead of two implementations.
 */

import { Ionicons } from '@expo/vector-icons';
import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, elevation, monoFont, radius, spacing, typography, WIDE_BREAKPOINT } from './theme';

/* ------------------------------------------------------------ responsive -- */

const ViewportWidthContext = createContext<number | null>(null);

/**
 * Measures the app's own container rather than trusting `Dimensions`.
 *
 * `useWindowDimensions` is the obvious choice and it is correct on device, but
 * on the web it did not re-emit when the browser window was resized, so the
 * layout stayed on whichever side of the breakpoint it started on. `onLayout`
 * is driven by a resize observer on the web and by the native layout pass on
 * device, so one code path is right on both.
 */
export function ViewportProvider({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState<number | null>(null);

  const measure = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((current) => (current === next ? current : next));
  };

  return (
    <View style={styles.viewport} onLayout={measure}>
      <ViewportWidthContext.Provider value={width}>{children}</ViewportWidthContext.Provider>
    </View>
  );
}

/** True once there is room to show the schedule and an inspection side by side. */
export function useIsWide(): boolean {
  const measured = useContext(ViewportWidthContext);
  // Falls back to the window until the first layout pass has happened.
  const { width } = useWindowDimensions();
  return (measured ?? width) >= WIDE_BREAKPOINT;
}

/* ------------------------------------------------------------------ text -- */

type TextVariant = keyof typeof typography;

type AppTextProps = {
  children: ReactNode;
  variant?: TextVariant;
  color?: string;
  mono?: boolean;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  /** Slight letter spacing for all-caps micro labels. */
  uppercase?: boolean;
};

export function AppText({
  children,
  variant = 'body',
  color = colors.text,
  mono = false,
  numberOfLines,
  style,
  uppercase = false,
}: AppTextProps) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        typography[variant] as TextStyle,
        { color },
        mono && { fontFamily: monoFont },
        uppercase && { textTransform: 'uppercase', letterSpacing: 0.6 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ----------------------------------------------------------------- badge -- */

export type Tone = 'neutral' | 'accent' | 'blocker' | 'warning' | 'info' | 'success';

const TONE_COLORS: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.textSecondary, bg: colors.neutralSoft },
  accent: { fg: colors.accent, bg: colors.accentSoft },
  blocker: { fg: colors.blocker, bg: colors.blockerSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  success: { fg: colors.success, bg: colors.successSoft },
};

export function toneColors(tone: Tone) {
  return TONE_COLORS[tone];
}

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { fg, bg } = TONE_COLORS[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={11} color={fg} /> : null}
      <AppText variant="micro" color={fg} uppercase>
        {label}
      </AppText>
    </View>
  );
}

/** A coloured dot, for priority where a full badge would be too loud. */
export function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

/* ------------------------------------------------------------------ card -- */

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, elevation.card, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

/* ---------------------------------------------------------------- button -- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  busy = false,
  fullWidth = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  busy?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = BUTTON_PALETTE[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : 1,
        },
        fullWidth && styles.buttonFullWidth,
        hovered && !disabled && { backgroundColor: palette.bgHover },
        pressed && !disabled && { backgroundColor: palette.bgHover, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={16} color={palette.fg} /> : null}
          <AppText variant="label" color={palette.fg}>
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const BUTTON_PALETTE: Record<
  ButtonVariant,
  { bg: string; bgHover: string; border: string; fg: string }
> = {
  primary: {
    bg: colors.accent,
    bgHover: colors.accentHover,
    border: colors.accent,
    fg: colors.textInverse,
  },
  secondary: {
    bg: colors.surface,
    bgHover: colors.surfaceMuted,
    border: colors.borderStrong,
    fg: colors.text,
  },
  ghost: {
    bg: 'transparent',
    bgHover: colors.neutralSoft,
    border: 'transparent',
    fg: colors.accent,
  },
  danger: {
    bg: colors.surface,
    bgHover: colors.blockerSoft,
    border: colors.blocker,
    fg: colors.blocker,
  },
};

/** Compact icon-only control, used for back and close. */
export function IconButton({
  icon,
  onPress,
  label,
  tone = colors.textSecondary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Screen-reader label; the glyph alone means nothing to a reader. */
  label: string;
  tone?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.iconButton,
        (hovered || pressed) && { backgroundColor: colors.neutralSoft },
      ]}
    >
      <Ionicons name={icon} size={20} color={tone} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ chip -- */

export function Chip({
  label,
  selected,
  onPress,
  count,
  tone = 'accent',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  count?: number;
  tone?: Tone;
}) {
  const palette = TONE_COLORS[tone];
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ hovered }: { hovered?: boolean }) => [
        styles.chip,
        selected
          ? { backgroundColor: palette.fg, borderColor: palette.fg }
          : { backgroundColor: colors.surface, borderColor: colors.border },
        hovered && !selected && { borderColor: colors.borderStrong },
      ]}
    >
      <AppText variant="label" color={selected ? colors.textInverse : colors.textSecondary}>
        {label}
      </AppText>
      {count !== undefined ? (
        <View
          style={[
            styles.chipCount,
            { backgroundColor: selected ? 'rgba(255,255,255,0.22)' : colors.neutralSoft },
          ]}
        >
          <AppText variant="micro" color={selected ? colors.textInverse : colors.textSecondary}>
            {count}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ----------------------------------------------------------------- field -- */

export function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="label" color={colors.textSecondary}>
        {label}
      </AppText>
      {children}
      {error ? (
        <AppText variant="caption" color={colors.blocker}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color={colors.textMuted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  invalid = false,
  keyboardType,
  maxLength,
  autoFocus,
  style,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  invalid?: boolean;
  keyboardType?: 'default' | 'number-pad';
  maxLength?: number;
  autoFocus?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
      keyboardType={keyboardType}
      maxLength={maxLength}
      autoFocus={autoFocus}
      style={[
        styles.input,
        multiline && styles.inputMultiline,
        invalid && { borderColor: colors.blocker },
        // Browsers draw their own focus ring; the app draws its own everywhere.
        Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
        style,
      ]}
    />
  );
}

/* ------------------------------------------------------------ empty state -- */

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={22} color={colors.textMuted} />
      </View>
      <AppText variant="bodyStrong">{title}</AppText>
      <AppText variant="caption" color={colors.textSecondary} style={styles.emptyMessage}>
        {message}
      </AppText>
      {action}
    </View>
  );
}

/* ----------------------------------------------------------------- rows -- */

/** Label/value row used across the inspection and project detail panels. */
export function DetailRow({
  icon,
  label,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} style={styles.detailIcon} />
      <View style={styles.detailBody}>
        <AppText variant="micro" color={colors.textMuted} uppercase>
          {label}
        </AppText>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  divider: { height: 1, backgroundColor: colors.border },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  buttonFullWidth: { alignSelf: 'stretch' },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipCount: {
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  field: { gap: spacing.xs },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyMessage: { textAlign: 'center', maxWidth: 320 },
  detailRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  detailIcon: { marginTop: 2 },
  detailBody: { flex: 1, gap: 2 },
});
