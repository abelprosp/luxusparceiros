'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Plus, Wallet } from 'lucide-react';
import { FinancialType } from '@luxus/types';
import { formatCurrency, formatDate } from '@luxus/utils';
import { api, getPaginated } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toaster';

interface FinancialRecord {
  id: string;
  type: FinancialType;
  description: string;
  value: number;
  category?: string;
  date: string;
}

export default function FinanceiroPage() {
  const [items, setItems] = useState<FinancialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ type: 'REVENUE', description: '', value: '', category: '' });
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<FinancialRecord>('/financial', {
        search: search || undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        limit: 50,
      });
      setItems(res.data);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    try {
      await api('/financial', { method: 'POST', body: { ...form, value: parseFloat(form.value) } });
      toast({ title: 'Registro criado', variant: 'success' });
      setDialogOpen(false);
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    }
  };

  const typeColor = (type: FinancialType) => {
    if (type === FinancialType.REVENUE) return 'success';
    if (type === FinancialType.EXPENSE) return 'destructive';
    return 'secondary';
  };

  return (
    <DashboardLayout title="Financeiro" description="Registros financeiros">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-1 sm:flex-row">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="REVENUE">Receita</SelectItem>
              <SelectItem value="EXPENSE">Despesa</SelectItem>
              <SelectItem value="TRANSFER">Transferência</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Novo Registro</Button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Wallet} title="Nenhum registro" description="Adicione registros financeiros." />
      ) : (
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.description}</TableCell>
                  <TableCell><Badge variant={typeColor(r.type)}>{r.type}</Badge></TableCell>
                  <TableCell>{r.category || '-'}</TableCell>
                  <TableCell className={r.type === FinancialType.EXPENSE ? 'text-red-500' : 'text-green-600'}>
                    {formatCurrency(Number(r.value))}
                  </TableCell>
                  <TableCell>{formatDate(r.date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Registro</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="REVENUE">Receita</SelectItem>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                  <SelectItem value="TRANSFER">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-2"><Label>Valor</Label><Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
            <div className="space-y-2"><Label>Categoria</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
