import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import { formatCurrency, formatDate } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { salesApi, type Sale } from '@/services/api';
import { Badge, SkeletonList, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FAB } from '@/components/FAB';
import { getStatusLabel, SALE_STATUS_LABELS } from '@/utils/labels';
import { spacing, typography, radius } from '@/theme';

const STATUS_FILTERS = ['Todos', 'IN_ANALYSIS', 'DOCUMENTS_PENDING', 'CONTESTED', 'APPROVED', 'ACTIVATED', 'REJECTED'];

export default function VendasScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('Todos');

  const loadSales = useCallback(async () => {
    try {
      const response = await salesApi.list({
        status: statusFilter !== 'Todos' ? statusFilter : undefined,
      });
      if (response.success && response.data) setSales(response.data.data);
    } catch {
      setSales([]);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadSales().finally(() => setLoading(false));
  }, [loadSales]);

  const renderSale = ({ item }: { item: Sale }) => (
    <TouchableOpacity
      style={[styles.saleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.8}
      onPress={() => router.push(`/(tabs)/vendas/${item.id}` as never)}
    >
      <View style={styles.saleHeader}>
        <Text style={[styles.protocol, { color: colors.text }]}>{item.protocol}</Text>
        <Badge label={getStatusLabel(item.status, SALE_STATUS_LABELS)} />
      </View>
      <Text style={[styles.clientName, { color: colors.textSecondary }]}>
        {item.client?.name ?? 'Cliente'}
      </Text>
      {item.requiredDocuments && item.requiredDocuments.length > 0 && item.status === 'DOCUMENTS_PENDING' && (
        <Text style={[styles.docsHint, { color: colors.warning ?? '#f59e0b' }]}>
          Docs pendentes: {item.requiredDocuments.filter((d) => !d.fulfilled).map((d) => d.label).join(', ') || 'prontos para reenvio'}
        </Text>
      )}
      <View style={styles.saleFooter}>
        <Text style={[styles.value, { color: colors.primary }]}>{formatCurrency(Number(item.value))}</Text>
        <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Vendas" subtitle={`${sales.length} venda(s)`} />

        <FlatList
          horizontal
          data={STATUS_FILTERS}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          renderItem={({ item }) => {
            const active = statusFilter === item;
            const label = item === 'Todos' ? item : getStatusLabel(item, SALE_STATUS_LABELS);
            return (
              <TouchableOpacity
                style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }]}
                onPress={() => setStatusFilter(item)}
              >
                <Text style={{ color: active ? '#FFF' : colors.text, ...typography.caption }}>{label}</Text>
              </TouchableOpacity>
            );
          }}
        />

        {loading ? (
          <SkeletonList />
        ) : (
          <FlatList
            data={sales}
            keyExtractor={(item) => item.id}
            renderItem={renderSale}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadSales(); setRefreshing(false); }} tintColor={colors.primary} />}
            ListEmptyComponent={
              <EmptyState
                icon={<ShoppingCart size={48} color={colors.textSecondary} />}
                title="Nenhuma venda encontrada"
                actionLabel="Nova venda"
                onAction={() => router.push('/(tabs)/vendas/nova' as never)}
              />
            }
          />
        )}
      </View>
      <FAB href="/(tabs)/vendas/nova" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: spacing.md, gap: spacing.md },
  filters: { gap: spacing.sm, paddingBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1, marginRight: spacing.sm },
  list: { gap: spacing.sm, paddingBottom: 80 },
  saleCard: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs },
  saleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  protocol: { ...typography.label, fontWeight: '700' },
  clientName: { ...typography.bodySmall },
  docsHint: { ...typography.caption, fontWeight: '600' },
  saleFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  value: { ...typography.label, fontWeight: '600' },
  date: { ...typography.caption },
});
