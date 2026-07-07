'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, FileText, Plus, Download } from 'lucide-react';
import {
  RequestStatus,
  RequestType,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
} from '@luxus/types';
import { formatDate } from '@luxus/utils';
import { getPaginated } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { CreateRequestDialog } from '@/components/requests/create-request-dialog';
import { RequestDetailDialog } from '@/components/requests/request-detail-dialog';
import { useToast } from '@/components/ui/toaster';

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

export default function SolicitacoesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<Request>('/requests', {
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page,
        limit: 15,
      });
      setItems(res.data);
      setTotalPages(res.meta.totalPages);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async () => {
    try {
      const token = getAccessToken();
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const qs = params.toString();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/requests/export/csv${qs ? `?${qs}` : ''}`,
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
    <DashboardLayout title="Solicitações" description="Gestão de solicitações dos parceiros">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center flex-1">
          <div className="relative max-w-sm flex-1">
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
            <SelectTrigger className="w-44">
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
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova solicitação
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhuma solicitação" description="As solicitações aparecerão aqui." />
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Parceiro</TableHead>
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
                    <TableCell>{r.partner?.name || '-'}</TableCell>
                    <TableCell>{r.client?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{REQUEST_STATUS_LABELS[r.status]}</Badge>
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
