'use client';

import { useEffect, useState } from 'react';
import { RequestType, REQUEST_TYPE_LABELS, UserRole } from '@luxus/types';
import { api, getPaginated } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface TaskResponsible {
  id: string;
  name: string;
  email: string;
}

interface TaskClient {
  id: string;
  name: string;
  document?: string;
  tradeName?: string;
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
  const [responsibles, setResponsibles] = useState<TaskResponsible[]>([]);
  const [responsibleId, setResponsibleId] = useState('');
  const [taskClients, setTaskClients] = useState<TaskClient[]>([]);
  const [taskClientSearch, setTaskClientSearch] = useState('');
  const [taskClientId, setTaskClientId] = useState('');
  const [taskClientName, setTaskClientName] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [priority, setPriority] = useState(false);
  const [integrationError, setIntegrationError] = useState('');

  useEffect(() => {
    if (!open) return;
    setType(RequestType.NEW_ACTIVATION);
    setDescription('');
    setPartnerId('');
    setClientId('');
    setResponsibleId('');
    setTaskClients([]);
    setTaskClientSearch('');
    setTaskClientId('');
    setTaskClientName('');
    setTaskDeadline('');
    setPriority(false);
    setIntegrationError('');
    if (isAdmin) {
      getPaginated<Partner>('/partners', { limit: 100, status: 'ACTIVE' }).then((r) => setPartners(r.data));
    }
    getPaginated<Client>('/clients', { limit: 50 }).then((r) => setClients(r.data));
    api<TaskResponsible[]>('/task-integration/responsibles')
      .then(setResponsibles)
      .catch((error) => {
        setResponsibles([]);
        setIntegrationError(
          error instanceof Error ? error.message : 'Não foi possível carregar os responsáveis.',
        );
      });
  }, [open, isAdmin]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const query = taskClientSearch.trim();
      api<TaskClient[]>(
        `/task-integration/clients${query ? `?search=${encodeURIComponent(query)}` : ''}`,
      )
        .then(setTaskClients)
        .catch(() => setTaskClients([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [open, taskClientSearch]);

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({ title: 'Descreva a solicitação', variant: 'destructive' });
      return;
    }
    if (isAdmin && !partnerId) {
      toast({ title: 'Selecione o parceiro', variant: 'destructive' });
      return;
    }
    if (!responsibleId) {
      toast({ title: 'Selecione o responsável pela demanda', variant: 'destructive' });
      return;
    }
    if (!taskClientId || !taskClientName) {
      toast({ title: 'Selecione o cliente do Luxus Task', variant: 'destructive' });
      return;
    }
    if (!taskDeadline) {
      toast({ title: 'Informe o prazo da demanda', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const created = await api<{ taskSyncError?: string; taskProtocol?: string }>('/requests', {
        method: 'POST',
        body: {
          type,
          description,
          clientId: clientId || undefined,
          partnerId: isAdmin && partnerId ? partnerId : undefined,
          taskResponsibleId: responsibleId,
          taskClientId,
          taskClientName,
          taskDeadline,
          taskPriority: priority,
        },
      });
      toast({
        title: created.taskSyncError
          ? 'Demanda salva, aguardando sincronização'
          : 'Demanda salva e enviada para processamento',
        description: created.taskSyncError || (
          created.taskProtocol ? `Protocolo no Luxus Task: ${created.taskProtocol}` : undefined
        ),
        variant: created.taskSyncError ? 'default' : 'success',
      });
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
          <DialogTitle>Nova demanda</DialogTitle>
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
              <Label>Parceiro *</Label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger><SelectValue placeholder="Selecione o parceiro" /></SelectTrigger>
                <SelectContent>
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
            <Label>Responsável no Luxus Task *</Label>
            <Select value={responsibleId} onValueChange={setResponsibleId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione quem receberá a demanda" />
              </SelectTrigger>
              <SelectContent>
                {responsibles.map((responsible) => (
                  <SelectItem key={responsible.id} value={responsible.id}>
                    {responsible.name} — {responsible.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {integrationError && (
              <p className="text-xs text-destructive">{integrationError}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Cliente no Luxus Task *</Label>
            <Input
              value={taskClientSearch}
              onChange={(event) => setTaskClientSearch(event.target.value)}
              placeholder="Digite para buscar clientes do Luxus Task"
            />
            <Select
              value={taskClientId}
              onValueChange={(value) => {
                setTaskClientId(value);
                setTaskClientName(
                  taskClients.find((client) => client.id === value)?.name ?? '',
                );
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {taskClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                    {client.document ? ` — ${client.document}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {taskClients.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum cliente encontrado para a busca.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Prazo no Luxus Task *</Label>
            <Input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={taskDeadline}
              onChange={(event) => setTaskDeadline(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={priority}
              onChange={(event) => setPriority(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Marcar como prioridade
          </label>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Descreva o que precisa..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || responsibles.length === 0}>
            {loading ? 'Enviando...' : 'Criar demanda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
