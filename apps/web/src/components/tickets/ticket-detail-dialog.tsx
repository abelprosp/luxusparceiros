'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  TicketStatus,
  TicketPriority,
  TICKET_STATUS_LABELS,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  UserRole,
} from '@luxus/types';
import { formatDateTime } from '@luxus/utils';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TicketMessage {
  id: string;
  content: string;
  createdAt: string;
  isInternal?: boolean;
  user?: { id: string; name: string };
}

interface TicketDetail {
  id: string;
  protocol: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  partner?: { name: string };
  createdAt: string;
  messages: TicketMessage[];
}

interface TicketDetailDialogProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function TicketDetailDialog({ ticketId, open, onOpenChange, onUpdated }: TicketDetailDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR;
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [message, setMessage] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const data = await api<TicketDetail>(`/tickets/${ticketId}`);
      setTicket(data);
      setStatus(data.status);
    } catch {
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (open && ticketId) load();
    if (!open) {
      setMessage('');
      setTicket(null);
      setInternalNote(false);
    }
  }, [open, ticketId, load]);

  const handleMessage = async () => {
    if (!ticketId || !message.trim()) return;
    setSending(true);
    try {
      await api(`/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: { content: message.trim(), isInternal: isAdmin && internalNote },
      });
      setMessage('');
      await load();
      onUpdated();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleStatus = async () => {
    if (!ticketId || !status) return;
    setSending(true);
    try {
      await api(`/tickets/${ticketId}/status`, { method: 'PATCH', body: { status } });
      toast({ title: 'Status atualizado', variant: 'success' });
      await load();
      onUpdated();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{ticket?.subject ?? 'Chamado'}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-6 w-32" /><Skeleton className="h-32" /></div>
        ) : ticket ? (
          <div className="flex flex-col gap-4 min-h-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{ticket.protocol}</span>
              <Badge>{TICKET_STATUS_LABELS[ticket.status]}</Badge>
              <Badge variant="outline">{TICKET_CATEGORY_LABELS[ticket.category as keyof typeof TICKET_CATEGORY_LABELS] ?? ticket.category}</Badge>
              <Badge variant="secondary">{TICKET_PRIORITY_LABELS[ticket.priority]}</Badge>
            </div>
            {ticket.partner && <p className="text-xs text-muted-foreground">Parceiro: {ticket.partner.name}</p>}
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Status</Label>
              <div className="flex gap-2">
                <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TicketStatus).map((s) => (
                      <SelectItem key={s} value={s}>{TICKET_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleStatus} disabled={sending}>Salvar</Button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <Label className="mb-2 block">Mensagens</Label>
              <ScrollArea className="h-48 rounded-lg border p-3">
                <div className="space-y-3">
                  {ticket.messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma mensagem</p>
                  ) : (
                    ticket.messages.map((m) => {
                      const isOwn = m.user?.id === user?.id;
                      return (
                        <div
                          key={m.id}
                          className={cn(
                            'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                            isOwn ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted',
                          )}
                        >
                          {!isOwn && m.user && <p className="text-xs font-medium mb-1">{m.user.name}</p>}
                          <p>{m.content}</p>
                          <p className={cn('text-[10px] mt-1', isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                            {formatDateTime(m.createdAt)}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
            <div className="space-y-2">
              <Textarea
                placeholder="Sua mensagem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
              />
              {isAdmin && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={internalNote} onChange={(e) => setInternalNote(e.target.checked)} />
                  Nota interna (não visível ao parceiro)
                </label>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chamado não encontrado.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handleMessage} disabled={sending || !message.trim()}>Enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
