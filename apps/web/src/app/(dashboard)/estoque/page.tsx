'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Upload, Warehouse, Download, Plus, Smartphone, Pencil } from 'lucide-react';
import { LineStatus, LINE_STATUS_LABELS } from '@luxus/types';
import { formatDate, formatPhone } from '@luxus/utils';
import { api, downloadAuthenticatedFile, getPaginated } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/useAuth';
import { isPartnerUser } from '@/lib/rbac';

interface SimCard {
  id: string;
  iccid: string;
  status: LineStatus;
  operator?: { id: string; name: string };
  partner?: { id: string; name: string };
  batchNumber?: string;
  createdAt: string;
}

interface Line {
  id: string;
  number: string;
  status: LineStatus;
  operator?: { id: string; name: string };
  plan?: { id: string; name: string };
  partner?: { id: string; name: string } | null;
  createdAt: string;
}

interface Operator {
  id: string;
  name: string;
}

interface Plan {
  id: string;
  name: string;
  operatorId: string;
}

interface Partner {
  id: string;
  name: string;
}

interface AdminStockSummary {
  chipsTotal: number;
  chipsAvailable: number;
  linesTotal: number;
  linesAvailable: number;
  linesGeneral: number;
}

interface PartnerStockSummary {
  myAvailable: number;
  myReserved: number;
  generalAvailable: number;
  totalLines: number;
  chips: number;
}

const emptyLineForm = {
  number: '',
  operatorId: '',
  planId: '',
  partnerId: '',
  status: LineStatus.AVAILABLE,
};

function statusBadgeVariant(status: LineStatus) {
  if (status === LineStatus.AVAILABLE) return 'success' as const;
  if (status === LineStatus.RESERVED) return 'warning' as const;
  if ([LineStatus.USED, LineStatus.ACTIVATED].includes(status)) return 'secondary' as const;
  if ([LineStatus.BLOCKED, LineStatus.CANCELLED].includes(status)) return 'destructive' as const;
  return 'outline' as const;
}

