import React from 'react';
import { View, Text, StyleSheet, type ViewProps } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, spacing, typography } from '@/theme';

interface CardProps extends ViewProps {
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  noPadding?: boolean;
}

export function Card({
  title,
  subtitle,
  headerRight,
  noPadding = false,
  children,
  style,
  ...props
}: CardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        style,
      ]}
      {...props}
    >
      {(title || headerRight) && (
        <View style={[styles.header, !noPadding && styles.headerPadding]}>
          <View style={styles.headerText}>
            {title && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
            {subtitle && (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            )}
          </View>
          {headerRight}
        </View>
      )}
      <View style={!noPadding ? styles.content : undefined}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerPadding: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.h3,
  },
  subtitle: {
    ...typography.caption,
  },
  content: {
    padding: spacing.md,
  },
});
