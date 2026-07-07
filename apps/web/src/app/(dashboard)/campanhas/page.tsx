'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Megaphone, BarChart3 } from 'lucide-react';
import { CampaignStatus } from '@luxus/types';
import { formatCurrency, formatDate } from '@luxus/utils';
import { api, getPaginated } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toaster';

interface Campaign {
  id: string;
  title: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  goal?: number;
  _count?: { sales: number };
}

interface CampaignMetrics {
  totalSales: number;
  totalRevenue: number;
  goalProgress: number;
  salesByPartner: { partnerId: string; partnerName: string; count: number; revenue: number }[];
}

export default function CampanhasPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [metricsCampaign, setMetricsCampaign] = useState<Campaign | null>(null);
  const [form, setForm] = useState({ title: '', description: '', startDate: '', endDate: '', goal: '' });
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<Campaign>('/campaigns', { search: search || undefined, limit: 50 });
      setItems(res.data);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    try {
      const body = {
        title: form.title,
        description: form.description || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        goal: form.goal ? parseInt(form.goal, 10) : undefined,
      };
      if (editing) {
        await api(`/campaigns/${editing.id}`, { method: 'PATCH', body });
      } else {
        await api('/campaigns', { method: 'POST', body });
      }
      toast({ title: 'Campanha salva', variant: 'success' });
      setDialogOpen(false);
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    }
  };

  const openMetrics = async (campaign: Campaign) => {
    try {
      const data = await api<CampaignMetrics>(`/campaigns/${campaign.id}/metrics`);
      setMetrics(data);
      setMetricsCampaign(campaign);
      setMetricsOpen(true);
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout title="Campanhas" description="Gerencie campanhas promocionais">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar campanhas..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => { setEditing(null); setForm({ title: '', description: '', startDate: '', endDate: '', goal: '' }); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nova Campanha
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Megaphone} title="Nenhuma campanha" description="Crie a primeira campanha." />
      ) : (
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Vendas</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                  <TableCell>{formatDate(c.startDate)}</TableCell>
                  <TableCell>{formatDate(c.endDate)}</TableCell>
                  <TableCell>{c._count?.sales ?? 0}</TableCell>
                  <TableCell>{c.goal || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openMetrics(c)} title="Performance">
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setForm({ title: c.title, description: '', startDate: c.startDate.split('T')[0], endDate: c.endDate.split('T')[0], goal: c.goal ? String(c.goal) : '' }); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={async () => { await api(`/campaigns/${c.id}`, { method: 'DELETE' }); load(); }}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Nova'} Campanha</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Início</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>Fim</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>Meta (vendas)</Label><Input type="number" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={metricsOpen} onOpenChange={setMetricsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Performance — {metricsCampaign?.title}</DialogTitle>
          </DialogHeader>
          {metrics && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{metrics.totalSales}</p>
                  <p className="text-xs text-muted-foreground">Vendas</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Receita</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{metrics.goalProgress}%</p>
                  <p className="text-xs text-muted-foreground">Meta</p>
                </div>
              </div>
              {metrics.salesByPartner.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parceiro</TableHead>
                      <TableHead>Vendas</TableHead>
                      <TableHead>Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.salesByPartner.map((p) => (
                      <TableRow key={p.partnerId}>
                        <TableCell>{p.partnerName}</TableCell>
                        <TableCell>{p.count}</TableCell>
                        <TableCell>{formatCurrency(p.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