function LineStatusBadge({ status }: { status: LineStatus }) {
  return (
    <Badge variant={statusBadgeVariant(status)}>
      {LINE_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

export default function EstoquePage() {
  const [tab, setTab] = useState('chips');
  const [items, setItems] = useState<SimCard[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [chipSearch, setChipSearch] = useState('');
  const [lineSearch, setLineSearch] = useState('');
  const [debouncedChipSearch, setDebouncedChipSearch] = useState('');
  const [debouncedLineSearch, setDebouncedLineSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [importing, setImporting] = useState(false);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<Line | null>(null);
  const [lineForm, setLineForm] = useState(emptyLineForm);
  const [savingLine, setSavingLine] = useState(false);
  const [adminSummary, setAdminSummary] = useState<AdminStockSummary | null>(null);
  const [partnerSummary, setPartnerSummary] = useState<PartnerStockSummary | null>(null);
  const [assigningChip, setAssigningChip] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const isPartner = isPartnerUser(user);
  const [reserving, setReserving] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedChipSearch(chipSearch), 300);
    return () => clearTimeout(timer);
  }, [chipSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedLineSearch(lineSearch), 300);
    return () => clearTimeout(timer);
  }, [lineSearch]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await api<AdminStockSummary | PartnerStockSummary>('/stock/summary');
      if (isPartner) setPartnerSummary(data as PartnerStockSummary);
      else setAdminSummary(data as AdminStockSummary);
    } catch {
      if (isPartner) setPartnerSummary(null);
      else setAdminSummary(null);
    }
  }, [isPartner]);

  const loadChips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<SimCard>('/sim-cards', {
        search: debouncedChipSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        partnerId: partnerFilter !== 'all' && partnerFilter !== 'general' ? partnerFilter : undefined,
        generalOnly: partnerFilter === 'general' ? true : undefined,
        limit: 50,
      });
      setItems(res.data);
    } catch (err) {
      setItems([]);
      toast({
        title: 'Erro ao carregar chips',
        description: err instanceof Error ? err.message : 'Falha na requisição',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedChipSearch, statusFilter, partnerFilter, toast]);

  const loadLines = useCallback(async () => {
    setLoading(true);
    try {
      const path = isPartner ? '/stock/lines' : '/lines';
      const res = await getPaginated<Line>(path, {
        search: debouncedLineSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        partnerId: !isPartner && partnerFilter !== 'all' && partnerFilter !== 'general' ? partnerFilter : undefined,
        generalOnly: !isPartner && partnerFilter === 'general' ? true : undefined,
        limit: 50,
      });
      setLines(res.data);
    } catch (err) {
      setLines([]);
      toast({
        title: 'Erro ao carregar linhas',
        description: err instanceof Error ? err.message : 'Falha na requisição',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedLineSearch, statusFilter, partnerFilter, isPartner, toast]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (isPartner) {
      loadLines();
      return;
    }
    if (tab === 'chips') loadChips();
    else loadLines();
  }, [tab, loadChips, loadLines, isPartner]);

  const loadFormOptions = useCallback(async () => {
    const [opsRes, ptsRes] = await Promise.allSettled([
      getPaginated<Operator>('/operators', { limit: 100 }),
      getPaginated<Partner>('/partners', { limit: 100 }),
    ]);

    if (opsRes.status === 'fulfilled') setOperators(opsRes.value.data);
    if (ptsRes.status === 'fulfilled') setPartners(ptsRes.value.data);
  }, []);

  useEffect(() => {
    if (isPartner) return;
    loadFormOptions();
  }, [isPartner, loadFormOptions]);

  useEffect(() => {
    if (isPartner || !lineDialogOpen) return;
    loadFormOptions();
  }, [isPartner, lineDialogOpen, loadFormOptions]);

  useEffect(() => {
    if (!lineForm.operatorId) {
      setPlans([]);
      return;
    }
    getPaginated<Plan>('/plans', { limit: 100, operatorId: lineForm.operatorId })
      .then((res) => setPlans(res.data))
      .catch(() => setPlans([]));
  }, [lineForm.operatorId]);

  const handleReserve = async (lineId: string) => {
    setReserving(lineId);
    try {
      await api(`/stock/lines/${lineId}/reserve`, { method: 'POST' });
      toast({ title: 'Linha reservada', description: 'A linha agora está vinculada ao seu parceiro.', variant: 'success' });
      loadLines();
      loadSummary();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao reservar', variant: 'destructive' });
    } finally {
      setReserving(null);
    }
  };

  const handleAssignChip = async (chipId: string, partnerId: string | null) => {
    setAssigningChip(chipId);
    try {
      await api(`/sim-cards/${chipId}`, {
        method: 'PATCH',
        body: { partnerId: partnerId || undefined },
      });
      toast({ title: 'Chip atualizado', variant: 'success' });
      loadChips();
      loadSummary();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao atribuir', variant: 'destructive' });
    } finally {
      setAssigningChip(null);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api<{ imported: number; errors: string[] }>('/stock/import', {
        method: 'POST',
        body: formData,
      });
      const errorMsg = result.errors?.length ? ` ${result.errors.length} erro(s).` : '';
      toast({
        title: 'Importação concluída',
        description: `${result.imported} item(ns) importado(s).${errorMsg}`,
        variant: result.errors?.length ? 'destructive' : 'success',
      });
      loadChips();
      loadLines();
      loadSummary();
    } catch (err) {
      toast({ title: 'Erro na importação', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleExport = async () => {
    try {
      await downloadAuthenticatedFile('/stock/export', 'estoque.csv');
    } catch (err) {
      toast({ title: 'Erro na exportação', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    }
  };

  const openCreateLine = () => {
    setEditingLine(null);
    setLineForm(emptyLineForm);
    setLineDialogOpen(true);
  };

  const openEditLine = async (line: Line) => {
    setSavingLine(true);
    try {
      const full = await api<Line & { operator?: { id: string }; plan?: { id: string }; partner?: { id: string } | null }>(`/lines/${line.id}`);
      setEditingLine(full);
      setLineForm({
        number: full.number,
        operatorId: full.operator?.id ?? '',
        planId: full.plan?.id ?? '',
        partnerId: full.partner?.id ?? '',
        status: full.status,
      });
      setLineDialogOpen(true);
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao carregar linha', variant: 'destructive' });
    } finally {
      setSavingLine(false);
    }
  };

  const handleSaveLine = async () => {
    if (!lineForm.number || !lineForm.operatorId) {
      toast({ title: 'Preencha número e operadora', variant: 'destructive' });
      return;
    }
    setSavingLine(true);
    try {
      const body = {
        number: lineForm.number,
        operatorId: lineForm.operatorId,
        planId: lineForm.planId || null,
        partnerId: lineForm.partnerId || null,
        ...(editingLine && { status: lineForm.status }),
      };

      if (editingLine) {
        await api(`/lines/${editingLine.id}`, { method: 'PATCH', body });
        toast({ title: 'Linha atualizada', variant: 'success' });
      } else {
        await api('/lines', { method: 'POST', body });
        toast({ title: 'Linha cadastrada', variant: 'success' });
        setTab('lines');
      }
      setLineDialogOpen(false);
      setEditingLine(null);
      setLineForm(emptyLineForm);
      loadLines();
      loadSummary();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao salvar', variant: 'destructive' });
    } finally {
      setSavingLine(false);
    }
  };

  const filteredPlans = plans.filter((p) => p.operatorId === lineForm.operatorId);

  const statusSelect = (
    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        {Object.values(LineStatus).map((s) => (
          <SelectItem key={s} value={s}>{LINE_STATUS_LABELS[s]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const partnerSelect = !isPartner && partners.length > 0 ? (
    <Select value={partnerFilter} onValueChange={setPartnerFilter}>
      <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Parceiro" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos parceiros</SelectItem>
        <SelectItem value="general">Estoque geral</SelectItem>
        {partners.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : null;

  if (isPartner) {
    const sortedLines = [...lines].sort((a, b) => {
      const aGeneral = !a.partner?.id && a.status === LineStatus.AVAILABLE ? 0 : 1;
      const bGeneral = !b.partner?.id && b.status === LineStatus.AVAILABLE ? 0 : 1;
      return aGeneral - bGeneral;
    });

    return (
      <DashboardLayout title="Estoque" description="Linhas disponíveis e reservadas do parceiro">
        {partnerSummary && (
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Estoque geral</p>
                <p className="text-2xl font-bold text-primary">{partnerSummary.generalAvailable}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Minhas disponíveis</p>
                <p className="text-2xl font-bold">{partnerSummary.myAvailable}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Reservadas</p>
                <p className="text-2xl font-bold">{partnerSummary.myReserved}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Meus chips</p>
                <p className="text-2xl font-bold">{partnerSummary.chips}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar número..." className="pl-9" value={lineSearch} onChange={(e) => setLineSearch(e.target.value)} />
          </div>
          {statusSelect}
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : sortedLines.length === 0 ? (
          <EmptyState
            icon={Smartphone}
            title="Nenhuma linha no estoque"
            description="Linhas do estoque geral ou já vinculadas ao seu parceiro aparecerão aqui."
          />
        ) : (
          <div className="space-y-3">
            {sortedLines.map((l) => {
              const isGeneral = !l.partner?.id;
              const canReserve = isGeneral && l.status === LineStatus.AVAILABLE;
              return (
                <div key={l.id} className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-card">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono font-semibold">{formatPhone(l.number)}</p>
                      {isGeneral ? (
                        <Badge variant="outline">Estoque geral</Badge>
                      ) : (
                        <Badge variant="secondary">Minha linha</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {l.operator?.name} · {l.plan?.name ?? 'Sem plano'}
                    </p>
                    <div className="mt-1">
                      <LineStatusBadge status={l.status} />
                    </div>
                  </div>
                  {canReserve && (
                    <Button size="sm" onClick={() => handleReserve(l.id)} disabled={reserving === l.id}>
                      {reserving === l.id ? 'Reservando...' : 'Reservar'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Estoque" description="Gestão de chips, linhas e ICCIDs">
      {adminSummary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Chips</p>
              <p className="text-2xl font-bold">{adminSummary.chipsTotal}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Chips disponíveis</p>
              <p className="text-2xl font-bold text-primary">{adminSummary.chipsAvailable}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Linhas</p>
              <p className="text-2xl font-bold">{adminSummary.linesTotal}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Linhas disponíveis</p>
              <p className="text-2xl font-bold">{adminSummary.linesAvailable}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Estoque geral</p>
              <p className="text-2xl font-bold">{adminSummary.linesGeneral}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="chips">Chips (ICCID)</TabsTrigger>
            <TabsTrigger value="lines">Linhas</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {tab === 'lines' && (
              <Button onClick={openCreateLine}>
                <Plus className="mr-2 h-4 w-4" /> Nova Linha
              </Button>
            )}
            {tab === 'chips' && (
              <>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
                  <Upload className="mr-2 h-4 w-4" />
                  {importing ? 'Importando...' : 'Importar CSV'}
                </Button>
                <Button variant="outline" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" /> Exportar
                </Button>
              </>
            )}
          </div>
        </div>

        <TabsContent value="chips">
          <div className="mb-4 flex flex-1 flex-wrap gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar ICCID..." className="pl-9" value={chipSearch} onChange={(e) => setChipSearch(e.target.value)} />
            </div>
            {statusSelect}
            {partnerSelect}
          </div>

          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={Warehouse} title="Estoque vazio" description="Importe chips via CSV ou cadastre manualmente." />
          ) : (
            <div className="rounded-xl border bg-card shadow-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ICCID</TableHead>
                    <TableHead>Operadora</TableHead>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Atribuir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.iccid}</TableCell>
                      <TableCell>{s.operator?.name || '-'}</TableCell>
                      <TableCell>{s.partner?.name || 'Estoque geral'}</TableCell>
                      <TableCell><LineStatusBadge status={s.status} /></TableCell>
                      <TableCell>{s.batchNumber || '-'}</TableCell>
                      <TableCell>{formatDate(s.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {s.status === LineStatus.AVAILABLE ? (
                          <Select
                            value={s.partner?.id ?? 'none'}
                            disabled={assigningChip === s.id}
                            onValueChange={(v) => handleAssignChip(s.id, v === 'none' ? null : v)}
                          >
                            <SelectTrigger className="w-36 h-8">
                              <SelectValue placeholder="Parceiro" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Estoque geral</SelectItem>
                              {partners.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="lines">
          <div className="mb-4 flex flex-1 flex-wrap gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar número..." className="pl-9" value={lineSearch} onChange={(e) => setLineSearch(e.target.value)} />
            </div>
            {statusSelect}
            {partnerSelect}
          </div>

          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : lines.length === 0 ? (
            <EmptyState
              icon={Smartphone}
              title="Nenhuma linha"
              description="Cadastre manualmente uma linha telefônica."
              action={
                <Button onClick={openCreateLine}>
                  <Plus className="mr-2 h-4 w-4" /> Nova Linha
                </Button>
              }
            />
          ) : (
            <div className="rounded-xl border bg-card shadow-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Operadora</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-sm">{formatPhone(l.number)}</TableCell>
                      <TableCell>{l.operator?.name || '-'}</TableCell>
                      <TableCell>{l.plan?.name || '-'}</TableCell>
                      <TableCell>{l.partner?.name || 'Estoque geral'}</TableCell>
                      <TableCell><LineStatusBadge status={l.status} /></TableCell>
                      <TableCell>{formatDate(l.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEditLine(l)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={lineDialogOpen} onOpenChange={(open) => { if (!open) { setEditingLine(null); setLineForm(emptyLineForm); } setLineDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLine ? 'Editar linha' : 'Nova linha'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Número *</Label>
              <Input
                placeholder="Ex: (11) 99999-9999"
                value={lineForm.number}
                onChange={(e) => setLineForm({ ...lineForm, number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Operadora *</Label>
              <Select
                value={lineForm.operatorId || undefined}
                onValueChange={(v) => setLineForm({ ...lineForm, operatorId: v, planId: '' })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione a operadora" /></SelectTrigger>
                <SelectContent>
                  {operators.length === 0 ? (
                    <SelectItem value="__empty" disabled>Nenhuma operadora cadastrada</SelectItem>
                  ) : (
                    operators.map((op) => (
                      <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select
                value={lineForm.planId || 'none'}
                onValueChange={(v) => setLineForm({ ...lineForm, planId: v === 'none' ? '' : v })}
                disabled={!lineForm.operatorId}
              >
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {filteredPlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Parceiro</Label>
              <Select
                value={lineForm.partnerId || 'none'}
                onValueChange={(v) => setLineForm({ ...lineForm, partnerId: v === 'none' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="Opcional — estoque geral" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Estoque geral (sem parceiro)</SelectItem>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editingLine && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={lineForm.status}
                  onValueChange={(v) => setLineForm({ ...lineForm, status: v as LineStatus })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(LineStatus).map((s) => (
                      <SelectItem key={s} value={s}>{LINE_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveLine} disabled={savingLine}>
              {savingLine ? 'Salvando...' : editingLine ? 'Salvar alterações' : 'Cadastrar linha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
