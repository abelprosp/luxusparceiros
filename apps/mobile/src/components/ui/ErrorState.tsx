import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './Button';
import { spacing, typography } from '@/theme';

interface ErrorStateProps {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorState({
  title = 'Não foi possível carregar',
  message,
  onRetry,
  retrying,
}: ErrorStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container} accessibilityRole="alert">
      <AlertCircle size={44} color={colors.error} />
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {message || 'Verifique sua conexão e tente novamente.'}
      </Text>
      {onRetry && (
        <Button
          title="Tentar novamente"
          variant="outline"
          onPress={onRetry}
          loading={retrying}
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.h3,
    textAlign: 'center',
  },
  message: {
    ...typography.bodySmall,
    textAlign: 'center',
    maxWidth: 280,
  },
  button: {
    marginTop: spacing.md,
  },
});
