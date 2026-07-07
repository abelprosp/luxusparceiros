import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, User, Filter } from 'lucide-react-native';
import { formatDocument, formatPhone, getInitials } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { clientsApi, type Client } from '@/services/api';
import { Input, Badge, SkeletonList, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FAB } from '@/components/FAB';
import { spacing, typography, radius } from '@/theme';

export default function ClientesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterActive, setFilterActive] = useState<boolean | null>(null);

  const loadClients = useCallback(async () => {
    try {
      const response = await clientsApi.list({ search: search || undefined });
      if (response.success && response.data) {
        let data = response.data.data;
        if (filterActive !== null) {
          data = data.filter((c) => c.isActive === filterActive);
        }
        setClients(data);
      }
    } catch {
      setClients([]);
    }
  }, [search, filterActive]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadClients().finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [loadClients]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClients();
    setRefreshing(false);
  };

  const renderClient = ({ item }: { item: Client }) => (
    <TouchableOpacity
      style={[styles.clientCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/(tabs)/clientes/${item.id}` as never)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: `${colors.primary}20` }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>
          {getInitials(item.name)}
        </Text>
      </View>
      <View style={styles.clientInfo}>
        <Text style={[styles.clientName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.clientDoc, { color: colors.textSecondary }]}>
          {formatDocument(item.document)}
        </Text>
        <Text style={[styles.clientPhone, { color: colors.textSecondary }]}>
          {formatPhone(item.phone)}
        </Text>
      </View>
      <Badge label={item.isActive ? 'Ativo' : 'Inativo'} color={item.isActive ? colors.success : colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Clientes" subtitle={`${clients.length} cadastrados`} />

        <Input
          placeholder="Buscar por nome ou documento..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={20} color={colors.textSecondary} />}
        />

        <View style={styles.filters}>
          {(['Todos', 'Ativos', 'Inativos'] as const).map((label, i) => {
            const value = i === 0 ? null : i === 1;
            const active = filterActive === value;
            return (
              <TouchableOpacity
                key={label}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFilterActive(value)}
              >
                <Text style={{ color: active ? '#FFF' : colors.text, ...typography.caption }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <SkeletonList />
        ) : (
          <FlatList
            data={clients}
            keyExtractor={(item) => item.id}
            renderItem={renderClient}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <EmptyState
                icon={<User size={48} color={colors.textSecondary} />}
                title="Nenhum cliente encontrado"
                description="Cadastre seu primeiro cliente para começar"
                actionLabel="Novo cliente"
                onAction={() => router.push('/(tabs)/clientes/novo' as never)}
              />
            }
          />
        )}
      </View>

      <FAB href="/(tabs)/clientes/novo" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: 80,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.label,
    fontWeight: '700',
  },
  clientInfo: {
    flex: 1,
    gap: 2,
  },
  clientName: {
    ...typography.label,
    fontWeight: '600',
  },
  clientDoc: {
    ...typography.caption,
  },
  clientPhone: {
    ...typography.caption,
  },
});
