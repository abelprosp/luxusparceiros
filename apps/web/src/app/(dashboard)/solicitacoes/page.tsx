'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Download,
  FileText,
  GripVertical,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  RequestStatus,
  RequestType,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
} from '@luxus/types';
import { formatDate } from '@luxus/utils';
import { api, getPaginated, API_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreateRequestDialog } from '@/components/requests/create-request-dialog';
import { RequestDetailDialog } from '@/components/requests/request-detail-dialog';
import { useToast } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/useAuth';
import { isPartnerUser } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { requestStatusBadge } from '@/lib/status-badge';

interface Request {
  id: string;
  protocol: string;
  type: RequestType;
  status: RequestStatus;
  description: string;
  partner?: { name: string };
  client?: { name: string };
  createdAt: string;
}

type ViewMode = 'kanban' | 'list';
type KanbanResponse = Record<RequestStatus, Request[]>;

const columns: { status: RequestStatus; color: string }[] = [
  { status: RequestStatus.OPEN, color: 'border-t-primary' },
  { status: RequestStatus.IN_ANALYSIS, color: 'border-t-blue-400' },
  { status: RequestStatus.IN_PROGRESS, color: 'border-t-amber-400' },
  { status: RequestStatus.COMPLETED, color: 'border-t-green-500' },
  { status: RequestStatus.REJECTED, color: 'border-t-red-400' },
];

