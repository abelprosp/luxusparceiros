'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, ClipboardList } from 'lucide-react';
import { formatDateTime } from '@luxus/utils';
import { getPaginated } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

interface AuditLog {
  id: string;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  user?: { name: string; email: string };
  ipAddress?: string;
  createdAt: string;
}

export default function AuditoriaPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<AuditLog>('/audit', { search: search || undefined, page, limit: 20 });
      setItems(res.data);
      setTotalPages(res.meta.totalPages);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout title="Auditoria" description="Logs de auditoria do sistema">
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar logs..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhum log" description="Os logs de auditoria aparecerão aqui." />
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell>{log.user?.name || 'Sistema'}</TableCell>
                    <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                    <TableCell>{log.module}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.entityType ? `${log.entityType}#${log.entityId?.slice(0, 8)}` : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.ipAddress || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button className="text-sm text-primary disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
              <button className="text-sm text-primary disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</button>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
