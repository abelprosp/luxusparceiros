import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DollarSign } from 'lucide-react-native';
import { formatCurrency, formatDate } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { commissionsApi, type Commission } from '@/services/api';
import { Card, Badge, SkeletonList, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { MetricCard } from '@/components/MetricCard';
import { getStatusLabel, COMMISSION_STATUS_LABELS } from '@/utils/labels';
import { spacing, typography, radius } from '@/theme';

export default function ComissoesScreen() {
  const { colors } = useTheme();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [summary, setSummary] = useState({ forecast: 0, approved: 0, paid: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [listRes, summaryRes] = await Promise.all([
        commissionsApi.list(),
        commissionsApi.summary(),
      ]);
      if (listRes.success && listRes.data) setCommissions(listRes.data.data);
      if (summaryRes.success && summaryRes.data) setSummary(summaryRes.data);
    } catch {
      setCommissions([]);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const renderItem = ({ item }: { item: Commission }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Text style={[styles.value, { color: colors.primary }]}>{formatCurrency(Number(item.value))}</Text>
        <Badge label={getStatusLabel(item.status, COMMISSION_STATUS_LABELS)} />
      </View>
      <Text style={[styles.sale, { color: colors.textSecondary }]}>
        {item.sale?.protocol ?? 'Venda'} · {item.sale?.client?.name ?? ''}
      </Text>
      <Text style={[styles.date, { color: colors.textSecondary }]}>
        {formatDate(item.createdAt)}
        {item.paidAt ? ` · Confirmado em ${formatDate(item.paidAt)}` : ''}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Comissões" subtitle="Extrato e previsões" showBack />

        <View style={styles.metrics}>
          <MetricCard label="Previsão" value={formatCurrency(summary.forecast)} icon={<DollarSign size={18} color={colors.primary} />} />
          <MetricCard label="Aprovadas" value={formatCurrency(summary.approved)} icon={<DollarSign size={18} color={colors.primary} />} />
          <MetricCard label="Confirmadas" value={formatCurrency(summary.paid)} accent icon={<DollarSign size={18} color="#FFF" />} />
        </View>

        {loading ? (
          <SkeletonList />
        ) : (
          <FlatList
            data={commissions}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
            ListEmptyComponent={
              <EmptyState icon={<DollarSign size={48} color={colors.textSecondary} />} title="Nenhuma comissão registrada" />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: spacing.md, gap: spacing.md },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.sm },
  card: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  value: { ...typography.h3 },
  sale: { ...typography.bodySmall },
  date: { ...typography.caption },
});
