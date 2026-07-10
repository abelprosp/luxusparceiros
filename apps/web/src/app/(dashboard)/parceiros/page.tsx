'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Key,
  Loader2,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Store,
  Trash2,
  Users,
} from 'lucide-react';
import { PartnerStatus, CommissionType } from '@luxus/types';
import { formatDocument, formatDate, formatCommission } from '@luxus/utils';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/toaster';
import { formatCep, lookupCep, normalizeCep } from '@/lib/cep';

interface Partner {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  status: PartnerStatus;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  createdAt: string;
  users?: { id: string; email: string; name: string }[];
  branches?: Branch[];
  partnerPlans?: PartnerPlanLink[];
}

interface Branch {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  status: string;
}

interface Plan {
  id: string;
  name: string;
  operator?: { name: string };
  commissionType: CommissionType;
  commissionValue: number;
}

interface PartnerPlanLink {
  id: string;
  planId: string;
  isActive: boolean;
  customCommission?: number;
  plan?: Plan;
}

const emptyForm = {
  name: '',
  document: '',
  email: '',
  phone: '',
  zipCode: '',
  address: '',
  city: '',
  state: '',
  userName: '',
  userEmail: '',
  userPassword: '',
};

const emptyBranchForm = {
  name: '',
  document: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  login: '',
  password: '',
};

