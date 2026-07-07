'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from '@luxus/types';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { isPartnerUser } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toaster';

interface TicketEditData {
  id: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
}

interface EditTicketDialogProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditTicketDialog({ ticketId, open, onOpenChange, onSuccess }: EditTicketDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPartner = isPartnerUser(user);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>(TicketCategory.SUPPORT);
  const [priority, setPriority] = useState<TicketPriority>(TicketPriority.MEDIUM);
  const [status, setStatus] = useState<TicketStatus>(TicketStatus.NEW);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const data = await api<TicketEditData>(`/tickets/${ticketId}`);
      setSubject(data.subject);
      setCategory(data.category);
      setPriority(data.priority);
      setStatus(data.status);
    } catch {
      toast({ title: 'Erro ao carregar chamado', variant: 'destructive' });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [ticketId, onOpenChange, toast]);

  useEffect(() => {
    if (open && ticketId) load();
    if (!open) {
      setSubject('');
    }
  }, [open, ticketId, load]);

  const handleSubmit = async () => {
    if (!ticketId || !subject.trim()) {
      toast({ title: 'Informe o assunto', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = {
        subject: subject.trim(),
        category,
        priority,
      };
      if (!isPartner) body.status = status;

      await api(`/tickets/${ticketId}`, { method: 'PATCH', body });
      toast({ title: 'Chamado atualizado', variant: 'success' });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Falha ao salvar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar chamado</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Descreva o problema"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(TicketCategory).map((c) => (
                    <SelectItem key={c} value={c}>{TICKET_CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(TicketPriority).map((p) => (
                    <SelectItem key={p} value={p}>{TICKET_PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isPartner && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(TicketStatus).map((s) => (
                      <SelectItem key={s} value={s}>{TICKET_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
