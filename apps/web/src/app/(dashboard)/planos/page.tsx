'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Package } from 'lucide-react';
import { CommissionType } from '@luxus/types';
import { formatCurrency, formatCommission } from '@luxus/utils';
import { api, getPaginated } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toaster';

interface Operator {
  id: string;
  name: string;
}

interface Plan {
  id: string;
  name: string;
  operatorId: string;
  operator?: { name: string };
  price: number;
  commission: number;
  commissionType: CommissionType;
  commissionValue: number;
  status: boolean;
}

export default function PlanosPage() {
  const [items, setItems] = useState<Plan[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState({
    name: '',
    operatorId: '',
    price: '',
    commissionType: CommissionType.PERCENTAGE as CommissionType,
    commissionValue: '',
    commission: '',
  });
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<Plan>('/plans', { search: search || undefined, limit: 50 });
      setItems(res.data);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getPaginated<Operator>('/operators', { limit: 100 })
      .then((res) => setOperators(res.data))
      .catch(() => setOperators([]));
  }, []);

  const handleSave = async () => {
    if (!form.operatorId) {
      toast({ title: 'Selecione uma operadora', variant: 'destructive' });
      return;
    }
    try {
      const commissionValue = parseFloat(form.commissionValue || form.commission);
      const body = {
        name: form.name,
        operatorId: form.operatorId,
        price: parseFloat(form.price),
        commissionType: form.commissionType,
        commissionValue,
        commission: form.commissionType === CommissionType.PERCENTAGE ? commissionValue : parseFloat(form.commission || '0'),
      };
      if (editing) {
        await api(`/plans/${editing.id}`, { method: 'PATCH', body });
      } else {
        await api('/plans', { method: 'POST', body });
      }
      toast({ title: 'Plano salvo', variant: 'success' });
      setDialogOpen(false);
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout title="Planos" description="Gerencie os planos de telefonia">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar planos..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => { setEditing(null); setForm({ name: '', operatorId: '', price: '', commissionType: CommissionType.PERCENTAGE, commissionValue: '', commission: '' }); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Plano
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Package} title="Nenhum plano" description="Cadastre o primeiro plano." />
      ) : (
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Operadora</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.operator?.name || '-'}</TableCell>
                  <TableCell>{formatCurrency(Number(p.price))}</TableCell>
                  <TableCell>{formatCommission(p.commissionType ?? CommissionType.PERCENTAGE, Number(p.commissionValue ?? p.commission))}</TableCell>
                  <TableCell><Badge variant={p.status ? 'success' : 'secondary'}>{p.status ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setForm({ name: p.name, operatorId: p.operatorId, price: String(p.price), commissionType: p.commissionType ?? CommissionType.PERCENTAGE, commissionValue: String(p.commissionValue ?? p.commission), commission: String(p.commission) }); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={async () => { await api(`/plans/${p.id}`, { method: 'DELETE' }); load(); }}>
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
          <DialogHeader><DialogTitle>{editing ? 'Editar' : 'Novo'} Plano</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Operadora</Label>
              <Select value={form.operatorId} onValueChange={(v) => setForm({ ...form, operatorId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a operadora" />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Preço</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Tipo de comissão</Label>
              <Select value={form.commissionType} onValueChange={(v) => setForm({ ...form, commissionType: v as CommissionType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={CommissionType.PERCENTAGE}>Percentual (%)</SelectItem>
                  <SelectItem value={CommissionType.FIXED}>Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{form.commissionType === CommissionType.PERCENTAGE ? 'Comissão (%)' : 'Comissão (R$)'}</Label>
              <Input type="number" value={form.commissionValue} onChange={(e) => setForm({ ...form, commissionValue: e.target.value, commission: e.target.value })} />
            </div>
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