export default function SolicitacoesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPartner = isPartnerUser(user);
  const [items, setItems] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<RequestStatus | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const didDragRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
      };
      if (viewMode === 'kanban') {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });
        const data = await api<KanbanResponse>(
          `/requests/kanban${params.size ? `?${params.toString()}` : ''}`,
        );
        setItems(Object.values(data).flat());
        setTotalPages(1);
      } else {
        const res = await getPaginated<Request>('/requests', {
          ...filters,
          page,
          limit: 15,
        });
        setItems(res.data);
        setTotalPages(res.meta.totalPages);
      }
    } catch (err) {
      setItems([]);
      toast({
        title: 'Erro ao carregar solicitações',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, viewMode, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setPage(1);
  };

  const hasActiveFilters = search.trim() || statusFilter !== 'all' || typeFilter !== 'all';

  const moveRequest = async (id: string, status: RequestStatus) => {
    const request = items.find((item) => item.id === id);
    if (!request || request.status === status) return;

    const previous = items;
    setMovingId(id);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    try {
      await api(`/requests/${id}/status`, { method: 'PATCH', body: { status } });
      if (statusFilter !== 'all' && statusFilter !== status) {
        setItems((current) => current.filter((item) => item.id !== id));
      }
    } catch (err) {
      setItems(previous);
      toast({
        title: 'Erro ao mover solicitação',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setMovingId(null);
    }
  };

  const handleDragStart = (event: React.DragEvent, requestId: string) => {
    didDragRef.current = true;
    event.dataTransfer.setData('text/request-id', requestId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(requestId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverColumn(null);
    setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  };

  const handleDrop = (event: React.DragEvent, status: RequestStatus) => {
    event.preventDefault();
    const requestId = event.dataTransfer.getData('text/request-id');
    setDraggingId(null);
    setDragOverColumn(null);
    if (requestId) void moveRequest(requestId, status);
  };

  const handleExport = async () => {
    try {
      const token = getAccessToken();
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const qs = params.toString();
      const response = await fetch(
        `${API_URL}/requests/export/csv${qs ? `?${qs}` : ''}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!response.ok) throw new Error('Falha ao exportar');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'solicitacoes.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao exportar', variant: 'destructive' });
    }
  };

  const openDetail = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  return (
    <DashboardLayout title="Solicitações" description={isPartner ? 'Suas solicitações' : 'Gestão de solicitações dos parceiros'}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Protocolo, descrição..."
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.values(RequestStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {REQUEST_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.values(RequestType).map((type) => (
                <SelectItem key={type} value={type}>
                  {REQUEST_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border p-1">
            <Button
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setViewMode('kanban');
                setPage(1);
              }}
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setViewMode('list');
                setPage(1);
              }}
            >
              <List className="mr-2 h-4 w-4" />
              Lista
            </Button>
          </div>
          {!isPartner && (
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova solicitação
          </Button>
        </div>
      </div>

      {loading ? (
        <div className={viewMode === 'kanban' ? 'flex gap-4 overflow-hidden' : 'space-y-3'}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton
              key={index}
              className={viewMode === 'kanban' ? 'h-96 min-w-[280px] flex-1' : 'h-14'}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma solicitação"
          description={
            hasActiveFilters
              ? 'Nenhuma solicitação corresponde aos filtros selecionados.'
              : 'As solicitações aparecerão aqui.'
          }
        />
      ) : viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => {
            const columnItems = items.filter((item) => item.status === column.status);
            const isDropTarget = dragOverColumn === column.status;
            return (
              <div
                key={column.status}
                className="min-w-[260px] flex-1 sm:min-w-[280px]"
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDragOverColumn(column.status);
                }}
                onDragEnter={() => setDragOverColumn(column.status)}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    setDragOverColumn((current) =>
                      current === column.status ? null : current,
                    );
                  }
                }}
                onDrop={(event) => handleDrop(event, column.status)}
              >
                <Card
                  className={cn(
                    'border-t-4 transition-all',
                    column.color,
                    isDropTarget && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  )}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      {REQUEST_STATUS_LABELS[column.status]}
                      <Badge variant="secondary">{columnItems.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea
                      className={cn(
                        'h-[calc(100vh-330px)] min-h-[320px] rounded-md',
                        isDropTarget && 'bg-primary/5',
                      )}
                    >
                      <div className="min-h-[120px] space-y-2 p-1">
                        {columnItems.length === 0 && (
                          <p className="py-8 text-center text-xs text-muted-foreground">
                            {isDropTarget ? 'Solte aqui' : 'Nenhuma solicitação'}
                          </p>
                        )}
                        {columnItems.map((request) => (
                          <Card
                            key={request.id}
                            draggable
                            onDragStart={(event) => handleDragStart(event, request.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => {
                              if (!didDragRef.current) openDetail(request.id);
                            }}
                            className={cn(
                              'cursor-grab shadow-sm transition-all active:cursor-grabbing hover:shadow-card',
                              draggingId === request.id && 'opacity-50',
                              movingId === request.id && 'pointer-events-none opacity-70',
                            )}
                          >
                            <CardContent className="space-y-2 p-3">
                              <div className="flex items-start gap-2">
                                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                                <div className="min-w-0 flex-1 space-y-2">
                                  <span className="block truncate font-mono text-xs text-muted-foreground">
                                    {request.protocol}
                                  </span>
                                  <Badge variant="outline" className="max-w-full">
                                    {REQUEST_TYPE_LABELS[request.type]}
                                  </Badge>
                                  <p className="line-clamp-3 text-sm leading-snug">
                                    {request.description}
                                  </p>
                                  {!isPartner && request.partner && (
                                    <p className="truncate text-xs text-muted-foreground">
                                      {request.partner.name}
                                    </p>
                                  )}
                                  {request.client && (
                                    <p className="truncate text-xs text-muted-foreground">
                                      Cliente: {request.client.name}
                                    </p>
                                  )}
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatDate(request.createdAt)}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Tipo</TableHead>
                  {!isPartner && <TableHead>Parceiro</TableHead>}
                  <TableHead>Cliente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetail(r.id)}
                  >
                    <TableCell className="font-mono text-sm">{r.protocol}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{REQUEST_TYPE_LABELS[r.type]}</Badge>
                    </TableCell>
                    {!isPartner && <TableCell>{r.partner?.name || '-'}</TableCell>}
                    <TableCell>{r.client?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={requestStatusBadge(r.status)}>
                        {REQUEST_STATUS_LABELS[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(r.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                className="text-sm text-primary disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </button>
              <button
                className="text-sm text-primary disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}

      <CreateRequestDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={load} />
      <RequestDetailDialog
        requestId={selectedId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={load}
      />
    </DashboardLayout>
  );
}
