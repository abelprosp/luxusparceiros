import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Store } from 'lucide-react-native';
import { formatDate } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { branchesApi, type BranchItem } from '@/services/api';
import { Badge, SkeletonList, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FAB } from '@/components/FAB';
import { spacing, typography, radius } from '@/theme';

const BRANCH_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Ativa',
  INACTIVE: 'Inativa',
};

export default function FiliaisScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await branchesApi.list();
      if (response.success && response.data) setBranches(response.data.data);
    } catch {
      setBranches([]);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const renderItem = ({ item }: { item: BranchItem }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/(tabs)/filiais/${item.id}` as never)}
    >
      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
        <Badge label={BRANCH_STATUS_LABELS[item.status] ?? item.status} />
      </View>
      <Text style={[styles.detail, { color: colors.textSecondary }]}>{item.city ?? ''}{item.state ? ` - ${item.state}` : ''}</Text>
      <Text style={[styles.detail, { color: colors.textSecondary }]}>Login: {item.users?.[0]?.email ?? '-'}</Text>
      <Text style={[styles.date, { color: colors.textSecondary }]}>{formatDate(item.createdAt)}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Filiais" subtitle={`${branches.length} filial(is)`} showBack />

        {loading ? (
          <SkeletonList />
        ) : (
          <FlatList
            data={branches}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon={<Store size={48} color={colors.textSecondary} />}
                title="Nenhuma filial"
                actionLabel="Nova filial"
                onAction={() => router.push('/(tabs)/filiais/nova' as never)}
              />
            }
          />
        )}
      </View>
      <FAB href="/(tabs)/filiais/nova" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: spacing.md, gap: spacing.md },
  list: { gap: spacing.sm, paddingBottom: 80 },
  card: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { ...typography.label, fontWeight: '700', flex: 1 },
  detail: { ...typography.bodySmall },
  date: { ...typography.caption },
});
