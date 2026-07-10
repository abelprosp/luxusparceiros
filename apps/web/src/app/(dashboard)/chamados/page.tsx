'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, MessageSquare, Pencil, Plus } from 'lucide-react';
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
import { EditTicketDialog } from '@/components/tickets/edit-ticket-dialog';
import { TicketDetailDialog } from '@/components/tickets/ticket-detail-dialog';
import { cn } from '@/lib/utils';
import { MobileListCard, ResponsiveDataView } from '@/components/ui/mobile-list-card';
import { ticketStatusBadge } from '@/lib/status-badge';

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
  { status: TicketStatus.IN_PROGRESS, label: TICKET_STATUS_LABELS[TicketStatus.IN_PROGRESS], color: 'border-t-amber-400' },
  { status: TicketStatus.PENDING, label: TICKET_STATUS_LABELS[TicketStatus.PENDING], color: 'border-t-blue-400' },
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
  const [editId, setEditId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TicketStatus | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const didDragRef = useRef(false);

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
    const ticket = tickets.find((t) => t.id === id);
    if (!ticket || ticket.status === status) return;

    const previous = tickets;
    setMovingId(id);
    setTickets((current) =>
      current.map((t) => (t.id === id ? { ...t, status } : t)),
    );

    try {
      await api(`/tickets/${id}/status`, { method: 'PATCH', body: { status } });
    } catch (err) {
      setTickets(previous);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Falha ao mover',
        variant: 'destructive',
      });
    } finally {
      setMovingId(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    didDragRef.current = true;
    e.dataTransfer.setData('text/ticket-id', ticketId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(ticketId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverColumn(null);
    setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent, status: TicketStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDrop = (e: React.DragEvent, status: TicketStatus) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('text/ticket-id');
    setDragOverColumn(null);
    setDraggingId(null);
    if (ticketId) void moveTicket(ticketId, status);
  };

  const openEdit = (id: string) => {
    setEditId(id);
    setEditOpen(true);
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {columns.map((col) => (
              <Skeleton key={col.status} className="h-96 rounded-xl" />
            ))}
          </div>
        )
      ) : tickets.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Nenhum chamado" description="Os chamados aparecerão aqui." />
      ) : isPartner ? (
        <ResponsiveDataView
          table={
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-12" />
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
                    <TableCell>
                      <Badge variant={ticketStatusBadge(ticket.status)}>
                        {TICKET_STATUS_LABELS[ticket.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant(ticket.priority)}>
                        {TICKET_PRIORITY_LABELS[ticket.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(ticket.createdAt)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(ticket.id);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
          mobile={tickets.map((ticket) => (
            <MobileListCard
              key={ticket.id}
              title={ticket.subject}
              subtitle={ticket.protocol}
              meta={formatDateTime(ticket.createdAt)}
              badges={
                <>
                  <Badge variant={ticketStatusBadge(ticket.status)}>
                    {TICKET_STATUS_LABELS[ticket.status]}
                  </Badge>
                  <Badge variant={priorityVariant(ticket.priority)}>
                    {TICKET_PRIORITY_LABELS[ticket.priority]}
                  </Badge>
                  <Badge variant="outline">
                    {TICKET_CATEGORY_LABELS[ticket.category as keyof typeof TICKET_CATEGORY_LABELS] ?? ticket.category}
                  </Badge>
                </>
              }
              onClick={() => openDetail(ticket.id)}
              actions={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(ticket.id)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />
          ))}
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const colTickets = tickets.filter((t) => t.status === col.status);
            const isDropTarget = dragOverColumn === col.status;
            return (
              <div
                key={col.status}
                className="min-w-[260px] flex-1 sm:min-w-[280px]"
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDragEnter={() => setDragOverColumn(col.status)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverColumn((current) => (current === col.status ? null : current));
                  }
                }}
                onDrop={(e) => handleDrop(e, col.status)}
              >
                <Card
                  className={cn(
                    'border-t-4 transition-all',
                    col.color,
                    isDropTarget && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  )}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-sm">
                      {col.label}
                      <Badge variant="secondary">{colTickets.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <ScrollArea className={cn('h-[calc(100vh-280px)] rounded-md', isDropTarget && 'bg-primary/5')}>
                      <div className="min-h-[120px] space-y-2 p-1">
                        {colTickets.length === 0 && isDropTarget && (
                          <p className="py-8 text-center text-xs text-muted-foreground">Solte aqui</p>
                        )}
                        {colTickets.map((ticket) => (
                          <Card
                            key={ticket.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, ticket.id)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              'cursor-grab shadow-sm transition-all active:cursor-grabbing hover:shadow-card',
                              draggingId === ticket.id && 'opacity-50',
                              movingId === ticket.id && 'pointer-events-none opacity-70',
                            )}
                            onClick={() => {
                              if (!didDragRef.current) openDetail(ticket.id);
                            }}
                          >
                            <CardContent className="space-y-2 p-3">
                              <div className="flex items-start gap-2">
                                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate font-mono text-xs text-muted-foreground">
                                      {ticket.protocol}
                                    </span>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEdit(ticket.id);
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Badge variant={priorityVariant(ticket.priority)} className="text-[10px]">
                                        {TICKET_PRIORITY_LABELS[ticket.priority]}
                                      </Badge>
                                    </div>
                                  </div>
                                  <p className="text-sm font-medium leading-tight">{ticket.subject}</p>
                                  {ticket.partner && (
                                    <p className="text-xs text-muted-foreground">{ticket.partner.name}</p>
                                  )}
                                  <p className="text-[10px] text-muted-foreground">
                                    {formatDateTime(ticket.createdAt)}
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
      )}

      <CreateTicketDialog open={createOpen} onOpenChange={setCreateOpen} onSuccess={load} />
      <TicketDetailDialog
        ticketId={selectedId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={load}
        onEdit={(id) => {
          setDetailOpen(false);
          openEdit(id);
        }}
      />
      <EditTicketDialog
        ticketId={editId}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={load}
      />
    </DashboardLayout>
  );
}
