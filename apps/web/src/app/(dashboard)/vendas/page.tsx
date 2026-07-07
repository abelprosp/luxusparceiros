'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Download, ShoppingCart, Check, X, AlertTriangle, FileText, MoreHorizontal } from 'lucide-react';
import { SaleStatus, DocumentType, SALE_STATUS_LABELS } from '@luxus/types';
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
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toaster';
import { CreateSaleButton } from '@/components/sales/create-sale-dialog';
import { useAuth } from '@/hooks/useAuth';
import { isPartnerUser } from '@/lib/rbac';

interface Sale {
  id: string;
  protocol: string;
  status: SaleStatus;
  value: number;
  partner?: { name: string };
  client?: { name: string };
  operator?: { name: string };
  plan?: { name: string };
  campaign?: { title: string };
  branch?: { name: string };
  rejectionReason?: string;
  contestReason?: string;
  requiredDocuments?: { type: string; label: string; fulfilled: boolean }[];
  createdAt: string;
}

const DOC_OPTIONS = [
  { type: DocumentType.CPF, label: 'CPF' },
  { type: DocumentType.RG, label: 'RG' },
  { type: DocumentType.SELFIE, label: 'Selfie' },
  { type: DocumentType.CHIP_PHOTO, label: 'Foto do chip' },
  { type: DocumentType.LINE_PHOTO, label: 'Foto da linha' },
  { type: DocumentType.CONTRACT, label: 'Contrato' },
  { type: DocumentType.SIGNATURE, label: 'Assinatura' },
];

export default function VendasPage() {
  const [items, setItems] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [actionDialog, setActionDialog] = useState<'reject' | 'contest' | 'documents' | null>(null);
  const [reason, setReason] = useState('');
  const [docMessage, setDocMessage] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { user } = useAuth();
  const isPartner = isPartnerUser(user);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<Sale>('/sales', {
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page,
        limit: 15,
      });
      setItems(res.data);
      setTotalPages(res.meta.totalPages);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [search, statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (sale: Sale) => {
    try {
      await api(`/sales/${sale.id}/approve`, { method: 'POST' });
      toast({ title: 'Venda aprovada', variant: 'success' });
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    }
  };

  const handleAction = async () => {
    if (!selected || !actionDialog) return;
    try {
      if (actionDialog === 'reject') {
        await api(`/sales/${selected.id}/reject`, { method: 'POST', body: { reason } });
        toast({ title: 'Venda rejeitada', variant: 'success' });
      } else if (actionDialog === 'contest') {
        await api(`/sales/${selected.id}/contest`, { method: 'POST', body: { reason } });
        toast({ title: 'Venda contestada', variant: 'success' });
      } else if (actionDialog === 'documents') {
        const documents = DOC_OPTIONS.filter((d) => selectedDocs[d.type]).map((d) => ({
          type: d.type,
          label: d.label,
          fulfilled: false,
        }));
        await api(`/sales/${selected.id}/request-documents`, {
          method: 'POST',
          body: { documents, message: docMessage },
        });
        toast({ title: 'Documentos solicitados', variant: 'success' });
      }
      setActionDialog(null);
      setReason('');
      setDocMessage('');
      setSelectedDocs({});
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    }
  };

  const openAction = (sale: Sale, action: typeof actionDialog) => {
    setSelected(sale);
    setActionDialog(action);
    setReason('');
    setDocMessage('');
    setSelectedDocs({});
  };

  const statusBadge = (status: SaleStatus) => {
    if ([SaleStatus.APPROVED, SaleStatus.ACTIVATED].includes(status)) return 'success';
    if ([SaleStatus.REJECTED, SaleStatus.CANCELLED].includes(status)) return 'destructive';
    return 'outline';
  };

  return (
    <DashboardLayout title="Vendas" description={isPartner ? 'Suas vendas registradas' : 'Listagem e gestão de vendas'}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Protocolo, cliente..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.values(SaleStatus).map((s) => (
                <SelectItem key={s} value={s}>{SALE_STATUS_LABELS[s] ?? s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <CreateSaleButton onSuccess={load} />
          {!isPartner && (
            <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Exportar</Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="Nenhuma venda" description="As vendas aparecerão aqui." />
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  {!isPartner && <TableHead>Parceiro</TableHead>}
                  <TableHead>Cliente</TableHead>
                  <TableHead>Plano</TableHead>
                  {!isPartner && <TableHead>Campanha</TableHead>}
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  {!isPartner && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{s.protocol}</TableCell>
                    {!isPartner && <TableCell>{s.partner?.name || '-'}</TableCell>}
                    <TableCell>{s.client?.name || '-'}</TableCell>
                    <TableCell>{s.plan?.name || '-'}</TableCell>
                    {!isPartner && <TableCell>{s.campaign?.title || '-'}</TableCell>}
                    <TableCell>{formatCurrency(Number(s.value))}</TableCell>
                    <TableCell><Badge variant={statusBadge(s.status)}>{SALE_STATUS_LABELS[s.status] ?? s.status}</Badge></TableCell>
                    <TableCell>{formatDate(s.createdAt)}</TableCell>
                    {!isPartner && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {[SaleStatus.IN_ANALYSIS, SaleStatus.PENDING, SaleStatus.DOCUMENTS_PENDING, SaleStatus.CONTESTED].includes(s.status) && (
                              <DropdownMenuItem onClick={() => handleApprove(s)}>
                                <Check className="mr-2 h-4 w-4 text-green-600" /> Aprovar
                              </DropdownMenuItem>
                            )}
                            {[SaleStatus.IN_ANALYSIS, SaleStatus.PENDING, SaleStatus.DOCUMENTS_PENDING, SaleStatus.CONTESTED].includes(s.status) && (
                              <DropdownMenuItem onClick={() => openAction(s, 'reject')}>
                                <X className="mr-2 h-4 w-4 text-red-600" /> Rejeitar
                              </DropdownMenuItem>
                            )}
                            {[SaleStatus.IN_ANALYSIS, SaleStatus.PENDING, SaleStatus.DOCUMENTS_PENDING].includes(s.status) && (
                              <DropdownMenuItem onClick={() => openAction(s, 'contest')}>
                                <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" /> Contestar
                              </DropdownMenuItem>
                            )}
                            {[SaleStatus.IN_ANALYSIS, SaleStatus.PENDING, SaleStatus.CONTESTED].includes(s.status) && (
                              <DropdownMenuItem onClick={() => openAction(s, 'documents')}>
                                <FileText className="mr-2 h-4 w-4" /> Solicitar documentos
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
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

      <Dialog open={actionDialog === 'reject' || actionDialog === 'contest'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog === 'reject' ? 'Rejeitar venda' : 'Contestar venda'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Motivo</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva o motivo..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancelar</Button>
            <Button onClick={handleAction} variant={actionDialog === 'reject' ? 'destructive' : 'default'}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={actionDialog === 'documents'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar documentos</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              {DOC_OPTIONS.map((doc) => (
                <label key={doc.type} className="flex items-center gap-2">
                  <Checkbox
                    checked={!!selectedDocs[doc.type]}
                    onCheckedChange={(c) => setSelectedDocs((prev) => ({ ...prev, [doc.type]: !!c }))}
                  />
                  {doc.label}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Mensagem ao parceiro</Label>
              <Input value={docMessage} onChange={(e) => setDocMessage(e.target.value)} placeholder="Instruções adicionais..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancelar</Button>
            <Button onClick={handleAction}>Enviar solicitação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
