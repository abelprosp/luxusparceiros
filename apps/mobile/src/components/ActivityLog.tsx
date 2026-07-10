import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp, Clock3 } from 'lucide-react-native';
import { formatDateTime } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import type { ActivityItem } from '@/services/api';
import { REQUEST_STATUS_LABELS, TICKET_STATUS_LABELS } from '@/utils/labels';
import { radius, spacing, typography } from '@/theme';

interface ActivityLogProps {
  entries?: ActivityItem[];
}

const STATUS_LABELS = {
  ...REQUEST_STATUS_LABELS,
  ...TICKET_STATUS_LABELS,
};

export function ActivityLog({ entries = [] }: ActivityLogProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const orderedEntries = useMemo(() => [...entries].reverse(), [entries]);
  const visibleEntries = expanded ? orderedEntries : orderedEntries.slice(0, 3);

  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={styles.titleRow}>
        <Clock3 size={18} color={colors.textSecondary} />
        <Text style={[styles.title, { color: colors.text }]}>Log de atividades</Text>
      </View>

      {visibleEntries.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          Nenhuma atividade registrada.
        </Text>
      ) : (
        <View style={styles.entries}>
          {visibleEntries.map((entry) => {
            const from = entry.fromStatus ? STATUS_LABELS[entry.fromStatus] ?? entry.fromStatus : '';
            const to = entry.toStatus ? STATUS_LABELS[entry.toStatus] ?? entry.toStatus : '';
            return (
              <View key={entry.id} style={[styles.entry, { borderLeftColor: colors.primary }]}>
                <Text style={[styles.action, { color: colors.text }]}>{entry.action}</Text>
                {to ? (
                  <Text style={[styles.detail, { color: colors.textSecondary }]}>
                    {from ? `${from} → ${to}` : to}
                  </Text>
                ) : null}
                {entry.details ? (
                  <Text style={[styles.detail, { color: colors.textSecondary }]}>
                    {entry.details}
                  </Text>
                ) : null}
                <Text style={[styles.date, { color: colors.textSecondary }]}>
                  {formatDateTime(entry.createdAt)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {orderedEntries.length > 3 && (
        <TouchableOpacity style={styles.toggle} onPress={() => setExpanded((value) => !value)}>
          <Text style={[styles.toggleText, { color: colors.primary }]}>
            {expanded ? 'Mostrar menos' : 'Ver histórico completo'}
          </Text>
          {expanded ? (
            <ChevronUp size={16} color={colors.primary} />
          ) : (
            <ChevronDown size={16} color={colors.primary} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.label,
    fontWeight: '600',
  },
  entries: {
    gap: spacing.sm,
  },
  entry: {
    gap: 2,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
  },
  action: {
    ...typography.bodySmall,
    fontWeight: '500',
  },
  detail: {
    ...typography.caption,
  },
  date: {
    ...typography.caption,
    fontSize: 10,
  },
  empty: {
    ...typography.caption,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  toggleText: {
    ...typography.caption,
    fontWeight: '600',
  },
});
