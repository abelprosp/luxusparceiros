'use client';

import { useEffect, useState } from 'react';
import {
  ShoppingCart,
  Smartphone,
  Target,
  Trophy,
  DollarSign,
  Wallet,
  Package,
  Radio,
} from 'lucide-react';
import type { DashboardPartnerMetrics } from '@luxus/types';
import { formatCurrency } from '@luxus/utils';
import { api } from '@/lib/api';
import { MetricsCard } from '@/components/charts/metrics-card';
import { SalesChart } from '@/components/charts/sales-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const emptyMetrics: DashboardPartnerMetrics = {
  salesToday: 0,
  salesMonth: 0,
  activeLines: 0,
  cancelledLines: 0,
  goal: 0,
  goalProgress: 0,
  forecastCommission: 0,
  paidCommission: 0,
  ranking: 0,
  salesChart: [],
  monthlyChart: [],
  topProducts: [],
  topOperators: [],
};

export function PartnerDashboard() {
  const [metrics, setMetrics] = useState<DashboardPartnerMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<DashboardPartnerMetrics>('/dashboard/partner')
      .then(setMetrics)
      .catch(() => setMetrics(emptyMetrics))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  const data = metrics || emptyMetrics;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricsCard
          title="Vendas Hoje"
          value={data.salesToday}
          description={`${data.salesMonth} no mês`}
          icon={ShoppingCart}
        />
        <MetricsCard
          title="Linhas Ativas"
          value={data.activeLines}
          description={`${data.cancelledLines} canceladas`}
          icon={Smartphone}
        />
        <MetricsCard
          title="Comissão Prevista"
          value={formatCurrency(data.forecastCommission)}
          icon={DollarSign}
        />
        <MetricsCard
          title="Comissão Paga"
          value={formatCurrency(data.paidCommission)}
          icon={Wallet}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-5 w-5 text-primary" />
              Meta do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold">
                  {data.salesMonth}
                  <span className="text-base font-normal text-muted-foreground">
                    {' '}/ {data.goal || '—'}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">vendas no mês</p>
              </div>
              <span className="text-2xl font-semibold text-primary">
                {Math.round(data.goalProgress)}%
              </span>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, data.goalProgress)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5 text-primary" />
              Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {data.ranking > 0 ? `#${data.ranking}` : '—'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              sua posição entre os parceiros
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <SalesChart data={data.salesChart} title="Vendas nos últimos 30 dias" />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-5 w-5 text-primary" />
              Top Planos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topProducts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma venda registrada ainda
              </p>
            ) : (
              data.topProducts.slice(0, 5).map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={index === 0 ? 'default' : 'secondary'}>
                      #{index + 1}
                    </Badge>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {item.count} vendas
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="h-5 w-5 text-primary" />
              Top Operadoras
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topOperators.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nenhuma venda registrada ainda
              </p>
            ) : (
              data.topOperators.slice(0, 5).map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={index === 0 ? 'default' : 'secondary'}>
                      #{index + 1}
                    </Badge>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {item.count} vendas
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
