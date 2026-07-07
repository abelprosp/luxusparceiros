'use client';

import { useEffect, useState } from 'react';
import { RequestType, REQUEST_TYPE_LABELS, UserRole } from '@luxus/types';
import { api, getPaginated } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toaster';

interface Partner {
  id: string;
  name: string;
}

interface Client {
  id: string;
  name: string;
}

interface CreateRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateRequestDialog({ open, onOpenChange, onSuccess }: CreateRequestDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR;
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<RequestType>(RequestType.NEW_ACTIVATION);
  const [description, setDescription] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [clientId, setClientId] = useState('');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    if (!open) return;
    setType(RequestType.NEW_ACTIVATION);
    setDescription('');
    setPartnerId('');
    setClientId('');
    if (isAdmin) {
      getPaginated<Partner>('/partners', { limit: 100, status: 'ACTIVE' }).then((r) => setPartners(r.data));
    }
    getPaginated<Client>('/clients', { limit: 50 }).then((r) => setClients(r.data));
  }, [open, isAdmin]);

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({ title: 'Descreva a solicitação', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await api('/requests', {
        method: 'POST',
        body: {
          type,
          description,
          clientId: clientId || undefined,
          partnerId: isAdmin && partnerId ? partnerId : undefined,
        },
      });
      toast({ title: 'Solicitação criada', variant: 'success' });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova solicitação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as RequestType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.values(RequestType).map((t) => (
                  <SelectItem key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <div className="space-y-2">
              <Label>Parceiro (opcional)</Label>
              <Select value={partnerId || 'none'} onValueChange={(v) => setPartnerId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Automático</SelectItem>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Cliente (opcional)</Label>
            <Select value={clientId || 'none'} onValueChange={(v) => setClientId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Descreva o que precisa..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Enviando...' : 'Criar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
