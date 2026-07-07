import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package } from 'lucide-react-native';
import { formatPhone } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { stockApi, type Line } from '@/services/api';
import { Badge, SkeletonList, EmptyState, Button } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { getStatusLabel, LINE_STATUS_LABELS } from '@/utils/labels';
import { spacing, typography, radius } from '@/theme';

export default function EstoqueScreen() {
  const { colors } = useTheme();
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reserving, setReserving] = useState<string | null>(null);

  const loadLines = useCallback(async () => {
    try {
      const response = await stockApi.lines();
      if (response.success && response.data) setLines(response.data.data);
    } catch {
      setLines([]);
    }
  }, []);

  useEffect(() => {
    loadLines().finally(() => setLoading(false));
  }, [loadLines]);

  const handleReserve = async (lineId: string) => {
    Alert.alert('Reservar linha', 'Deseja reservar esta linha?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Reservar',
        onPress: async () => {
          setReserving(lineId);
          try {
            await stockApi.reserve(lineId);
            Alert.alert('Sucesso', 'Linha reservada com sucesso');
            await loadLines();
          } catch (err) {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao reservar');
          } finally {
            setReserving(null);
          }
        },
      },
    ]);
  };

  const renderLine = ({ item }: { item: Line }) => (
    <View style={[styles.lineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.lineInfo}>
        <Text style={[styles.number, { color: colors.text }]}>{formatPhone(item.number)}</Text>
        <Text style={[styles.operator, { color: colors.textSecondary }]}>
          {item.operator?.name} · {item.plan?.name ?? 'Sem plano'}
        </Text>
        <Badge label={getStatusLabel(item.status, LINE_STATUS_LABELS)} />
      </View>
      {item.status === 'AVAILABLE' && (
        <Button
          title="Reservar"
          size="sm"
          onPress={() => handleReserve(item.id)}
          loading={reserving === item.id}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title="Estoque" subtitle="Linhas do parceiro" showBack />

        {loading ? (
          <SkeletonList />
        ) : (
          <FlatList
            data={lines}
            keyExtractor={(item) => item.id}
            renderItem={renderLine}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadLines(); setRefreshing(false); }} tintColor={colors.primary} />
            }
            ListEmptyComponent={
              <EmptyState icon={<Package size={48} color={colors.textSecondary} />} title="Nenhuma linha no estoque" />
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
  list: { gap: spacing.sm },
  lineCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md },
  lineInfo: { flex: 1, gap: spacing.xs },
  number: { ...typography.label, fontWeight: '700' },
  operator: { ...typography.caption },
});
