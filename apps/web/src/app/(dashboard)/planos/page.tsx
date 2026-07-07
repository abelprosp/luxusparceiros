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
import { MobileListCard, ResponsiveDataView } from '@/components/ui/mobile-list-card';
import { useToast } from '@/components/ui/toaster';

const ALL_PARTNERS = 'all';

interface Operator {
  id: string;
  name: string;
}

interface Partner {
  id: string;
  name: string;
}

interface PartnerPlanLink {
  partnerId: string;
  partner?: { id: string; name: string };
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
  partnerPlans?: PartnerPlanLink[];
}

const emptyForm = {
  name: '',
  operatorId: '',
  price: '',
  commissionType: CommissionType.PERCENTAGE as CommissionType,
  commissionValue: '',
  commission: '',
  partnerId: ALL_PARTNERS,
};

function getPartnerLabel(plan: Plan) {
  const links = plan.partnerPlans ?? [];
  if (links.length === 0) return 'Nenhum';
  if (links.length === 1) return links[0].partner?.name ?? 'Parceiro exclusivo';
  return 'Todos os parceiros';
}

function getPartnerIdFromPlan(plan: Plan) {
  const links = plan.partnerPlans ?? [];
  if (links.length === 1) return links[0].partnerId;
  return ALL_PARTNERS;
}

export default function PlanosPage() {
  const [items, setItems] = useState<Plan[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState(emptyForm);
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
    Promise.all([
      getPaginated<Operator>('/operators', { limit: 100 }),
      getPaginated<Partner>('/partners', { limit: 100, status: 'ACTIVE' }),
    ])
      .then(([ops, pts]) => {
        setOperators(ops.data);
        setPartners(pts.data);
      })
      .catch(() => {
        setOperators([]);
        setPartners([]);
      });
  }, []);

  const handleSave = async () => {
    if (!form.operatorId) {
      toast({ title: 'Selecione uma operadora', variant: 'destructive' });
      return;
    }
    try {
      const commissionValue = parseFloat(form.commissionValue || form.commission);
      const body: Record<string, unknown> = {
        name: form.name,
        operatorId: form.operatorId,
        price: parseFloat(form.price),
        commissionType: form.commissionType,
        commissionValue,
        commission: form.commissionType === CommissionType.PERCENTAGE ? commissionValue : parseFloat(form.commission || '0'),
      };

      if (editing) {
        body.partnerId = form.partnerId === ALL_PARTNERS ? null : form.partnerId;
        await api(`/plans/${editing.id}`, { method: 'PATCH', body });
      } else {
        if (form.partnerId !== ALL_PARTNERS) body.partnerId = form.partnerId;
        await api('/plans', { method: 'POST', body });
      }

      toast({ title: 'Plano salvo', variant: 'success' });
      setDialogOpen(false);
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({
      name: plan.name,
      operatorId: plan.operatorId,
      price: String(plan.price),
      commissionType: plan.commissionType ?? CommissionType.PERCENTAGE,
      commissionValue: String(plan.commissionValue ?? plan.commission),
      commission: String(plan.commission),
      partnerId: getPartnerIdFromPlan(plan),
    });
    setDialogOpen(true);
  };

  return (
    <DashboardLayout title="Planos" description="Gerencie os planos de telefonia">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar planos..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo Plano
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Package} title="Nenhum plano" description="Cadastre o primeiro plano." />
      ) : (
        <ResponsiveDataView
          table={
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Operadora</TableHead>
                  <TableHead>Parceiro</TableHead>
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
                    <TableCell>{getPartnerLabel(p)}</TableCell>
                    <TableCell>{formatCurrency(Number(p.price))}</TableCell>
                    <TableCell>{formatCommission(p.commissionType ?? CommissionType.PERCENTAGE, Number(p.commissionValue ?? p.commission))}</TableCell>
                    <TableCell><Badge variant={p.status ? 'success' : 'secondary'}>{p.status ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
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
          }
          mobile={items.map((p) => (
            <MobileListCard
              key={p.id}
              title={p.name}
              subtitle={`${p.operator?.name || '-'} · ${getPartnerLabel(p)}`}
              meta={`${formatCurrency(Number(p.price))} · ${formatCommission(p.commissionType ?? CommissionType.PERCENTAGE, Number(p.commissionValue ?? p.commission))}`}
              badges={
                <Badge variant={p.status ? 'success' : 'secondary'}>
                  {p.status ? 'Ativo' : 'Inativo'}
                </Badge>
              }
              actions={
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={async () => { await api(`/plans/${p.id}`, { method: 'DELETE' }); load(); }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              }
            />
          ))}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-2">
              <Label>Parceiro</Label>
              <Select value={form.partnerId} onValueChange={(v) => setForm({ ...form, partnerId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o parceiro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PARTNERS}>Todos os parceiros ativos</SelectItem>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
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
