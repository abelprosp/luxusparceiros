'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Download, ShoppingCart, Check, X, FileText, MoreHorizontal, Upload, Eye, Pencil, Trash2, MessageSquare, AlertTriangle, ImageIcon } from 'lucide-react';
import { SaleContractStage, SaleReviewStatus, SaleStatus, DocumentType, PERMISSIONS, SALE_REVIEW_STATUS_LABELS, SALE_STATUS_LABELS, saleContractStageLabel, saleTaskUserName } from '@luxus/types';
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
import { ResubmitSaleDocumentsDialog } from '@/components/sales/resubmit-sale-documents-dialog';
import { SaleDetailDialog } from '@/components/sales/sale-detail-dialog';
import { EditSaleDialog } from '@/components/sales/edit-sale-dialog';
import { ApproveSaleForTaskDialog } from '@/components/sales/approve-sale-for-task-dialog';
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog';
import { MobileListCard, ResponsiveDataView } from '@/components/ui/mobile-list-card';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, isPartnerUser } from '@/lib/rbac';
import {
  isTaskReminderNotification,
  taskReminderText,
  useNotifications,
  type NotificationItem,
} from '@/components/notifications/notifications-provider';

interface Sale {
  id: string;
  protocol: string;
  status: SaleStatus;
  reviewStatus: SaleReviewStatus;
  correctionReason?: string;
  contractCorrectionReason?: string | null;
  taskProtocol?: string;
  taskStatus?: string;
  taskSyncStatus?: string;
  taskSyncError?: string | null;
  taskDemandId?: string;
  contractStage: SaleContractStage;
  taskIsBeingEdited?: boolean;
  taskEditorName?: string;
  taskResponsibleName?: string;
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

function hasTaskMessage(sale: { contractCorrectionReason?: string | null }) {
  return Boolean(sale.contractCorrectionReason?.trim());
}

function hasUnreadTaskMessage(saleId: string, notifications: NotificationItem[]) {
  return notifications.some((item) => !item.isRead && isTaskReminderNotification(item, saleId));
}

function TaskMessageBadge({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Há uma mensagem do Luxus Task. Clique para ver."
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="task-reminder-pulse inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-amber-400"
    >
      <span className="relative inline-flex">
        <MessageSquare className="h-4 w-4" />
        <AlertTriangle className="absolute -right-1.5 -top-1.5 h-3 w-3 fill-amber-400 text-amber-200" />
      </span>
    </button>
  );
}

export default function VendasPage() {
  const [items, setItems] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [syncErrorOnly, setSyncErrorOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [actionDialog, setActionDialog] = useState<'reject' | 'documents' | null>(null);
  const [reason, setReason] = useState('');
  const [docMessage, setDocMessage] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<Record<string, boolean>>({});
  const [resubmitSaleId, setResubmitSaleId] = useState<string | null>(null);
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'photos' | 'details'>('overview');
  const [messageSale, setMessageSale] = useState<Sale | null>(null);
  const [editSaleId, setEditSaleId] = useState<string | null>(null);
  const [approveSaleId, setApproveSaleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const openedFromQueryRef = useRef(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { notifications, markSaleRemindersRead } = useNotifications();
  const isPartner = isPartnerUser(user);
  const canDeleteSales = hasPermission(user, PERMISSIONS.SALES_DELETE);
  const canDelete = (sale: Sale) =>
    canDeleteSales
    && sale.status !== SaleStatus.ACTIVATED
    && !sale.taskDemandId
    && (sale.taskSyncStatus ?? 'NOT_READY') === 'NOT_READY';
  const canEdit = (sale: Sale) =>
    sale.contractStage !== SaleContractStage.COMPLETED
    && ![SaleStatus.ACTIVATED, SaleStatus.CANCELLED, SaleStatus.REJECTED].includes(sale.status)
    && ![SaleReviewStatus.REJECTED, SaleReviewStatus.CANCELLED].includes(sale.reviewStatus);
  const canReview = (sale: Sale) =>
    [SaleReviewStatus.AWAITING_REVIEW, SaleReviewStatus.UNDER_REVIEW].includes(sale.reviewStatus);
  const openDetail = (saleId: string, tab: 'overview' | 'photos' = 'overview') => {
    setDetailTab(tab);
    setDetailSaleId(saleId);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<Sale>('/sales', {
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        syncError: syncErrorOnly || undefined,
        page,
        limit: 15,
      });
      setItems(res.data);
      setTotalPages(res.meta.totalPages);
    } catch (err) {
      setItems([]);
      toast({
        title: 'Erro ao carregar vendas',
        description: err instanceof Error ? err.message : 'Falha na requisição',
        variant: 'destructive',
      });
    } finally { setLoading(false); }
  }, [search, statusFilter, syncErrorOnly, page, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setItems((prev) => prev.map((sale) => {
      const reminder = notifications.find((item) => isTaskReminderNotification(item, sale.id));
      const text = reminder ? taskReminderText(reminder) : '';
      if (!text || text === sale.contractCorrectionReason) return sale;
      return { ...sale, contractCorrectionReason: text };
    }));
    setMessageSale((current) => {
      if (!current) return current;
      const reminder = notifications.find((item) => isTaskReminderNotification(item, current.id));
      const text = reminder ? taskReminderText(reminder) : '';
      if (!text || text === current.contractCorrectionReason) return current;
      return { ...current, contractCorrectionReason: text };
    });
  }, [notifications]);

  useEffect(() => {
    if (openedFromQueryRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const saleId = params.get('sale');
    if (!saleId) return;
    if (params.get('message') === '1') {
      if (!items.length) return;
      openedFromQueryRef.current = true;
      const match = items.find((item) => item.id === saleId);
      if (match && hasTaskMessage(match)) {
        setMessageSale(match);
        return;
      }
    } else {
      openedFromQueryRef.current = true;
    }
    setDetailTab('overview');
    setDetailSaleId(saleId);
  }, [items]);

  const handleApprove = async (sale: Sale) => {
    setApproveSaleId(sale.id);
  };

  const handleAction = async () => {
    if (!selected || !actionDialog) return;
    try {
      if (actionDialog === 'reject') {
        await api(`/sales/${selected.id}/request-correction`, { method: 'POST', body: { reason } });
        toast({ title: 'Venda devolvida para correção', variant: 'success' });
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

  const deleteSale = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/sales/${deleteTarget.id}`, { method: 'DELETE' });
      toast({ title: 'Venda excluída', description: `${deleteTarget.protocol} foi removida.`, variant: 'success' });
      setDeleteTarget(null);
      await load();
    } catch (error) {
      toast({ title: 'Não foi possível excluir a venda', description: error instanceof Error ? error.message : 'Falha', variant: 'destructive' });
    } finally { setDeleting(false); }
  };

  const bulkDeleteSales = async () => {
    setDeleting(true);
    try {
      const result = await api<{ deleted: string[]; failed: Array<{ id: string; reason: string }>; warning?: string }>('/sales/bulk-delete', {
        method: 'POST',
        body: { ids: selectedIds },
      });
      toast({
        title: `${result.deleted.length} venda(s) excluída(s)`,
        description: result.failed.length
          ? `${result.failed.length} não puderam ser excluídas. ${result.warning ?? ''}`.trim()
          : result.warning,
        variant: result.failed.length ? 'default' : 'success',
      });
      setSelectedIds(result.failed.map((item) => item.id));
      setBulkDeleteOpen(false);
      await load();
    } catch (error) {
      toast({ title: 'Não foi possível excluir as vendas', description: error instanceof Error ? error.message : 'Falha', variant: 'destructive' });
    } finally { setDeleting(false); }
  };

  const workflowLabel = (sale: Sale) => {
    const taskName = saleTaskUserName(sale);
    if (sale.reviewStatus === SaleReviewStatus.APPROVED) {
      if (sale.contractStage === SaleContractStage.COMPLETED && !sale.taskDemandId) {
        return 'Concluída no Luxus Parceiros';
      }
      return saleContractStageLabel(sale.contractStage, taskName);
    }
    return SALE_REVIEW_STATUS_LABELS[sale.reviewStatus] ?? sale.reviewStatus;
  };

  const statusBadge = (status: SaleStatus) => {
    if ([SaleStatus.APPROVED, SaleStatus.ACTIVATED].includes(status)) return 'success';
    if ([SaleStatus.REJECTED, SaleStatus.CANCELLED].includes(status)) return 'destructive';
    return 'outline';
  };

  return (
    <DashboardLayout title="Vendas" description={isPartner ? 'Suas vendas registradas' : 'Listagem e gestão de vendas'}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-1 sm:flex-row">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Protocolo, cliente..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.values(SaleStatus).map((s) => (
                <SelectItem key={s} value={s}>{SALE_STATUS_LABELS[s] ?? s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={syncErrorOnly ? 'destructive' : 'outline'}
            onClick={() => { setSyncErrorOnly((current) => !current); setPage(1); }}
          >
            {syncErrorOnly ? 'Só com erro de sync' : 'Erros de sync'}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isPartner && canDeleteSales && selectedIds.length > 0 && (
            <Button variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir selecionadas ({selectedIds.length})
            </Button>
          )}
          <CreateSaleButton onSuccess={load} />
          {!isPartner && (
            <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Exportar</Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Nenhuma venda"
          description={isPartner ? 'Registre sua primeira venda com o botão acima.' : 'As vendas aparecerão aqui.'}
        />
      ) : (
        <>
          <ResponsiveDataView
            table={
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isPartner && canDeleteSales && <TableHead className="w-10">
                      <Checkbox
                        aria-label="Selecionar vendas desta página"
                        checked={items.length > 0 && items.every((item) => selectedIds.includes(item.id))}
                        onCheckedChange={(checked) => setSelectedIds(checked
                          ? Array.from(new Set([...selectedIds, ...items.map((item) => item.id)]))
                          : selectedIds.filter((id) => !items.some((item) => item.id === id)))}
                      />
                    </TableHead>}
                    <TableHead>Protocolo</TableHead>
                    {!isPartner && <TableHead>Parceiro</TableHead>}
                    <TableHead>Loja</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Plano</TableHead>
                    {!isPartner && <TableHead>Campanha</TableHead>}
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(s.id)}
                    >
                      {!isPartner && canDeleteSales && <TableCell onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          aria-label={`Selecionar ${s.protocol}`}
                          checked={selectedIds.includes(s.id)}
                          onCheckedChange={(checked) => setSelectedIds(checked
                            ? [...selectedIds, s.id]
                            : selectedIds.filter((id) => id !== s.id))}
                        />
                      </TableCell>}
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <span>{s.protocol}</span>
                          {hasUnreadTaskMessage(s.id, notifications) && <TaskMessageBadge onClick={() => setMessageSale(s)} />}
                        </div>
                      </TableCell>
                      {!isPartner && <TableCell>{s.partner?.name || '-'}</TableCell>}
                      <TableCell>{s.branch?.name || 'Matriz'}</TableCell>
                      <TableCell>{s.client?.name || '-'}</TableCell>
                      <TableCell>{s.plan?.name || '-'}</TableCell>
                      {!isPartner && <TableCell>{s.campaign?.title || '-'}</TableCell>}
                      <TableCell>{formatCurrency(Number(s.value))}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={s.reviewStatus === SaleReviewStatus.APPROVED ? 'success' : s.reviewStatus === SaleReviewStatus.CHANGES_REQUESTED ? 'destructive' : 'outline'}>
                            {workflowLabel(s)}
                          </Badge>
                          {(s.taskSyncError || s.taskSyncStatus === 'RETRY') && (
                            <span className="text-xs font-medium text-red-600">Sync com falha — reenvie no detalhe</span>
                          )}
                          {s.taskIsBeingEdited && <span className="text-xs font-medium text-green-600">Em atendimento por {s.taskEditorName || 'responsável do Task'}</span>}
                          {s.reviewStatus === SaleReviewStatus.APPROVED && s.taskProtocol && <span className="text-xs text-muted-foreground">{s.taskProtocol}</span>}
                          {isPartner && s.status === SaleStatus.DOCUMENTS_PENDING && s.requiredDocuments?.length ? (
                            <span className="text-xs text-amber-600">
                              {s.requiredDocuments.filter((d) => !d.fulfilled).length} doc(s) pendente(s)
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(s.createdAt)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {isPartner ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openDetail(s.id)}>
                              <Eye className="mr-2 h-4 w-4" /> Ver
                            </Button>
                            {hasTaskMessage(s) && (
                              <Button size="sm" variant="outline" onClick={() => setMessageSale(s)}>
                                <MessageSquare className="mr-2 h-4 w-4" /> Ver mensagem
                              </Button>
                            )}
                            {canEdit(s) && (
                              <Button size="sm" variant="outline" onClick={() => setEditSaleId(s.id)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </Button>
                            )}
                            {s.status === SaleStatus.DOCUMENTS_PENDING && (
                              <Button size="sm" variant="outline" onClick={() => setResubmitSaleId(s.id)}>
                                <Upload className="mr-2 h-4 w-4" /> Enviar docs
                              </Button>
                            )}
                          </div>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetail(s.id)}>
                                <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openDetail(s.id, 'photos')}>
                                <ImageIcon className="mr-2 h-4 w-4" /> Documentos
                              </DropdownMenuItem>
                              {hasTaskMessage(s) && (
                                <DropdownMenuItem onClick={() => setMessageSale(s)}>
                                  <MessageSquare className="mr-2 h-4 w-4" /> Ver mensagem
                                </DropdownMenuItem>
                              )}
                              {canEdit(s) && (
                                <DropdownMenuItem onClick={() => setEditSaleId(s.id)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Editar venda
                                </DropdownMenuItem>
                              )}
                              {canReview(s) && (
                                <DropdownMenuItem onClick={() => handleApprove(s)}>
                                  <Check className="mr-2 h-4 w-4 text-green-600" /> Aprovar
                                </DropdownMenuItem>
                              )}
                              {canReview(s) && (
                                <DropdownMenuItem onClick={() => openAction(s, 'reject')}>
                                  <X className="mr-2 h-4 w-4 text-red-600" /> Solicitar correção
                                </DropdownMenuItem>
                              )}
                              {[SaleStatus.IN_ANALYSIS, SaleStatus.PENDING, SaleStatus.CONTESTED].includes(s.status) && (
                                <DropdownMenuItem onClick={() => openAction(s, 'documents')}>
                                  <FileText className="mr-2 h-4 w-4" /> Solicitar documentos
                                </DropdownMenuItem>
                              )}
                              {canDelete(s) && (
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(s)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Excluir venda
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            }
            mobile={items.map((s) => (
              <MobileListCard
                key={s.id}
                title={s.client?.name || s.protocol}
                subtitle={`${s.protocol} · ${s.branch?.name || 'Matriz'} · ${s.plan?.name || 'Sem plano'}`}
                meta={`${formatCurrency(Number(s.value))} · ${formatDate(s.createdAt)}`}
                badges={
                  <>
                    <Badge variant={s.reviewStatus === SaleReviewStatus.APPROVED ? 'success' : s.reviewStatus === SaleReviewStatus.CHANGES_REQUESTED ? 'destructive' : 'outline'}>{workflowLabel(s)}</Badge>
                    {(s.taskSyncError || s.taskSyncStatus === 'RETRY') && (
                      <Badge variant="destructive">Sync com falha</Badge>
                    )}
                    {hasUnreadTaskMessage(s.id, notifications) && (
                      <Badge variant="warning" className="cursor-pointer" onClick={() => setMessageSale(s)}>
                        Mensagem do Task
                      </Badge>
                    )}
                    {!isPartner && s.partner?.name ? (
                      <Badge variant="outline">{s.partner.name}</Badge>
                    ) : null}
                    <Badge variant="outline">{s.branch?.name || 'Matriz'}</Badge>
                  </>
                }
                onClick={() => openDetail(s.id)}
                actions={
                  isPartner ? (
                    <div className="flex flex-col gap-1">
                      {hasTaskMessage(s) && (
                        <Button size="sm" variant="outline" onClick={() => setMessageSale(s)}>
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      )}
                      {s.status === SaleStatus.DOCUMENTS_PENDING && (
                        <Button size="sm" variant="outline" onClick={() => setResubmitSaleId(s.id)}>
                          <Upload className="h-4 w-4" />
                        </Button>
                      )}
                      {canEdit(s) && (
                        <Button size="sm" variant="outline" onClick={() => setEditSaleId(s.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDetail(s.id)}>
                          <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDetail(s.id, 'photos')}>
                          <ImageIcon className="mr-2 h-4 w-4" /> Documentos
                        </DropdownMenuItem>
                        {hasTaskMessage(s) && (
                          <DropdownMenuItem onClick={() => setMessageSale(s)}>
                            <MessageSquare className="mr-2 h-4 w-4" /> Ver mensagem
                          </DropdownMenuItem>
                        )}
                        {canEdit(s) && (
                          <DropdownMenuItem onClick={() => setEditSaleId(s.id)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar venda
                          </DropdownMenuItem>
                        )}
                        {canReview(s) && (
                          <DropdownMenuItem onClick={() => handleApprove(s)}>
                            <Check className="mr-2 h-4 w-4 text-green-600" /> Aprovar
                          </DropdownMenuItem>
                        )}
                        {canReview(s) && (
                          <DropdownMenuItem onClick={() => openAction(s, 'reject')}>
                            <X className="mr-2 h-4 w-4 text-red-600" /> Solicitar correção
                          </DropdownMenuItem>
                        )}
                        {[SaleStatus.IN_ANALYSIS, SaleStatus.PENDING, SaleStatus.CONTESTED].includes(s.status) && (
                          <DropdownMenuItem onClick={() => openAction(s, 'documents')}>
                            <FileText className="mr-2 h-4 w-4" /> Solicitar documentos
                          </DropdownMenuItem>
                        )}
                        {canDelete(s) && (
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTarget(s)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir venda
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                }
              />
            ))}
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={actionDialog === 'reject'} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar correção da venda</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>O que o parceiro precisa corrigir *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explique de forma objetiva..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancelar</Button>
            <Button onClick={handleAction} variant="destructive">
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

      <ResubmitSaleDocumentsDialog
        saleId={resubmitSaleId}
        open={!!resubmitSaleId}
        onOpenChange={(open) => { if (!open) setResubmitSaleId(null); }}
        onSuccess={load}
      />

      <SaleDetailDialog
        saleId={detailSaleId}
        open={!!detailSaleId}
        initialTab={detailTab}
        onOpenChange={(open) => { if (!open) setDetailSaleId(null); }}
        onEdit={(saleId) => {
          setDetailSaleId(null);
          setEditSaleId(saleId);
        }}
        onResubmitDocuments={(saleId) => {
          setDetailSaleId(null);
          setResubmitSaleId(saleId);
        }}
      />

      <Dialog open={!!messageSale} onOpenChange={(open) => { if (!open) setMessageSale(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mensagem do Luxus Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-xs text-muted-foreground">{messageSale?.protocol}</p>
            <p className="whitespace-pre-wrap text-sm">{messageSale?.contractCorrectionReason}</p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {messageSale && hasUnreadTaskMessage(messageSale.id, notifications) && (
              <Button
                variant="secondary"
                onClick={() => void markSaleRemindersRead(messageSale.id)}
              >
                Marcar como lida
              </Button>
            )}
            <Button variant="outline" onClick={() => setMessageSale(null)}>Fechar</Button>
            {messageSale && (
              <Button
                onClick={() => {
                  const id = messageSale.id;
                  setMessageSale(null);
                  openDetail(id);
                }}
              >
                Abrir venda
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditSaleDialog
        saleId={editSaleId}
        open={!!editSaleId}
        onOpenChange={(open) => { if (!open) setEditSaleId(null); }}
        onSuccess={load}
      />

      <ApproveSaleForTaskDialog
        saleId={approveSaleId}
        open={!!approveSaleId}
        onOpenChange={(open) => { if (!open) setApproveSaleId(null); }}
        onSuccess={load}
      />

      <DeleteConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        itemType="venda"
        itemLabel={deleteTarget ? `${deleteTarget.protocol} — ${deleteTarget.client?.name ?? 'cliente'}` : ''}
        description="A venda, seus documentos e seu histórico serão removidos. Vendas ativadas ou enviadas ao Luxus Task não podem ser excluídas."
        deleting={deleting}
        onConfirm={() => void deleteSale()}
      />
      <DeleteConfirmationDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        itemType="vendas selecionadas"
        itemLabel={`${selectedIds.length} registro(s)`}
        description="As vendas selecionadas, seus documentos e históricos serão removidos. Demandas já criadas no Luxus Task serão preservadas para auditoria. Comissões pagas não serão apagadas."
        deleting={deleting}
        onConfirm={() => void bulkDeleteSales()}
      />
    </DashboardLayout>
  );
}
