'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ShoppingCart,
  Smartphone,
  Target,
  Trophy,
  DollarSign,
  Wallet,
  Package,
  Radio,
  ChevronRight,
} from 'lucide-react';
import type { DashboardDetails, DashboardPartnerMetrics } from '@luxus/types';
import { formatCurrency } from '@luxus/utils';
import { api } from '@/lib/api';
import { MetricsCard } from '@/components/charts/metrics-card';
import { SalesChart } from '@/components/charts/sales-chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DashboardExportButton } from '@/components/dashboard/dashboard-export-button';
import { DashboardDetailsDialog } from '@/components/dashboard/dashboard-details-dialog';

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

function BentoPanel({
  title,
  icon: Icon,
  children,
  className,
  onDetails,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
  onDetails?: () => void;
}) {
  return (
    <div className={cn('bento-card p-5 sm:p-6', className)}>
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          <h3 className="text-base font-semibold">{title}</h3>
        </div>
        {onDetails && (
          <Button variant="ghost" size="sm" onClick={onDetails}>
            Ver detalhes <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

export function PartnerDashboard() {
  const [metrics, setMetrics] = useState<DashboardPartnerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<DashboardDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailSection, setDetailSection] = useState<'sales' | 'lines' | 'commissions' | null>(null);
  const [detailTitle, setDetailTitle] = useState('Detalhes');

  useEffect(() => {
    api<DashboardPartnerMetrics>('/dashboard/partner')
      .then(setMetrics)
      .catch(() => setMetrics(emptyMetrics))
      .finally(() => setLoading(false));
  }, []);

  const loadDetails = useCallback(async () => {
    if (details) return details;
    setDetailsLoading(true);
    try {
      const result = await api<DashboardDetails>('/dashboard/details');
      setDetails(result);
      return result;
    } finally {
      setDetailsLoading(false);
    }
  }, [details]);

  const openDetails = (section: 'sales' | 'lines' | 'commissions', title: string) => {
    setDetailSection(section);
    setDetailTitle(title);
    void loadDetails().catch(() => {});
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }

  const data = metrics || emptyMetrics;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DashboardExportButton loadDetails={loadDetails} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricsCard
          title="Vendas Hoje"
          value={data.salesToday}
          description={`${data.salesMonth} no mês`}
          icon={ShoppingCart}
          onClick={() => openDetails('sales', 'Vendas realizadas')}
        />
        <MetricsCard
          title="Linhas Ativas"
          value={data.activeLines}
          description={`${data.cancelledLines} canceladas`}
          icon={Smartphone}
          onClick={() => openDetails('lines', 'Linhas do parceiro')}
        />
        <MetricsCard
          title="Comissão Prevista"
          value={formatCurrency(data.forecastCommission)}
          icon={DollarSign}
          variant="accent"
          onClick={() => openDetails('commissions', 'Comissões previstas')}
        />
        <MetricsCard
          title="Comissão Paga"
          value={formatCurrency(data.paidCommission)}
          icon={Wallet}
          onClick={() => openDetails('commissions', 'Comissões pagas')}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
        <BentoPanel title="Meta do Mês" icon={Target} className="md:col-span-1 xl:col-span-5" onDetails={() => openDetails('sales', 'Vendas da meta mensal')}>
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
            <span className="rounded-2xl bg-primary/10 px-3 py-1 text-2xl font-semibold text-primary">
              {Math.round(data.goalProgress)}%
            </span>
          </div>
          <div className="mt-5 h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, data.goalProgress)}%` }}
            />
          </div>
        </BentoPanel>

        <BentoPanel title="Ranking" icon={Trophy} className="md:col-span-1 xl:col-span-3" onDetails={() => openDetails('sales', 'Vendas consideradas no ranking')}>
          <p className="text-4xl font-bold">
            {data.ranking > 0 ? `#${data.ranking}` : '—'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            sua posição entre os parceiros
          </p>
        </BentoPanel>

        <div
          className="cursor-pointer md:col-span-2 xl:col-span-4"
          role="button"
          tabIndex={0}
          onClick={() => openDetails('sales', 'Vendas realizadas')}
          onKeyDown={(event) => event.key === 'Enter' && openDetails('sales', 'Vendas realizadas')}
        >
          <SalesChart data={data.salesChart} title="Vendas nos últimos 30 dias" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BentoPanel title="Top Planos" icon={Package} onDetails={() => openDetails('sales', 'Vendas por plano')}>
          <div className="space-y-3">
            {data.topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma venda registrada ainda
              </p>
            ) : (
              data.topProducts.slice(0, 5).map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={index === 0 ? 'default' : 'secondary'} className="rounded-full">
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
          </div>
        </BentoPanel>

        <BentoPanel title="Top Operadoras" icon={Radio} onDetails={() => openDetails('sales', 'Vendas por operadora')}>
          <div className="space-y-3">
            {data.topOperators.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma venda registrada ainda
              </p>
            ) : (
              data.topOperators.slice(0, 5).map((item, index) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={index === 0 ? 'default' : 'secondary'} className="rounded-full">
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
          </div>
        </BentoPanel>
      </div>
      <DashboardDetailsDialog
        open={detailSection != null}
        onOpenChange={(open) => !open && setDetailSection(null)}
        title={detailTitle}
        rows={detailSection && details ? details[detailSection] : []}
        loading={detailsLoading}
      />
    </div>
  );
}
