import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getStatusColor } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, spacing, typography } from '@/theme';

interface BadgeProps {
  label: string;
  color?: string;
  variant?: 'filled' | 'outline';
}

export function Badge({ label, color, variant = 'filled' }: BadgeProps) {
  const { colors } = useTheme();
  const badgeColor = color ?? getStatusColor(label.toUpperCase().replace(/\s/g, '_'));

  if (variant === 'outline') {
    return (
      <View style={[styles.badge, { borderColor: badgeColor, borderWidth: 1 }]}>
        <Text style={[styles.text, { color: badgeColor }]}>{label}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: `${badgeColor}20` }]}>
      <View style={[styles.dot, { backgroundColor: badgeColor }]} />
      <Text style={[styles.text, { color: badgeColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
