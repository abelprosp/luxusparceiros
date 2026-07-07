import { LUXUS_COLORS } from '@luxus/utils';

export const colors = {
  ...LUXUS_COLORS,
  primary: '#0057FF',
  primaryLight: '#2D8CFF',
  black: '#0B0B0B',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  border: '#E5E7EB',
  borderDark: '#2A2A2A',
  surface: '#FFFFFF',
  surfaceDark: '#141414',
  background: '#F5F5F7',
  backgroundDark: '#0B0B0B',
  text: '#0B0B0B',
  textDark: '#FFFFFF',
  textSecondary: '#6B7280',
  textSecondaryDark: '#9CA3AF',
  card: '#FFFFFF',
  cardDark: '#1A1A1A',
  tabBar: '#FFFFFF',
  tabBarDark: '#141414',
} as const;

export type ThemeColors = {
  primary: string;
  primaryLight: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  tabBar: string;
  success: string;
  warning: string;
  error: string;
};

export function getThemeColors(isDark: boolean): ThemeColors {
  return {
    primary: colors.primary,
    primaryLight: colors.primaryLight,
    background: isDark ? colors.backgroundDark : colors.background,
    surface: isDark ? colors.surfaceDark : colors.surface,
    card: isDark ? colors.cardDark : colors.card,
    text: isDark ? colors.textDark : colors.text,
    textSecondary: isDark ? colors.textSecondaryDark : colors.textSecondary,
    border: isDark ? colors.borderDark : colors.border,
    tabBar: isDark ? colors.tabBarDark : colors.tabBar,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodySmall: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  label: { fontSize: 14, fontWeight: '500' as const },
};
