import { LUXUS_COLORS } from '@luxus/utils';

export { LUXUS_COLORS };

export const luxusTheme = {
  colors: {
    primary: LUXUS_COLORS.primary,
    primaryLight: LUXUS_COLORS.primaryLight,
    background: LUXUS_COLORS.white,
    foreground: LUXUS_COLORS.black,
    muted: LUXUS_COLORS.grayLight,
    border: '#E5E7EB',
  },
  dark: {
    background: LUXUS_COLORS.black,
    foreground: LUXUS_COLORS.white,
    muted: LUXUS_COLORS.grayDark,
    border: '#1F2937',
  },
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  },
} as const;

export * from './components';
