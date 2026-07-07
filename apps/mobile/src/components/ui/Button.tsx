import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  type TouchableOpacityProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, spacing, typography } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();

  const variantStyles: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
    primary: { bg: colors.primary, text: '#FFFFFF' },
    secondary: { bg: colors.primaryLight, text: '#FFFFFF' },
    outline: { bg: 'transparent', text: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', text: colors.text },
    danger: { bg: colors.error, text: '#FFFFFF' },
  };

  const sizeStyles: Record<ButtonSize, { padding: number; fontSize: number }> = {
    sm: { padding: spacing.sm, fontSize: 14 },
    md: { padding: spacing.md, fontSize: 16 },
    lg: { padding: spacing.lg, fontSize: 18 },
  };

  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border ?? 'transparent',
          borderWidth: v.border ? 1.5 : 0,
          paddingVertical: s.padding,
          opacity: disabled || loading ? 0.6 : 1,
        },
        fullWidth && styles.fullWidth,
        style as ViewStyle,
      ]}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: v.text, fontSize: s.fontSize }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    ...typography.label,
    fontWeight: '600',
  },
});
