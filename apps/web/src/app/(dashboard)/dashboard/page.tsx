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
  ChevronRight,
} from 'lucide-react';
import type { DashboardAdminMetrics, DashboardDetails } from '@luxus/types';
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
import { DashboardExportButton } from '@/components/dashboard/dashboard-export-button';
import { DashboardDetailsDialog } from '@/components/dashboard/dashboard-details-dialog';

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
  const [details, setDetails] = useState<DashboardDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailSection, setDetailSection] = useState<
    keyof Pick<DashboardDetails, 'sales' | 'partners' | 'lines' | 'commissions' | 'campaigns'> | null
  >(null);
  const [detailTitle, setDetailTitle] = useState('Detalhes');

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

  useEffect(() => {
    setDetails(null);
  }, [partnerId, state, campaignId, operatorId]);

  const loadDetails = useCallback(async () => {
    if (details) return details;
    setDetailsLoading(true);
    try {
      const result = await api<DashboardDetails>('/dashboard/details', {
        params: {
          partnerId: partnerId !== 'all' ? partnerId : undefined,
          state: state !== 'all' ? state : undefined,
          campaignId: campaignId !== 'all' ? campaignId : undefined,
          operatorId: operatorId !== 'all' ? operatorId : undefined,
        },
      });
      setDetails(result);
      return result;
    } finally {
      setDetailsLoading(false);
    }
  }, [details, partnerId, state, campaignId, operatorId]);

  const openDetails = (
    section: keyof Pick<DashboardDetails, 'sales' | 'partners' | 'lines' | 'commissions' | 'campaigns'>,
    title: string,
  ) => {
    setDetailSection(section);
    setDetailTitle(title);
    void loadDetails().catch(() => {});
  };

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
        <div className="mb-3 flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </span>
          <DashboardExportButton loadDetails={loadDetails} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
          <Select value={partnerId} onValueChange={setPartnerId}>
            <SelectTrigger className="h-11 w-full rounded-2xl border border-border bg-muted text-foreground shadow-none sm:w-48">
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
            <SelectTrigger className="h-11 w-full rounded-2xl border border-border bg-muted text-foreground shadow-none sm:w-40">
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
            <SelectTrigger className="h-11 w-full rounded-2xl border border-border bg-muted text-foreground shadow-none sm:w-48">
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
            <SelectTrigger className="h-11 w-full rounded-2xl border border-border bg-muted text-foreground shadow-none sm:w-44">
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
              onClick={() => openDetails('partners', 'Parceiros do indicador')}
            />
            <MetricsCard
              title="Linhas Disponíveis"
              value={data.availableLines}
              description={`${data.soldLines} vendidas`}
              icon={Smartphone}
              onClick={() => openDetails('lines', 'Linhas do indicador')}
            />
            <MetricsCard
              title="Receita"
              value={formatCurrency(data.revenue)}
              icon={TrendingUp}
              variant="accent"
              onClick={() => openDetails('sales', 'Vendas realizadas no mês')}
            />
            <MetricsCard
              title="Comissões"
              value={formatCurrency(data.commissions)}
              icon={DollarSign}
              onClick={() => openDetails('commissions', 'Comissões do mês')}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-12">
            <div
              className="cursor-pointer xl:col-span-8"
              role="button"
              tabIndex={0}
              onClick={() => openDetails('sales', 'Vendas realizadas')}
              onKeyDown={(event) => event.key === 'Enter' && openDetails('sales', 'Vendas realizadas')}
            >
              <SalesChart data={data.salesChart} title="Vendas nos últimos 30 dias" />
            </div>

            <BentoPanel
              title="Ranking de Parceiros"
              icon={Trophy}
              className="xl:col-span-4"
              onDetails={() => openDetails('sales', 'Vendas do ranking')}
            >
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
              <BentoPanel
                title="Performance por Campanha"
                icon={Megaphone}
                className="xl:col-span-4"
                onDetails={() => openDetails('campaigns', 'Performance por campanha')}
              >
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
              onDetails={() => openDetails('partners', 'Parceiros no Brasil')}
            >
              <BrazilPartnersMap partners={data.partnersInBrazil} />
            </BentoPanel>
          </div>
        </div>
      )}
      <DashboardDetailsDialog
        open={detailSection != null}
        onOpenChange={(open) => !open && setDetailSection(null)}
        title={detailTitle}
        rows={detailSection && details ? details[detailSection] : []}
        loading={detailsLoading}
      />
    </DashboardLayout>
  );
}
