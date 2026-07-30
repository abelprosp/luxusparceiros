'use client';

import { useCallback, useEffect, useState } from 'react';
import { RequestStatus, REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS, UserRole } from '@luxus/types';
import { formatDateTime } from '@luxus/utils';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { isPartnerUser } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/toaster';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityLog, type ActivityEntry } from '@/components/ActivityLog';
import { requestStatusBadge } from '@/lib/status-badge';

interface RequestComment {
  id: string;
  content: string;
  createdAt: string;
  isInternal?: boolean;
  user?: { id: string; name: string };
}

interface RequestDetail {
  id: string;
  protocol: string;
  type: string;
  status: RequestStatus;
  description: string;
  resolution?: string;
  partner?: { name: string };
  client?: { name: string };
  createdAt: string;
  comments: RequestComment[];
  timeline: ActivityEntry[];
  taskDemandId?: string;
  taskProtocol?: string;
  taskStatus?: string;
  taskResponsibleName?: string;
  taskClientName?: string;
  taskDeadline?: string;
  taskSyncError?: string;
  taskLastSyncAt?: string;
}

interface RequestDetailDialogProps {
  requestId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

export function RequestDetailDialog({ requestId, open, onOpenChange, onUpdated }: RequestDetailDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR;
  const [loading, setLoading] = useState(false);
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<RequestStatus | ''>('');
  const [resolution, setResolution] = useState('');
  const [sending, setSending] = useState(false);
  const isPartner = isPartnerUser(user);

  const load = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const data = await api<RequestDetail>(`/requests/${requestId}`);
      setRequest(data);
      setStatus(data.status);
      setResolution(data.resolution ?? '');
    } catch {
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      onUpdated();
    }
  };

  useEffect(() => {
    if (open && requestId) load();
    if (!open) {
      setComment('');
      setRequest(null);
    }
  }, [open, requestId, load]);

  const statusChanged = Boolean(
    isAdmin
      && request
      && !request.taskDemandId
      && status
      && (
        status !== request.status
        || resolution.trim() !== (request.resolution ?? '').trim()
      ),
  );

  const handleSubmit = async () => {
    if (!requestId || !request || (!comment.trim() && !statusChanged)) return;
    setSending(true);
    try {
      if (statusChanged && status) {
        await api(`/requests/${requestId}/status`, {
          method: 'PATCH',
          body: { status, resolution: resolution.trim() || undefined },
        });
      }
      if (comment.trim()) {
        await api(`/requests/${requestId}/comments`, {
          method: 'POST',
          body: { content: comment.trim() },
        });
      }
      setComment('');
      toast({
        title: comment.trim() && statusChanged
          ? 'Status e comentário enviados'
          : comment.trim()
            ? 'Comentário enviado'
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
    if (!requestId || !status) return;
    setSending(true);
    try {
      await api(`/requests/${requestId}/status`, {
        method: 'PATCH',
        body: { status, resolution: resolution || undefined },
      });
      toast({ title: 'Status atualizado', variant: 'success' });
      await load();
      onUpdated();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const retrySync = async () => {
    if (!requestId) return;
    setSending(true);
    try {
      await api(`/requests/${requestId}/sync-task`, { method: 'POST' });
      toast({ title: 'Sincronização realizada', variant: 'success' });
      await load();
      onUpdated();
    } catch (err) {
      toast({
        title: 'Erro ao sincronizar',
        description: err instanceof Error ? err.message : 'Falha',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{request?.protocol ?? 'Solicitação'}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="space-y-3"><Skeleton className="h-6 w-32" /><Skeleton className="h-20" /><Skeleton className="h-32" /></div>
        ) : request ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant={requestStatusBadge(request.status)}>
                {REQUEST_STATUS_LABELS[request.status]}
              </Badge>
              <Badge variant="outline">{REQUEST_TYPE_LABELS[request.type as keyof typeof REQUEST_TYPE_LABELS] ?? request.type}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{request.description}</p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              {request.partner && <span>Parceiro: {request.partner.name}</span>}
              {request.client && <span>Cliente: {request.client.name}</span>}
            </div>
            {(request.taskProtocol || request.taskSyncError || request.taskClientName) && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">Integração Luxus Task</p>
                {!request.taskProtocol && !request.taskSyncError && (
                  <p className="text-primary">Sincronização em processamento...</p>
                )}
                {request.taskProtocol && <p>Protocolo: <strong>{request.taskProtocol}</strong></p>}
                {request.taskResponsibleName && <p>Responsável: {request.taskResponsibleName}</p>}
                {request.taskClientName && <p>Cliente: {request.taskClientName}</p>}
                {request.taskDeadline && (
                  <p>Prazo: {new Date(`${request.taskDeadline}T12:00:00`).toLocaleDateString('pt-BR')}</p>
                )}
                {request.taskStatus && <p>Status de origem: {request.taskStatus}</p>}
                {request.taskSyncError && (
                  <>
                    <p className="text-destructive">{request.taskSyncError}</p>
                    <Button size="sm" variant="outline" onClick={retrySync} disabled={sending}>
                      Tentar sincronizar novamente
                    </Button>
                  </>
                )}
              </div>
            )}
            {request.resolution && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium text-xs text-muted-foreground mb-1">Resolução</p>
                {request.resolution}
              </div>
            )}
            {isAdmin && !request.taskDemandId && (
              <div className="space-y-2 rounded-lg border p-3">
                <Label>Alterar status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as RequestStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(RequestStatus).map((s) => (
                      <SelectItem key={s} value={s}>{REQUEST_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Resolução (opcional)"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={2}
                />
                <Button size="sm" onClick={handleStatus} disabled={sending}>Salvar status</Button>
              </div>
            )}
            <ActivityLog entries={request.timeline} />
            <div className="shrink-0">
              <Label className="mb-2 block">Comentários</Label>
              <ScrollArea className="h-40 rounded-lg border p-3">
                <div className="space-y-3">
                  {request.comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentário</p>
                  ) : (
                    request.comments.map((c) => (
                      <div key={c.id} className="text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{c.user?.name ?? 'Usuário'}</span>
                          <span className="text-[10px] text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                        </div>
                        <p className="text-muted-foreground">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
            <div className="relative z-10 shrink-0 space-y-2 rounded-lg border border-primary/30 bg-background p-3 shadow-sm">
              <Label htmlFor="request-comment">
                {isPartner ? 'Mensagem para o administrador' : 'Mensagem para o parceiro'}
              </Label>
              <Textarea
                id="request-comment"
                placeholder="Novo comentário..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                disabled={sending}
                className="pointer-events-auto bg-background"
              />
              {isAdmin && !request.taskDemandId && (
                <p className="text-xs text-muted-foreground">
                  Ao enviar, alterações de status e resolução também serão salvas.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Solicitação não encontrada.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Fechar</Button>
          <Button
            onClick={handleSubmit}
            disabled={sending || (!comment.trim() && !statusChanged)}
          >
            {isAdmin && !request?.taskDemandId ? 'Salvar e enviar' : 'Enviar comentário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
