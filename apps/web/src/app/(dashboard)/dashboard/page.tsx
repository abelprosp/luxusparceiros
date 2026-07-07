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
import { UserRole, type DashboardAdminMetrics } from '@luxus/types';
import { formatCurrency } from '@luxus/utils';
import { api, getPaginated } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { PartnerDashboard } from '@/components/dashboard/partner-dashboard';
import { MetricsCard } from '@/components/charts/metrics-card';
import { SalesChart } from '@/components/charts/sales-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  partnersByState: [],
  ranking: [],
  campaignPerformance: [],
};

export default function DashboardPage() {
  const { user } = useAuth();
  const isPartner = user?.role === UserRole.PARTNER;
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
    if (isPartner) return;
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
  }, [isPartner]);

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
    if (isPartner) return;
    loadMetrics();
  }, [isPartner, loadMetrics]);

  const clearFilters = () => {
    setPartnerId('all');
    setState('all');
    setCampaignId('all');
    setOperatorId('all');
  };

  const data = metrics || fallbackMetrics;
  const showMockData = !hasFilters;

  if (isPartner) {
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
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filtros
        </div>
        <div className="flex flex-wrap gap-3">
          <Select value={partnerId} onValueChange={setPartnerId}>
            <SelectTrigger className="w-48">
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
            <SelectTrigger className="w-40">
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
            <SelectTrigger className="w-48">
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
            <SelectTrigger className="w-44">
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
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricsCard
              title="Parceiros Ativos"
              value={data.activePartners}
              description={`${data.totalPartners} total`}
              icon={Users}
              trend={showMockData ? { value: 12, label: 'vs mês anterior' } : undefined}
            />
            <MetricsCard
              title="Linhas Disponíveis"
              value={data.availableLines}
              icon={Smartphone}
            />
            <MetricsCard
              title="Receita"
              value={formatCurrency(data.revenue)}
              icon={TrendingUp}
              trend={showMockData ? { value: 8, label: 'vs mês anterior' } : undefined}
            />
            <MetricsCard
              title="Comissões"
              value={formatCurrency(data.commissions)}
              icon={DollarSign}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SalesChart
                data={
                  data.salesChart.length > 0
                    ? data.salesChart
                    : showMockData
                      ? [
                          { date: 'Jan', value: 120 },
                          { date: 'Fev', value: 180 },
                          { date: 'Mar', value: 150 },
                          { date: 'Abr', value: 220 },
                          { date: 'Mai', value: 280 },
                          { date: 'Jun', value: 310 },
                        ]
                      : []
                }
                title="Vendas nos últimos 30 dias"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-5 w-5 text-primary" />
                  Ranking de Parceiros
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data.ranking.length > 0
                  ? data.ranking
                  : showMockData
                    ? [
                        { partnerId: '1', partnerName: 'Parceiro Alpha', sales: 145 },
                        { partnerId: '2', partnerName: 'Parceiro Beta', sales: 128 },
                        { partnerId: '3', partnerName: 'Parceiro Gamma', sales: 96 },
                      ]
                    : []
                )
                  .slice(0, 5)
                  .map((item, index) => (
                    <div
                      key={item.partnerId}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant={index === 0 ? 'default' : 'secondary'}>
                          #{index + 1}
                        </Badge>
                        <span className="text-sm font-medium">{item.partnerName}</span>
                      </div>
                      <span className="text-sm font-semibold text-primary">
                        {item.sales} vendas
                      </span>
                    </div>
                  ))}
                {data.ranking.length === 0 && !showMockData && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Nenhum dado para os filtros selecionados
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {(data.campaignPerformance?.length ?? 0) > 0 && (
            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Megaphone className="h-5 w-5 text-primary" />
                    Performance por Campanha
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.campaignPerformance!.map((c) => (
                    <div
                      key={c.campaignId}
                      className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                    >
                      <span className="text-sm font-medium">{c.title}</span>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">{c.salesCount} vendas</span>
                        <span className="font-semibold text-primary">
                          {formatCurrency(c.revenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-5 w-5 text-primary" />
                  Parceiros por Estado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-64 items-center justify-center rounded-xl border border-dashed bg-muted/30">
                  <div className="text-center">
                    <MapPin className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      Mapa do Brasil — em breve
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {(data.partnersByState.length > 0
                        ? data.partnersByState
                        : showMockData
                          ? [
                              { state: 'SP', count: 45 },
                              { state: 'RJ', count: 32 },
                              { state: 'MG', count: 28 },
                              { state: 'RS', count: 18 },
                            ]
                          : []
                      ).map((s) => (
                        <Badge key={s.state} variant="outline">
                          {s.state}: {s.count}
                        </Badge>
                      ))}
                    </div>
                    {data.partnersByState.length === 0 && !showMockData && (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Nenhum parceiro encontrado
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
