import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Headphones } from 'lucide-react-native';
import { formatDate } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { ticketsApi, type Ticket } from '@/services/api';
import { Badge, SkeletonList, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FAB } from '@/components/FAB';
import { getStatusLabel, TICKET_STATUS_LABELS, TICKET_CATEGORY_LABELS } from '@/utils/labels';
import { spacing, typography, radius } from '@/theme';

export default function ChamadosScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await ticketsApi.list();
      if (response.success && response.data) setTickets(response.data.data);
    } catch {
      setTickets([]);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const renderItem = ({ item }: { item: Ticket }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/(tabs)/chamados/${item.id}` as never)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={[styles.protocol, { color: colors.text }]}>{item.protocol}</Text>
        <Badge label={getStatusLabel(item.status, TICKET_STATUS_LABELS)} />
      </View>
      <Text style={[styles.subject, { color: colors.text }]} numberOfLines={1}>{item.subject}</Text>
      <View style={styles.footer}>
        <Badge label={getStatusLabel(item.category, TICKET_CATEGORY_LABELS)} variant="outline" />
        <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Chamados" subtitle={`${tickets.length} chamado(s)`} showBack />

        {loading ? (
          <SkeletonList />
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
            ListEmptyComponent={
              <EmptyState
                icon={<Headphones size={48} color={colors.textSecondary} />}
                title="Nenhum chamado aberto"
                actionLabel="Novo chamado"
                onAction={() => router.push('/(tabs)/chamados/nova' as never)}
              />
            }
          />
        )}
      </View>
      <FAB href="/(tabs)/chamados/nova" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: spacing.md, gap: spacing.md },
  list: { gap: spacing.sm, paddingBottom: 80 },
  card: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  protocol: { ...typography.label, fontWeight: '700' },
  subject: { ...typography.bodySmall, fontWeight: '500' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
  date: { ...typography.caption },
});
