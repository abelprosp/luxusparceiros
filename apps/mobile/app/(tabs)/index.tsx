import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  TrendingUp,
  Phone,
  DollarSign,
  Trophy,
  Target,
} from 'lucide-react-native';
import type { DashboardPartnerMetrics } from '@luxus/types';
import { formatCurrency } from '@luxus/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { dashboardApi } from '@/services/api';
import { connectSocket, subscribeToDashboard, unsubscribeFromDashboard } from '@/services/socket';
import { Card, SkeletonCard } from '@/components/ui';
import { MetricCard } from '@/components/MetricCard';
import { SalesChart } from '@/components/charts/SalesChart';
import { spacing, typography, radius } from '@/theme';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [metrics, setMetrics] = useState<DashboardPartnerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMetrics = useCallback(async () => {
    try {
      const response = await dashboardApi.partner();
      if (response.success && response.data) {
        setMetrics(response.data);
      }
    } catch {
      setMetrics(null);
    }
  }, []);

  useEffect(() => {
    loadMetrics().finally(() => setLoading(false));

    connectSocket({
      onDashboardUpdate: (data) => {
        if (data && typeof data === 'object') {
          setMetrics((prev) => ({ ...prev, ...(data as DashboardPartnerMetrics) }));
        }
      },
    });
    subscribeToDashboard();

    return () => unsubscribeFromDashboard();
  }, [loadMetrics]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
  };

  const goalPercent = metrics ? Math.round(metrics.goalProgress * 100) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Olá,</Text>
          <Text style={[styles.name, { color: colors.text }]}>{user?.name ?? 'Parceiro'}</Text>
        </View>

        {loading ? (
          <View style={styles.metricsGrid}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <>
            <View style={styles.metricsGrid}>
              <MetricCard
                label="Vendas hoje"
                value={metrics?.salesToday ?? 0}
                accent
                icon={<TrendingUp size={20} color="#FFFFFF" />}
              />
              <MetricCard
                label="Vendas no mês"
                value={metrics?.salesMonth ?? 0}
                icon={<TrendingUp size={20} color={colors.primary} />}
              />
              <MetricCard
                label="Linhas ativas"
                value={metrics?.activeLines ?? 0}
                icon={<Phone size={20} color={colors.primary} />}
              />
              <MetricCard
                label="Ranking"
                value={`#${metrics?.ranking ?? '-'}`}
                icon={<Trophy size={20} color={colors.primary} />}
              />
            </View>

            <Card title="Comissões">
              <View style={styles.commissionRow}>
                <View style={styles.commissionItem}>
                  <Text style={[styles.commissionValue, { color: colors.primary }]}>
                    {formatCurrency(metrics?.forecastCommission ?? 0)}
                  </Text>
                  <Text style={[styles.commissionLabel, { color: colors.textSecondary }]}>
                    Previsão
                  </Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.commissionItem}>
                  <Text style={[styles.commissionValue, { color: colors.success }]}>
                    {formatCurrency(metrics?.paidCommission ?? 0)}
                  </Text>
                  <Text style={[styles.commissionLabel, { color: colors.textSecondary }]}>
                    Recebidas
                  </Text>
                </View>
              </View>
            </Card>

            <Card title="Meta do mês" subtitle={`${goalPercent}% concluído`}>
              <View style={styles.goalContainer}>
                <View style={[styles.goalBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.goalProgress,
                      {
                        backgroundColor: colors.primary,
                        width: `${Math.min(goalPercent, 100)}%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.goalLabels}>
                  <Text style={[styles.goalText, { color: colors.textSecondary }]}>
                    {metrics?.salesMonth ?? 0} / {metrics?.goal ?? 0} vendas
                  </Text>
                  <Target size={16} color={colors.primary} />
                </View>
              </View>
            </Card>

            <Card title="Vendas — últimos 7 dias">
              <SalesChart data={metrics?.salesChart ?? []} labelKey="date" />
            </Card>

            <Card title="Vendas mensais">
              <SalesChart
                data={(metrics?.monthlyChart ?? []).map((m) => ({
                  ...m,
                  label: m.month,
                }))}
                type="bar"
                labelKey="label"
              />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.sm,
  },
  greeting: {
    ...typography.bodySmall,
  },
  name: {
    ...typography.h1,
    fontSize: 26,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  commissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commissionItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  commissionValue: {
    ...typography.h3,
  },
  commissionLabel: {
    ...typography.caption,
  },
  divider: {
    width: 1,
    height: 40,
  },
  goalContainer: {
    gap: spacing.sm,
  },
  goalBar: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  goalProgress: {
    height: '100%',
    borderRadius: radius.full,
  },
  goalLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalText: {
    ...typography.caption,
  },
});
