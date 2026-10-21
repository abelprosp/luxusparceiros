import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, Share, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FileText, Download } from 'lucide-react-native';
import { formatDate } from '@luxus/utils';
import { UserRole } from '@luxus/types';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { requestsApi, type RequestItem } from '@/services/api';
import { Badge, SkeletonList, EmptyState, ErrorState, Button } from '@/components/ui';
import { useInfiniteList } from '@/hooks/useInfiniteList';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FAB } from '@/components/FAB';
import { getStatusLabel, REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from '@/utils/labels';
import { spacing, typography, radius } from '@/theme';

export default function SolicitacoesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const canCreate = user?.role === UserRole.ADMIN;
  const fetchRequests = useCallback((page: number) => requestsApi.list({ page }), []);
  const list = useInfiniteList<RequestItem>(fetchRequests);
  const requests = list.items;

  const handleExport = async () => {
    try {
      const csv = await requestsApi.exportCsv();
      await Share.share({ message: csv, title: 'solicitacoes.csv' });
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao exportar');
    }
  };

  const renderItem = ({ item }: { item: RequestItem }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/(tabs)/solicitacoes/${item.id}` as never)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={[styles.protocol, { color: colors.text }]}>{item.protocol}</Text>
        <Badge label={getStatusLabel(item.status, REQUEST_STATUS_LABELS)} />
      </View>
      <Text style={[styles.type, { color: colors.primary }]}>
        {getStatusLabel(item.type, REQUEST_TYPE_LABELS)}
      </Text>
      <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={2}>{item.description}</Text>
      <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(item.createdAt)}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Demandas" subtitle={`${list.total} demanda(s)`} showBack />

        <Button
          title="Chamados anteriores"
          variant="outline"
          onPress={() => router.push('/(tabs)/chamados' as never)}
          fullWidth
        />

        <Button
          title="Exportar demandas"
          variant="outline"
          onPress={handleExport}
          icon={<Download size={18} color={colors.primary} />}
          fullWidth
        />

        {list.loading ? (
          <SkeletonList />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.retry} />
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            onEndReached={list.loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={list.loadingMore ? <ActivityIndicator color={colors.primary} style={styles.footer} /> : null}
            refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.primary} />}
            ListEmptyComponent={
              <EmptyState
                icon={<FileText size={48} color={colors.textSecondary} />}
                title="Nenhuma demanda"
                actionLabel={canCreate ? 'Nova demanda' : undefined}
                onAction={canCreate ? () => router.push('/(tabs)/solicitacoes/nova' as never) : undefined}
              />
            }
          />
        )}
      </View>
      {canCreate && <FAB href="/(tabs)/solicitacoes/nova" />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: spacing.md, gap: spacing.md },
  list: { gap: spacing.sm, paddingBottom: 80 },
  footer: { paddingVertical: spacing.md },
  card: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  protocol: { ...typography.label, fontWeight: '700' },
  type: { ...typography.bodySmall, fontWeight: '600' },
  desc: { ...typography.bodySmall },
  date: { ...typography.caption },
});
