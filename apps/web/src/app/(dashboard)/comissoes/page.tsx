'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, DollarSign, CheckCircle, CheckCheck } from 'lucide-react';
import { CommissionStatus } from '@luxus/types';
import { formatCurrency, formatDate } from '@luxus/utils';
import { api, getPaginated } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/useAuth';
import { isPartnerUser } from '@/lib/rbac';
import { Card, CardContent } from '@/components/ui/card';

interface Commission {
  id: string;
  value: number;
  percentage: number;
  status: CommissionStatus;
  partner?: { name: string };
  sale?: { protocol: string };
  createdAt: string;
}

const STATUS_LABELS: Record<CommissionStatus, string> = {
  [CommissionStatus.FORECAST]: 'Previsão',
  [CommissionStatus.APPROVED]: 'Aprovada',
  [CommissionStatus.PAID]: 'Pagamento confirmado',
  [CommissionStatus.CANCELLED]: 'Cancelada',
};

export default function ComissoesPage() {
  const [items, setItems] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isPartner = isPartnerUser(user);
  const [summary, setSummary] = useState({ forecast: 0, approved: 0, paid: 0, total: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<Commission>('/commissions', {
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 50,
      });
      setItems(res.data);
      if (isPartner) {
        const summaryData = await api<{ forecast: number; approved: number; paid: number; total: number }>('/commissions/summary');
        setSummary(summaryData);
      }
    } catch { setItems([]); } finally { setLoading(false); }
  }, [search, statusFilter, isPartner]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: string) => {
    try {
      await api(`/commissions/${id}/approve`, { method: 'POST' });
      toast({ title: 'Comissão aprovada', variant: 'success' });
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    }
  };

  const openConfirmDialog = (id: string) => {
    setSelectedId(id);
    setConfirmNotes('');
    setConfirmOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedId) return;
    setConfirming(true);
    try {
      await api(`/commissions/${selectedId}/pay`, {
        method: 'POST',
        body: { notes: confirmNotes || undefined },
      });
      toast({ title: 'Pagamento confirmado', variant: 'success' });
      setConfirmOpen(false);
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <DashboardLayout title="Comissões" description={isPartner ? 'Extrato e previsões' : 'Gestão de comissões dos parceiros'}>
      {isPartner && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Previsão</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(summary.forecast)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Aprovadas</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.approved)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Confirmadas</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.paid)}</p>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.values(CommissionStatus).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s] ?? s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={DollarSign} title="Nenhuma comissão" description="As comissões aparecerão aqui." />
      ) : (
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                {!isPartner && <TableHead>Parceiro</TableHead>}
                <TableHead>Venda</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                {!isPartner && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  {!isPartner && <TableCell>{c.partner?.name || '-'}</TableCell>}
                  <TableCell className="font-mono text-sm">{c.sale?.protocol || '-'}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(Number(c.value))}</TableCell>
                  <TableCell>{c.percentage}%</TableCell>
                  <TableCell><Badge variant="outline">{STATUS_LABELS[c.status] ?? c.status}</Badge></TableCell>
                  <TableCell>{formatDate(c.createdAt)}</TableCell>
                  {!isPartner && (
                    <TableCell className="text-right space-x-1">
                      {c.status === CommissionStatus.FORECAST && (
                        <Button size="sm" variant="outline" onClick={() => handleApprove(c.id)}>
                          <CheckCircle className="mr-1 h-3 w-3" /> Aprovar
                        </Button>
                      )}
                      {c.status === CommissionStatus.APPROVED && (
                        <Button size="sm" variant="outline" onClick={() => openConfirmDialog(c.id)}>
                          <CheckCheck className="mr-1 h-3 w-3" /> Confirmar pagamento
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pagamento</DialogTitle>
            <DialogDescription>
              O pagamento é realizado fora da plataforma (PIX, TED, etc.). Ao confirmar, você apenas registra que a comissão já foi paga ao parceiro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-notes">Observações (opcional)</Label>
            <Input
              id="confirm-notes"
              placeholder="Ex: PIX realizado em 01/07/2026"
              value={confirmNotes}
              onChange={(e) => setConfirmNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmPayment} disabled={confirming}>
              {confirming ? 'Confirmando...' : 'Confirmar pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
