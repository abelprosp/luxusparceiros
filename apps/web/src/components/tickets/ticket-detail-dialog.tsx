'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  TicketStatus,
  TicketPriority,
  TICKET_STATUS_LABELS,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  UserRole,
  PERMISSIONS,
} from '@luxus/types';
import { formatDateTime } from '@luxus/utils';
import { api, openAuthenticatedFile, uploadFile } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, isPartnerScopedUser } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FileText, Paperclip, Pencil, Trash2 } from 'lucide-react';
import { ActivityLog, type ActivityEntry } from '@/components/ActivityLog';
import { ticketStatusBadge } from '@/lib/status-badge';

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
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  partner?: { name: string };
  createdAt: string;
  slaDeadline?: string;
  assignedTo?: { id: string; name: string };
  documents: Array<{ id: string; name: string; url: string; mimeType: string }>;
  messages: TicketMessage[];
  timeline: ActivityEntry[];
}

interface TicketDetailDialogProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onEdit?: (ticketId: string) => void;
  onDelete?: (ticket: { id: string; protocol: string; subject: string }) => void;
}

export function TicketDetailDialog({ ticketId, open, onOpenChange, onUpdated, onEdit, onDelete }: TicketDetailDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR;
  const canWrite = hasPermission(user, PERMISSIONS.TICKETS_WRITE);
  const isPartner = isPartnerScopedUser(user);
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [message, setMessage] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      if (isAdmin) {
        await api(`/tickets/${ticketId}/acknowledge`, { method: 'PATCH' });
      }
      const data = await api<TicketDetail>(`/tickets/${ticketId}`);
      setTicket(data);
      setStatus(data.status);
    } catch {
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId, isAdmin]);

  useEffect(() => {
    if (open && ticketId) load();
    if (!open) {
      setMessage('');
      setTicket(null);
      setInternalNote(false);
    }
  }, [open, ticketId, load]);

  const statusChanged = Boolean(
    isAdmin && ticket && status && status !== ticket.status,
  );

  const handleSubmit = async () => {
    if (!canWrite || !ticketId || !ticket || (!message.trim() && !statusChanged)) return;
    setSending(true);
    try {
      await api(`/tickets/${ticketId}/respond`, {
        method: 'POST',
        body: {
          status: statusChanged ? status : undefined,
          content: message.trim() || undefined,
          isInternal: isAdmin && internalNote,
        },
      });
      setMessage('');
      toast({
        title: message.trim() && statusChanged
          ? 'Status e mensagem enviados'
          : message.trim()
            ? 'Mensagem enviada'
            : 'Status atualizado',
        variant: 'success',
      });
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

  const handleAttachment = async () => {
    if (!ticketId || !attachment) return;
    setSending(true);
    try {
      await uploadFile(attachment, 'OTHER', { ticketId });
      setAttachment(null);
      toast({ title: 'Anexo enviado', variant: 'success' });
      await load();
    } catch (err) {
      toast({
        title: 'Erro no anexo',
        description: err instanceof Error ? err.message : 'Falha',
        variant: 'destructive',
      });
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
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{ticket.protocol}</span>
              <Badge variant={ticketStatusBadge(ticket.status)}>
                {TICKET_STATUS_LABELS[ticket.status]}
              </Badge>
              <Badge variant="outline">{TICKET_CATEGORY_LABELS[ticket.category as keyof typeof TICKET_CATEGORY_LABELS] ?? ticket.category}</Badge>
              <Badge variant="secondary">{TICKET_PRIORITY_LABELS[ticket.priority]}</Badge>
            </div>
            {ticket.partner && !isPartner && <p className="text-xs text-muted-foreground">Parceiro: {ticket.partner.name}</p>}
            {ticket.description && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {ticket.description}
              </div>
            )}
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <span>Responsável: {ticket.assignedTo?.name ?? 'Não atribuído'}</span>
              <span className={cn(
                ticket.slaDeadline
                && new Date(ticket.slaDeadline) < new Date()
                && ![TicketStatus.RESOLVED, TicketStatus.CANCELLED].includes(ticket.status)
                  ? 'font-medium text-destructive'
                  : '',
              )}>
                Prazo: {ticket.slaDeadline ? formatDateTime(ticket.slaDeadline) : 'Não informado'}
              </span>
            </div>
            {isAdmin && (
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
            )}
            <ActivityLog entries={ticket.timeline} />
            <div className="space-y-2">
              <Label>Anexos</Label>
              {ticket.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
              ) : (
                ticket.documents.map((document) => (
                  <Button
                    key={document.id}
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => void openAuthenticatedFile(document.url, document.name)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    <span className="truncate">{document.name}</span>
                  </Button>
                ))
              )}
              {canWrite && (
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                    disabled={sending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Anexar arquivo"
                    disabled={!attachment || sending}
                    onClick={handleAttachment}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="shrink-0">
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
            {canWrite && (
            <div className="relative z-10 shrink-0 space-y-2 rounded-lg border border-primary/30 bg-background p-3 shadow-sm">
              <Label htmlFor="ticket-message">
                {isPartner ? 'Mensagem para o administrador' : 'Mensagem para o parceiro'}
              </Label>
              <Textarea
                id="ticket-message"
                placeholder="Sua mensagem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                disabled={sending}
                className="pointer-events-auto bg-background"
              />
              {isAdmin && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={internalNote} onChange={(e) => setInternalNote(e.target.checked)} />
                  Nota interna (não visível ao parceiro)
                </label>
              )}
              {isAdmin && (
                <p className="text-xs text-muted-foreground">
                  Ao enviar, a alteração de status também será salva.
                </p>
              )}
            </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chamado não encontrado.</p>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            <div className="flex gap-2">
              {ticket && onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(ticket.id)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
              )}
              {ticket && isAdmin && onDelete && (
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(ticket)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            {canWrite && (
            <Button
              onClick={handleSubmit}
              disabled={sending || (!message.trim() && !statusChanged)}
            >
              {isAdmin ? 'Salvar e enviar' : 'Enviar mensagem'}
            </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
