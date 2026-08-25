/**
 * Design tokens.
 *
 * One light theme, executed properly, rather than a half-finished dark mode as
 * well. The palette is deliberately quiet: this is a tool somebody stares at
 * for eight hours, so colour is reserved for meaning — severity, status and the
 * single accent used for actions. Everything else is neutral.
 */

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  /** Page background, one step down from cards so surfaces read as raised. */
  canvas: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFB',
  border: '#E2E7EC',
  borderStrong: '#CBD3DB',

  text: '#151A21',
  textSecondary: '#5A6675',
  textMuted: '#8B95A3',
  textInverse: '#FFFFFF',

  accent: '#1B4E82',
  accentHover: '#16406C',
  accentSoft: '#EBF2F9',

  blocker: '#B02A31',
  blockerSoft: '#FDECEC',
  warning: '#A4650B',
  warningSoft: '#FDF4E4',
  info: '#1B5E8C',
  infoSoft: '#ECF3F9',
  success: '#1B7A4C',
  successSoft: '#E9F5EE',
  neutralSoft: '#EEF1F4',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  micro: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
} satisfies Record<string, TextStyle>;

/** Shadows differ per platform; this keeps call sites from caring. */
export const elevation = {
  card: Platform.select<ViewStyle>({
    web: { boxShadow: '0 1px 2px rgba(21, 26, 33, 0.06)' } as ViewStyle,
    ios: {
      shadowColor: '#151A21',
      shadowOpacity: 0.06,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
    },
    default: { elevation: 1 },
  })!,
  raised: Platform.select<ViewStyle>({
    web: { boxShadow: '0 8px 24px rgba(21, 26, 33, 0.14)' } as ViewStyle,
    ios: {
      shadowColor: '#151A21',
      shadowOpacity: 0.16,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    default: { elevation: 8 },
  })!,
};

/** Monospaced stack for project codes and times, so columns line up. */
export const monoFont = Platform.select({
  web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  ios: 'Menlo',
  default: 'monospace',
});

/**
 * The single breakpoint in the product.
 *
 * Below it the app is a phone: one column, thumb-sized targets. Above it there
 * is room for the schedule and an inspection side by side, which is how the
 * same people work at a desk.
 */
export const WIDE_BREAKPOINT = 900;

/** Comfortable reading measure for the single-column layout. */
export const CONTENT_MAX_WIDTH = 720;
