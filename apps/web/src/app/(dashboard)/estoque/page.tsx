'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Upload, Warehouse, Download, Plus, Smartphone } from 'lucide-react';
import { LineStatus } from '@luxus/types';
import { formatDate } from '@luxus/utils';
import { api, API_URL, getPaginated } from '@/lib/api';
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
import { useToast } from '@/components/ui/toaster';

interface SimCard {
  id: string;
  iccid: string;
  status: LineStatus;
  operator?: { name: string };
  partner?: { name: string };
  batchNumber?: string;
  createdAt: string;
}

interface Line {
  id: string;
  number: string;
  status: LineStatus;
  operator?: { id: string; name: string };
  plan?: { id: string; name: string };
  partner?: { id: string; name: string };
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

const emptyLineForm = {
  number: '',
  operatorId: '',
  planId: '',
  partnerId: '',
};

export default function EstoquePage() {
  const [tab, setTab] = useState('chips');
  const [items, setItems] = useState<SimCard[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [iccid, setIccid] = useState('');
  const [lineSearch, setLineSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [importing, setImporting] = useState(false);
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [lineForm, setLineForm] = useState(emptyLineForm);
  const [savingLine, setSavingLine] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadChips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<SimCard>('/sim-cards', {
        search: iccid || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 50,
      });
      setItems(res.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [iccid, statusFilter]);

  const loadLines = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<Line>('/lines', {
        search: lineSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 50,
      });
      setLines(res.data);
    } catch {
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [lineSearch, statusFilter]);

  useEffect(() => {
    if (tab === 'chips') loadChips();
    else loadLines();
  }, [tab, loadChips, loadLines]);

  useEffect(() => {
    Promise.all([
      getPaginated<Operator>('/operators', { limit: 100 }),
      getPaginated<Plan>('/plans', { limit: 200 }),
      getPaginated<Partner>('/partners', { limit: 100, status: 'ACTIVE' }),
    ])
      .then(([ops, pls, pts]) => {
        setOperators(ops.data);
        setPlans(pls.data);
        setPartners(pts.data);
      })
      .catch(() => {});
  }, []);

  const filteredPlans = plans.filter((p) => p.operatorId === lineForm.operatorId);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('luxus_access_token') || sessionStorage.getItem('luxus_access_token');
      const res = await fetch(`${API_URL}/stock/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Falha na importação');
      toast({ title: 'CSV importado com sucesso', variant: 'success' });
      loadChips();
      loadLines();
    } catch (err) {
      toast({ title: 'Erro na importação', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleCreateLine = async () => {
    if (!lineForm.number || !lineForm.operatorId) {
      toast({ title: 'Preencha número e operadora', variant: 'destructive' });
      return;
    }
    setSavingLine(true);
    try {
      await api('/lines', {
        method: 'POST',
        body: {
          number: lineForm.number,
          operatorId: lineForm.operatorId,
          planId: lineForm.planId || undefined,
          partnerId: lineForm.partnerId || undefined,
        },
      });
      toast({ title: 'Linha cadastrada', variant: 'success' });
      setLineDialogOpen(false);
      setLineForm(emptyLineForm);
      setTab('lines');
      loadLines();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao cadastrar', variant: 'destructive' });
    } finally {
      setSavingLine(false);
    }
  };

  const statusSelect = (
    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        <SelectItem value="AVAILABLE">Disponível</SelectItem>
        <SelectItem value="RESERVED">Reservado</SelectItem>
        <SelectItem value="USED">Usado</SelectItem>
        <SelectItem value="ACTIVATED">Ativado</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <DashboardLayout title="Estoque" description="Gestão de chips, linhas e ICCIDs">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="chips">Chips (ICCID)</TabsTrigger>
            <TabsTrigger value="lines">Linhas</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {tab === 'lines' && (
              <Button onClick={() => { setLineForm(emptyLineForm); setLineDialogOpen(true); }}>
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
                <Button variant="outline" onClick={() => api('/stock/export', { method: 'GET' })}>
                  <Download className="mr-2 h-4 w-4" /> Exportar
                </Button>
              </>
            )}
          </div>
        </div>

        <TabsContent value="chips">
          <div className="mb-4 flex flex-1 gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar ICCID..." className="pl-9" value={iccid} onChange={(e) => setIccid(e.target.value)} />
            </div>
            {statusSelect}
          </div>

          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={Warehouse} title="Estoque vazio" description="Importe chips via CSV." />
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.iccid}</TableCell>
                      <TableCell>{s.operator?.name || '-'}</TableCell>
                      <TableCell>{s.partner?.name || '-'}</TableCell>
                      <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                      <TableCell>{s.batchNumber || '-'}</TableCell>
                      <TableCell>{formatDate(s.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="lines">
          <div className="mb-4 flex flex-1 gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar número..." className="pl-9" value={lineSearch} onChange={(e) => setLineSearch(e.target.value)} />
            </div>
            {statusSelect}
          </div>

          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : lines.length === 0 ? (
            <EmptyState
              icon={Smartphone}
              title="Nenhuma linha"
              description="Cadastre manualmente uma linha telefônica."
              action={
                <Button onClick={() => { setLineForm(emptyLineForm); setLineDialogOpen(true); }}>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-sm">{l.number}</TableCell>
                      <TableCell>{l.operator?.name || '-'}</TableCell>
                      <TableCell>{l.plan?.name || '-'}</TableCell>
                      <TableCell>{l.partner?.name || '-'}</TableCell>
                      <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                      <TableCell>{formatDate(l.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Linha</DialogTitle>
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
                value={lineForm.operatorId}
                onValueChange={(v) => setLineForm({ ...lineForm, operatorId: v, planId: '' })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione a operadora" /></SelectTrigger>
                <SelectContent>
                  {operators.map((op) => (
                    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                  ))}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLineDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateLine} disabled={savingLine}>
              {savingLine ? 'Salvando...' : 'Cadastrar linha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
