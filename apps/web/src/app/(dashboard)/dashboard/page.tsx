'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Smartphone,
  TrendingUp,
  DollarSign,
  MapPin,
  Trophy,
  Megaphone,
  Filter,
  X,
} from 'lucide-react';
import type { DashboardAdminMetrics } from '@luxus/types';
import { formatCurrency } from '@luxus/utils';
import { api, getPaginated } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { isPartnerScopedUser } from '@/lib/rbac';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { PartnerDashboard } from '@/components/dashboard/partner-dashboard';
import { BrazilPartnersMap } from '@/components/dashboard/brazil-partners-map';
import { MetricsCard } from '@/components/charts/metrics-card';
import { SalesChart } from '@/components/charts/sales-chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PartnerOption {
  id: string;
  name: string;
}

interface CampaignOption {
  id: string;
  title: string;
}

interface OperatorOption {
  id: string;
  name: string;
}

const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const fallbackMetrics: DashboardAdminMetrics = {
  totalPartners: 0,
  activePartners: 0,
  availableLines: 0,
  soldLines: 0,
  activatedLines: 0,
  revenue: 0,
  commissions: 0,
  salesChart: [],
  partnersInBrazil: [],
  ranking: [],
  campaignPerformance: [],
};

function BentoPanel({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bento-card p-5 sm:p-6', className)}>
      <div className="mb-5 flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5 text-primary" />}
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isPartnerScoped = isPartnerScopedUser(user);
  const [metrics, setMetrics] = useState<DashboardAdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [partnerId, setPartnerId] = useState('all');
  const [state, setState] = useState('all');
  const [campaignId, setCampaignId] = useState('all');
  const [operatorId, setOperatorId] = useState('all');
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [operators, setOperators] = useState<OperatorOption[]>([]);

  const hasFilters =
    partnerId !== 'all' ||
    state !== 'all' ||
    campaignId !== 'all' ||
    operatorId !== 'all';

  useEffect(() => {
    if (isPartnerScoped) return;
    Promise.all([
      getPaginated<PartnerOption>('/partners', { limit: 100, status: 'ACTIVE' }),
      getPaginated<CampaignOption>('/campaigns', { limit: 100 }),
      getPaginated<OperatorOption>('/operators', { limit: 100 }),
    ])
      .then(([partnersRes, campaignsRes, operatorsRes]) => {
        setPartners(partnersRes.data);
        setCampaigns(campaignsRes.data);
        setOperators(operatorsRes.data);
      })
      .catch(() => {});
  }, [isPartnerScoped]);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<DashboardAdminMetrics>('/dashboard/admin', {
        params: {
          partnerId: partnerId !== 'all' ? partnerId : undefined,
          state: state !== 'all' ? state : undefined,
          campaignId: campaignId !== 'all' ? campaignId : undefined,
          operatorId: operatorId !== 'all' ? operatorId : undefined,
        },
      });
      setMetrics(data);
    } catch {
      setMetrics(fallbackMetrics);
    } finally {
      setLoading(false);
    }
  }, [partnerId, state, campaignId, operatorId]);

  useEffect(() => {
    if (isPartnerScoped) return;
    loadMetrics();
  }, [isPartnerScoped, loadMetrics]);

  const clearFilters = () => {
    setPartnerId('all');
    setState('all');
    setCampaignId('all');
    setOperatorId('all');
  };

  const data = metrics || fallbackMetrics;

  if (isPartnerScoped) {
    return (
      <DashboardLayout
        title="Dashboard"
        description="Acompanhe suas vendas, metas e comissões"
      >
        <PartnerDashboard />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Dashboard"
      description="Visão geral do ecossistema Luxus Parceiros"
    >
      <div className="bento-card mb-6 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filtros
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={partnerId} onValueChange={setPartnerId}>
            <SelectTrigger className="h-11 w-48 rounded-2xl border border-border bg-muted text-foreground shadow-none">
              <SelectValue placeholder="Parceiro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os parceiros</SelectItem>
              {partners.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={state} onValueChange={setState}>
            <SelectTrigger className="h-11 w-40 rounded-2xl border border-border bg-muted text-foreground shadow-none">
              <SelectValue placeholder="Região (UF)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regiões</SelectItem>
              {BR_STATES.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={campaignId} onValueChange={setCampaignId}>
            <SelectTrigger className="h-11 w-48 rounded-2xl border border-border bg-muted text-foreground shadow-none">
              <SelectValue placeholder="Campanha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as campanhas</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={operatorId} onValueChange={setOperatorId}>
            <SelectTrigger className="h-11 w-44 rounded-2xl border border-border bg-muted text-foreground shadow-none">
              <SelectValue placeholder="Operadora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as operadoras</SelectItem>
              {operators.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" className="rounded-2xl" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricsCard
              title="Parceiros Ativos"
              value={data.activePartners}
              description={`${data.totalPartners} total`}
              icon={Users}
            />
            <MetricsCard
              title="Linhas Disponíveis"
              value={data.availableLines}
              description={`${data.soldLines} vendidas`}
              icon={Smartphone}
            />
            <MetricsCard
              title="Receita"
              value={formatCurrency(data.revenue)}
              icon={TrendingUp}
              variant="accent"
            />
            <MetricsCard
              title="Comissões"
              value={formatCurrency(data.commissions)}
              icon={DollarSign}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <SalesChart
              data={data.salesChart}
              title="Vendas nos últimos 30 dias"
              className="xl:col-span-8"
            />

            <BentoPanel title="Ranking de Parceiros" icon={Trophy} className="xl:col-span-4">
              <div className="space-y-3">
                {data.ranking.length > 0 ? (
                  data.ranking.slice(0, 5).map((item, index) => (
                    <div
                      key={item.partnerId}
                      className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Badge variant={index === 0 ? 'default' : 'secondary'} className="rounded-full">
                          #{index + 1}
                        </Badge>
                        <span className="truncate text-sm font-medium">{item.partnerName}</span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-primary">
                        {item.sales}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum parceiro com vendas no período
                  </p>
                )}
              </div>
            </BentoPanel>
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            {(data.campaignPerformance?.length ?? 0) > 0 && (
              <BentoPanel title="Performance por Campanha" icon={Megaphone} className="xl:col-span-4">
                <div className="space-y-3">
                  {data.campaignPerformance!.map((c) => (
                    <div
                      key={c.campaignId}
                      className="rounded-2xl bg-muted px-4 py-3"
                    >
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{c.salesCount} vendas</span>
                        <span className="font-semibold text-primary">
                          {formatCurrency(c.revenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </BentoPanel>
            )}

            <BentoPanel
              title="Parceiros no Brasil"
              icon={MapPin}
              className={cn(
                (data.campaignPerformance?.length ?? 0) > 0 ? 'xl:col-span-8' : 'xl:col-span-12',
              )}
            >
              <BrazilPartnersMap partners={data.partnersInBrazil} />
            </BentoPanel>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
