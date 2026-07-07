import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, spacing, typography } from '@/theme';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
  accent?: boolean;
}

export function MetricCard({ label, value, icon, trend, accent = false }: MetricCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: accent ? colors.primary : colors.card,
          borderColor: accent ? colors.primary : colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        {icon && (
          <View style={[styles.iconWrapper, { backgroundColor: accent ? 'rgba(255,255,255,0.2)' : `${colors.primary}15` }]}>
            {icon}
          </View>
        )}
        {trend && (
          <Text style={[styles.trend, { color: accent ? '#FFFFFF' : colors.success }]}>{trend}</Text>
        )}
      </View>
      <Text style={[styles.value, { color: accent ? '#FFFFFF' : colors.text }]}>{value}</Text>
      <Text style={[styles.label, { color: accent ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...typography.h2,
    fontSize: 24,
  },
  label: {
    ...typography.caption,
  },
  trend: {
    ...typography.caption,
    fontWeight: '600',
  },
});
