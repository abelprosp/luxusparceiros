import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, Share, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FileText, Download } from 'lucide-react-native';
import { formatDate } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { requestsApi, type RequestItem } from '@/services/api';
import { Badge, SkeletonList, EmptyState, Button } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FAB } from '@/components/FAB';
import { getStatusLabel, REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from '@/utils/labels';
import { spacing, typography, radius } from '@/theme';

export default function SolicitacoesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await requestsApi.list();
      if (response.success && response.data) setRequests(response.data.data);
    } catch {
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

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
        <ScreenHeader title="Solicitações" subtitle={`${requests.length} solicitação(ões)`} showBack />

        <Button
          title="Exportar solicitações"
          variant="outline"
          onPress={handleExport}
          icon={<Download size={18} color={colors.primary} />}
          fullWidth
        />

        {loading ? (
          <SkeletonList />
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
            ListEmptyComponent={
              <EmptyState
                icon={<FileText size={48} color={colors.textSecondary} />}
                title="Nenhuma solicitação"
                actionLabel="Nova solicitação"
                onAction={() => router.push('/(tabs)/solicitacoes/nova' as never)}
              />
            }
          />
        )}
      </View>
      <FAB href="/(tabs)/solicitacoes/nova" />
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
  type: { ...typography.bodySmall, fontWeight: '600' },
  desc: { ...typography.bodySmall },
  date: { ...typography.caption },
});
