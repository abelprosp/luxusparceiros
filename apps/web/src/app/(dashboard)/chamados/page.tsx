'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import {
  TicketStatus,
  TicketPriority,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
} from '@luxus/types';
import { formatDateTime } from '@luxus/utils';
import { api, getPaginated } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/toaster';
import { useAuth } from '@/hooks/useAuth';
import { isPartnerUser } from '@/lib/rbac';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TICKET_CATEGORY_LABELS } from '@luxus/types';
import { CreateTicketDialog } from '@/components/tickets/create-ticket-dialog';
import { TicketDetailDialog } from '@/components/tickets/ticket-detail-dialog';
import { cn } from '@/lib/utils';

interface Ticket {
  id: string;
  protocol: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  partner?: { name: string };
  createdAt: string;
}

const columns: { status: TicketStatus; label: string; color: string }[] = [
  { status: TicketStatus.NEW, label: TICKET_STATUS_LABELS[TicketStatus.NEW], color: 'border-t-primary' },
  { status: TicketStatus.IN_PROGRESS, label: TICKET_STATUS_LABELS[TicketStatus.IN_PROGRESS], color: 'border-t-blue-400' },
  { status: TicketStatus.PENDING, label: TICKET_STATUS_LABELS[TicketStatus.PENDING], color: 'border-t-amber-400' },
  { status: TicketStatus.RESOLVED, label: TICKET_STATUS_LABELS[TicketStatus.RESOLVED], color: 'border-t-green-500' },
  { status: TicketStatus.CANCELLED, label: TICKET_STATUS_LABELS[TicketStatus.CANCELLED], color: 'border-t-red-400' },
];

const priorityVariant = (p: TicketPriority) => {
  if (p === TicketPriority.URGENT) return 'destructive' as const;
  if (p === TicketPriority.HIGH) return 'warning' as const;
  return 'secondary' as const;
};

export default function ChamadosPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPartner = isPartnerUser(user);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaginated<Ticket>('/tickets', { limit: 100 });
      setTickets(res.data);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const moveTicket = async (id: string, status: TicketStatus) => {
    try {
      await api(`/tickets/${id}/status`, { method: 'PATCH', body: { status } });
      load();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha ao mover', variant: 'destructive' });
    }
  };

  const openDetail = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  return (
    <DashboardLayout title="Chamados" description={isPartner ? 'Seus chamados de suporte' : 'Quadro Kanban de atendimento'}>
      <div className="mb-6 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Chamado
        </Button>
      </div>

      {loading ? (
        isPartner ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : (
          <div className="grid grid-cols-5 gap-4">
            {columns.map((col) => (
              <Skeleton key={col.status} className="h-96 rounded-xl" />
            ))}
          </div>
        )
      ) : tickets.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Nenhum chamado" description="Os chamados aparecerão aqui." />
      ) : isPartner ? (
        <div className="rounded-xl border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetail(ticket.id)}
                >
                  <TableCell className="font-mono text-sm">{ticket.protocol}</TableCell>
                  <TableCell className="font-medium">{ticket.subject}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {TICKET_CATEGORY_LABELS[ticket.category as keyof typeof TICKET_CATEGORY_LABELS] ?? ticket.category}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge>{TICKET_STATUS_LABELS[ticket.status]}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={priorityVariant(ticket.priority)}>
                      {TICKET_PRIORITY_LABELS[ticket.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(ticket.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colTickets = tickets.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="min-w-[280px] flex-1">
                <Card className={cn('border-t-4', col.color)}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      {col.label}
                      <Badge variant="secondary">{colTickets.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className="h-[calc(100vh-280px)]">
                      <div className="space-y-2 p-1">
                        {colTickets.map((ticket) => (
                          <Card
                            key={ticket.id}
                            className="cursor-pointer shadow-sm transition-shadow hover:shadow-card"
                            onClick={() => openDetail(ticket.id)}
                          >
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs text-muted-foreground">{ticket.protocol}</span>
                                <Badge variant={priorityVariant(ticket.priority)} className="text-[10px]">
                                  {TICKET_PRIORITY_LABELS[ticket.priority]}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium leading-tight">{ticket.subject}</p>
                              {ticket.partner && (
                                <p className="text-xs text-muted-foreground">{ticket.partner.name}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground">{formatDateTime(ticket.createdAt)}</p>
                              <div className="flex gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                                {columns
                                  .filter((c) => c.status !== ticket.status)
                                  .slice(0, 2)
                                  .map((c) => (
                                    <Button
                                      key={c.status}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-[10px] px-2"
                                      onClick={() => moveTicket(ticket.id, c.status)}
                                    >
                                      → {c.label}
                                    </Button>
                                  ))}
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
      )}

      <CreateTicketDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={load} />
      <TicketDetailDialog
        ticketId={selectedId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={load}
      />
    </DashboardLayout>
  );
}