export default function ParceirosPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);
  const [selected, setSelected] = useState<Partner | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [branchForm, setBranchForm] = useState(emptyBranchForm);
  const [newPassword, setNewPassword] = useState('');
  const [selectedPlanIds, setSelectedPlanIds] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const loadPartners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<Partner>('/partners', {
        page,
        limit: 10,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setPartners(res.data);
      setTotalPages(res.meta.totalPages);
    } catch {
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  const loadPlans = async () => {
    const res = await getPaginated<Plan>('/plans', { limit: 100 });
    setAllPlans(res.data);
  };

  const openDetail = async (partner: Partner) => {
    try {
      const data = await api<Partner>(`/partners/${partner.id}`);
      setSelected(data);
      const planMap: Record<string, boolean> = {};
      data.partnerPlans?.forEach((pp) => {
        planMap[pp.planId] = pp.isActive;
      });
      setSelectedPlanIds(planMap);
      await loadPlans();
      setDetailOpen(true);
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    }
  };

  const handleCepLookup = async (value: string) => {
    const zipCode = normalizeCep(value);
    if (zipCode.length !== 8 || cepLoading) return;

    setCepLoading(true);
    try {
      const address = await lookupCep(zipCode);
      setForm((current) =>
        normalizeCep(current.zipCode) === zipCode
          ? {
              ...current,
              zipCode: address.zipCode,
              address: address.address,
              city: address.city,
              state: address.state,
            }
          : current,
      );
    } catch (err) {
      toast({
        title: 'CEP não encontrado',
        description: err instanceof Error ? err.message : 'Confira o CEP informado.',
        variant: 'destructive',
      });
    } finally {
      setCepLoading(false);
    }
  };

  const handleSave = async () => {
    const zipCode = normalizeCep(form.zipCode);
    if (zipCode.length !== 8 || !form.address.trim() || !form.city.trim() || form.state.length !== 2) {
      toast({
        title: 'Informe um endereço válido',
        description: 'Consulte o CEP e confira endereço, cidade e UF.',
        variant: 'destructive',
      });
      return;
    }

    const partnerData = {
      name: form.name,
      document: form.document,
      email: form.email,
      phone: form.phone,
      zipCode,
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
    };

    try {
      if (editing) {
        await api(`/partners/${editing.id}`, {
          method: 'PATCH',
          body: partnerData,
        });
        toast({ title: 'Parceiro atualizado', variant: 'success' });
      } else {
        await api('/partners', {
          method: 'POST',
          body: {
            ...partnerData,
            user: form.userEmail
              ? { email: form.userEmail, password: form.userPassword, name: form.userName || form.name }
              : undefined,
          },
        });
        toast({ title: 'Parceiro criado com usuário', variant: 'success' });
      }
      setDialogOpen(false);
      setEditing(null);
      loadPartners();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao salvar', variant: 'destructive' });
    }
  };

  const handleResetPassword = async () => {
    if (!selected || !newPassword) return;
    try {
      await api(`/partners/${selected.id}/reset-password`, { method: 'POST', body: { password: newPassword } });
      toast({ title: 'Senha redefinida', variant: 'success' });
      setPasswordOpen(false);
      setNewPassword('');
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    }
  };

  const handleSavePlans = async () => {
    if (!selected) return;
    try {
      const plans = Object.entries(selectedPlanIds)
        .filter(([, active]) => active)
        .map(([planId]) => ({ planId, isActive: true }));
      await api(`/partners/${selected.id}/plans`, { method: 'PUT', body: { plans } });
      toast({ title: 'Planos vinculados', variant: 'success' });
      openDetail(selected);
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    }
  };

  const handleSaveBranch = async () => {
    if (!selected) return;
    if (!branchForm.login || !branchForm.password) {
      toast({ title: 'Informe login e senha de acesso da filial', variant: 'destructive' });
      return;
    }
    try {
      await api(`/branches/partner/${selected.id}`, { method: 'POST', body: branchForm });
      toast({ title: 'Filial criada', variant: 'success' });
      setBranchDialogOpen(false);
      setBranchForm(emptyBranchForm);
      openDetail(selected);
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este parceiro?')) return;
    try {
      await api(`/partners/${id}`, { method: 'DELETE' });
      toast({ title: 'Parceiro excluído', variant: 'success' });
      loadPartners();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao excluir', variant: 'destructive' });
    }
  };

  const statusVariant = (status: PartnerStatus) => {
    if (status === PartnerStatus.ACTIVE) return 'success';
    if (status === PartnerStatus.SUSPENDED) return 'destructive';
    return 'secondary';
  };

  return (
    <DashboardLayout title="Parceiros" description="Gerencie os parceiros da rede">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-1 sm:flex-row">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar parceiros..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ACTIVE">Ativo</SelectItem>
              <SelectItem value="SUSPENDED">Suspenso</SelectItem>
              <SelectItem value="INACTIVE">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Parceiro
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : partners.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum parceiro encontrado" description="Cadastre o primeiro parceiro da rede." />
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{formatDocument(p.document)}</TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell><Badge variant={statusVariant(p.status)}>{p.status}</Badge></TableCell>
                    <TableCell>{formatDate(p.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDetail(p)} title="Detalhes">
                        <Store className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        setEditing(p);
                        setForm({
                          ...emptyForm,
                          name: p.name,
                          document: p.document,
                          email: p.email,
                          phone: p.phone,
                          zipCode: p.zipCode ?? '',
                          address: p.address ?? '',
                          city: p.city ?? '',
                          state: p.state ?? '',
                        });
                        setDialogOpen(true);
                      }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Parceiro' : 'Novo Parceiro'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Documento</Label><Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Localização no mapa</p>
              </div>
              <div className="space-y-2">
                <Label>CEP *</Label>
                <div className="flex gap-2">
                  <Input
                    value={formatCep(form.zipCode)}
                    onChange={(event) => {
                      const zipCode = normalizeCep(event.target.value);
                      setForm({ ...form, zipCode });
                      if (zipCode.length === 8) void handleCepLookup(zipCode);
                    }}
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="00000-000"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={cepLoading || normalizeCep(form.zipCode).length !== 8}
                    onClick={() => void handleCepLookup(form.zipCode)}
                  >
                    {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Consultar'}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço *</Label>
                <Input
                  value={form.address}
                  onChange={(event) => setForm({ ...form, address: event.target.value })}
                  placeholder="Rua, avenida e bairro"
                />
              </div>
              <div className="grid grid-cols-[1fr_90px] gap-3">
                <div className="space-y-2">
                  <Label>Cidade *</Label>
                  <Input
                    value={form.city}
                    onChange={(event) => setForm({ ...form, city: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>UF *</Label>
                  <Input
                    value={form.state}
                    onChange={(event) =>
                      setForm({ ...form, state: event.target.value.toUpperCase().slice(0, 2) })
                    }
                    maxLength={2}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Cidade e UF preenchidas pelo CEP serão usadas no mapa do dashboard.
              </p>
            </div>
            {!editing && (
              <>
                <hr />
                <p className="text-sm font-medium text-muted-foreground">Usuário de acesso (PARTNER)</p>
                <div className="space-y-2"><Label>Nome do usuário</Label><Input value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} /></div>
                <div className="space-y-2"><Label>E-mail de login</Label><Input type="email" value={form.userEmail} onChange={(e) => setForm({ ...form, userEmail: e.target.value })} /></div>
                <div className="space-y-2"><Label>Senha</Label><Input type="password" value={form.userPassword} onChange={(e) => setForm({ ...form, userPassword: e.target.value })} /></div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <Tabs defaultValue="filiais">
              <TabsList>
                <TabsTrigger value="filiais">Filiais</TabsTrigger>
                <TabsTrigger value="planos">Planos</TabsTrigger>
                <TabsTrigger value="usuario">Usuário</TabsTrigger>
              </TabsList>
              <TabsContent value="filiais" className="space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setBranchDialogOpen(true)}><Plus className="mr-1 h-4 w-4" /> Nova Filial</Button>
                </div>
                {(selected.branches ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma filial cadastrada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.branches?.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell>{b.name}</TableCell>
                          <TableCell>{b.city ?? '-'}</TableCell>
                          <TableCell><Badge variant="outline">{b.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
              <TabsContent value="planos" className="space-y-4">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {allPlans.map((plan) => (
                    <label key={plan.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
                      <Checkbox
                        checked={!!selectedPlanIds[plan.id]}
                        onCheckedChange={(checked) =>
                          setSelectedPlanIds((prev) => ({ ...prev, [plan.id]: !!checked }))
                        }
                      />
                      <div className="flex-1">
                        <p className="font-medium">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.operator?.name} · {formatCommission(plan.commissionType, Number(plan.commissionValue))}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <Button onClick={handleSavePlans}><Package className="mr-2 h-4 w-4" /> Salvar planos</Button>
              </TabsContent>
              <TabsContent value="usuario" className="space-y-4">
                {selected.users?.map((u) => (
                  <div key={u.id} className="rounded-lg border p-4">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                ))}
                <Button variant="outline" onClick={() => setPasswordOpen(true)}>
                  <Key className="mr-2 h-4 w-4" /> Redefinir senha
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir senha</DialogTitle></DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Nova senha</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordOpen(false)}>Cancelar</Button>
            <Button onClick={handleResetPassword}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Filial</DialogTitle></DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Documento</Label><Input value={branchForm.document} onChange={(e) => setBranchForm({ ...branchForm, document: e.target.value })} /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input value={branchForm.email} onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Endereço</Label><Input value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Cidade</Label><Input value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} /></div>
              <div className="space-y-2"><Label>UF</Label><Input value={branchForm.state} onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })} /></div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">Acesso da filial</p>
              <div className="space-y-2"><Label>Login (e-mail)</Label><Input type="email" value={branchForm.login} onChange={(e) => setBranchForm({ ...branchForm, login: e.target.value })} /></div>
              <div className="space-y-2"><Label>Senha</Label><Input type="password" value={branchForm.password} onChange={(e) => setBranchForm({ ...branchForm, password: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveBranch}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
