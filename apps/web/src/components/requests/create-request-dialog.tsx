'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
  personType?: string;
}

type TaskClientMode = 'existing' | 'manual';

function LoadingField({ label }: { label: string }) {
  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        <span>{label}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-primary/10">
        <div className="global-loading-indicator h-full w-1/3 rounded-full bg-primary" />
      </div>
    </div>
  );
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
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [responsibles, setResponsibles] = useState<TaskResponsible[]>([]);
  const [responsiblesLoading, setResponsiblesLoading] = useState(false);
  const [responsibleId, setResponsibleId] = useState('');
  const [taskClients, setTaskClients] = useState<TaskClient[]>([]);
  const [taskClientsLoading, setTaskClientsLoading] = useState(false);
  const [taskClientSearch, setTaskClientSearch] = useState('');
  const [taskClientId, setTaskClientId] = useState('');
  const [taskClientName, setTaskClientName] = useState('');
  const [taskClientMode, setTaskClientMode] = useState<TaskClientMode>('existing');
  const [manualClientName, setManualClientName] = useState('');
  const [manualDocumentType, setManualDocumentType] = useState<'pf' | 'pj'>('pj');
  const [manualDocument, setManualDocument] = useState('');
  const [documentMatch, setDocumentMatch] = useState<TaskClient | null>(null);
  const [checkingDocument, setCheckingDocument] = useState(false);
  const [taskDeadline, setTaskDeadline] = useState('');
  const [priority, setPriority] = useState(false);
  const [resolveInternally, setResolveInternally] = useState(false);
  const [integrationError, setIntegrationError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setType(RequestType.NEW_ACTIVATION);
    setDescription('');
    setPartnerId('');
    setClientId('');
    setResponsibleId('');
    setTaskClients([]);
    setTaskClientSearch('');
    setTaskClientId('');
    setTaskClientName('');
    setTaskClientMode('existing');
    setManualClientName('');
    setManualDocumentType('pj');
    setManualDocument('');
    setDocumentMatch(null);
    setCheckingDocument(false);
    setTaskDeadline('');
    setPriority(false);
    setResolveInternally(false);
    setIntegrationError('');
    if (isAdmin) {
      setPartnersLoading(true);
      getPaginated<Partner>('/partners', { limit: 100, status: 'ACTIVE' })
        .then((result) => {
          if (!cancelled) setPartners(result.data);
        })
        .catch(() => {
          if (!cancelled) setPartners([]);
        })
        .finally(() => {
          if (!cancelled) setPartnersLoading(false);
        });
    } else {
      setPartnersLoading(false);
    }
    setClientsLoading(true);
    getPaginated<Client>('/clients', { limit: 50 })
      .then((result) => {
        if (!cancelled) setClients(result.data);
      })
      .catch(() => {
        if (!cancelled) setClients([]);
      })
      .finally(() => {
        if (!cancelled) setClientsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isAdmin]);

  useEffect(() => {
    if (!open || resolveInternally) {
      setResponsibles([]);
      setResponsiblesLoading(false);
      return;
    }
    let cancelled = false;
    setResponsiblesLoading(true);
    setIntegrationError('');
    api<TaskResponsible[]>('/task-integration/responsibles')
      .then((items) => {
        if (!cancelled) setResponsibles(items);
      })
      .catch((error) => {
        if (cancelled) return;
        setResponsibles([]);
        setIntegrationError(
          error instanceof Error ? error.message : 'Não foi possível carregar os responsáveis.',
        );
      })
      .finally(() => {
        if (!cancelled) setResponsiblesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, resolveInternally]);

  useEffect(() => {
    if (!open || resolveInternally) return;
    let cancelled = false;
    setTaskClientsLoading(true);
    const timer = setTimeout(() => {
      const query = taskClientSearch.trim();
      api<TaskClient[]>(
        `/task-integration/clients${query ? `?search=${encodeURIComponent(query)}` : ''}`,
      )
        .then((items) => {
          if (!cancelled) setTaskClients(items);
        })
        .catch(() => {
          if (!cancelled) setTaskClients([]);
        })
        .finally(() => {
          if (!cancelled) setTaskClientsLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, taskClientSearch, resolveInternally]);

  useEffect(() => {
    if (!open || taskClientMode !== 'manual') return;
    const digits = manualDocument.replace(/\D/g, '');
    const expectedLength = manualDocumentType === 'pf' ? 11 : 14;
    if (digits.length !== expectedLength) {
      setDocumentMatch(null);
      setCheckingDocument(false);
      return;
    }

    setCheckingDocument(true);
    const timer = setTimeout(() => {
      api<TaskClient[]>(
        `/task-integration/clients?search=${encodeURIComponent(digits)}`,
      )
        .then((items) => {
          setDocumentMatch(
            items.find((item) => item.document?.replace(/\D/g, '') === digits) ?? null,
          );
        })
        .catch(() => setDocumentMatch(null))
        .finally(() => setCheckingDocument(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [open, taskClientMode, manualDocument, manualDocumentType]);

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({ title: 'Descreva a solicitação', variant: 'destructive' });
      return;
    }
    if (isAdmin && !partnerId) {
      toast({ title: 'Selecione o parceiro', variant: 'destructive' });
      return;
    }

    if (!resolveInternally) {
      if (!responsibleId) {
        toast({ title: 'Selecione o responsável pela demanda', variant: 'destructive' });
        return;
      }
      const manualDigits = manualDocument.replace(/\D/g, '');
      const expectedDocumentLength = manualDocumentType === 'pf' ? 11 : 14;
      const selectedTaskClient = taskClientMode === 'existing'
        ? taskClients.find((client) => client.id === taskClientId)
        : documentMatch;
      if (taskClientMode === 'existing' && (!taskClientId || !taskClientName)) {
        toast({ title: 'Selecione o cliente do Luxus Task', variant: 'destructive' });
        return;
      }
      if (
        taskClientMode === 'manual'
        && (!manualClientName.trim() || manualDigits.length !== expectedDocumentLength)
      ) {
        toast({
          title: `Informe o nome e um ${manualDocumentType === 'pf' ? 'CPF' : 'CNPJ'} válido`,
          variant: 'destructive',
        });
        return;
      }
      if (!taskDeadline) {
        toast({ title: 'Informe o prazo da demanda', variant: 'destructive' });
        return;
      }
    }

    setLoading(true);
    try {
      const manualDigits = manualDocument.replace(/\D/g, '');
      const selectedTaskClient = taskClientMode === 'existing'
        ? taskClients.find((client) => client.id === taskClientId)
        : documentMatch;

      const created = await api<{ taskSyncError?: string; taskProtocol?: string; taskSyncState?: string }>('/requests', {
        method: 'POST',
        body: {
          type,
          description,
          clientId: clientId || undefined,
          partnerId: isAdmin && partnerId ? partnerId : undefined,
          resolveInternally,
          ...(resolveInternally ? {} : {
            taskResponsibleId: responsibleId,
            taskClientId: selectedTaskClient?.id || undefined,
            taskClientName: selectedTaskClient?.name || manualClientName.trim(),
            taskClientDocumentType:
              taskClientMode === 'manual' && !selectedTaskClient
                ? manualDocumentType
                : undefined,
            taskClientDocument:
              taskClientMode === 'manual' && !selectedTaskClient
                ? manualDigits
                : undefined,
            taskDeadline,
            taskPriority: priority,
          }),
        },
      });
      toast({
        title: resolveInternally
          ? 'Demanda criada no Luxus Parceiros'
          : created.taskSyncError
            ? 'Demanda salva, aguardando sincronização'
            : 'Demanda salva e enviada para processamento',
        description: resolveInternally
          ? 'Será tratada internamente, sem enviar ao Luxus Task.'
          : created.taskSyncError || (
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
              <Select value={partnerId} onValueChange={setPartnerId} disabled={partnersLoading}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={partnersLoading ? 'Carregando parceiros...' : 'Selecione o parceiro'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {partnersLoading && <LoadingField label="Carregando parceiros..." />}
            </div>
          )}
          <div className="space-y-2">
            <Label>Cliente (opcional)</Label>
            <Select
              value={clientId || 'none'}
              onValueChange={(v) => setClientId(v === 'none' ? '' : v)}
              disabled={clientsLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder={clientsLoading ? 'Carregando clientes...' : 'Selecione'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientsLoading && <LoadingField label="Carregando clientes do parceiro..." />}
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg border p-1">
            <Button
              type="button"
              size="sm"
              variant={!resolveInternally ? 'secondary' : 'ghost'}
              onClick={() => setResolveInternally(false)}
            >
              Enviar ao Luxus Task
            </Button>
            <Button
              type="button"
              size="sm"
              variant={resolveInternally ? 'secondary' : 'ghost'}
              onClick={() => setResolveInternally(true)}
            >
              Só no Parceiros
            </Button>
          </div>
          {resolveInternally ? (
            <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              A demanda ficará apenas no Luxus Parceiros. Você poderá atualizar o status por aqui,
              sem criar chamado no Luxus Task.
            </p>
          ) : (
            <>
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Depois do envio, o andamento fica no Luxus Task. O Parceiros só mostra status, anexos e avisos.
          </p>
          <div className="space-y-2">
            <Label>Responsável no Luxus Task *</Label>
            <Select
              value={responsibleId}
              onValueChange={setResponsibleId}
              disabled={responsiblesLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    responsiblesLoading
                      ? 'Carregando responsáveis...'
                      : 'Selecione quem receberá a demanda'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {responsibles.map((responsible) => (
                  <SelectItem key={responsible.id} value={responsible.id}>
                    {responsible.name} — {responsible.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {responsiblesLoading && (
              <LoadingField label="Consultando responsáveis no Luxus Task..." />
            )}
            {!responsiblesLoading && integrationError && (
              <p className="text-xs text-destructive">{integrationError}</p>
            )}
          </div>
          <div className="space-y-3">
            <Label>Cliente no Luxus Task *</Label>
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-1">
              <Button
                type="button"
                size="sm"
                variant={taskClientMode === 'existing' ? 'secondary' : 'ghost'}
                onClick={() => setTaskClientMode('existing')}
              >
                Já cadastrado
              </Button>
              <Button
                type="button"
                size="sm"
                variant={taskClientMode === 'manual' ? 'secondary' : 'ghost'}
                onClick={() => setTaskClientMode('manual')}
              >
                Cadastrar manualmente
              </Button>
            </div>

            {taskClientMode === 'existing' ? (
              <>
                <Input
                  value={taskClientSearch}
                  onChange={(event) => setTaskClientSearch(event.target.value)}
                  placeholder="Busque por nome, CPF ou CNPJ"
                  disabled={taskClientsLoading && taskClients.length === 0}
                />
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border bg-popover p-1">
                  {taskClientsLoading ? (
                    <div className="px-3 py-4">
                      <LoadingField label="Buscando clientes no Luxus Task..." />
                    </div>
                  ) : taskClients.length > 0 ? taskClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        taskClientId === client.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent'
                      }`}
                      onClick={() => {
                        setTaskClientId(client.id);
                        setTaskClientName(client.name);
                      }}
                    >
                      <span className="block font-medium">{client.name}</span>
                      {(client.tradeName || client.document) && (
                        <span className="block text-xs opacity-75">
                          {[client.tradeName, client.document].filter(Boolean).join(' — ')}
                        </span>
                      )}
                    </button>
                  )) : (
                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                      Nenhum cliente encontrado. Use “Cadastrar manualmente”.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={manualDocumentType === 'pj' ? 'secondary' : 'outline'}
                    onClick={() => {
                      setManualDocumentType('pj');
                      setManualDocument('');
                    }}
                  >
                    CNPJ
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={manualDocumentType === 'pf' ? 'secondary' : 'outline'}
                    onClick={() => {
                      setManualDocumentType('pf');
                      setManualDocument('');
                    }}
                  >
                    CPF
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Nome do cliente *</Label>
                  <Input
                    value={manualClientName}
                    onChange={(event) => setManualClientName(event.target.value)}
                    placeholder={manualDocumentType === 'pj' ? 'Razão social ou nome fantasia' : 'Nome completo'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{manualDocumentType === 'pj' ? 'CNPJ' : 'CPF'} *</Label>
                  <Input
                    inputMode="numeric"
                    value={manualDocument}
                    onChange={(event) => {
                      const limit = manualDocumentType === 'pf' ? 11 : 14;
                      setManualDocument(event.target.value.replace(/\D/g, '').slice(0, limit));
                    }}
                    placeholder={manualDocumentType === 'pj' ? '14 dígitos' : '11 dígitos'}
                  />
                </div>
                {checkingDocument && (
                  <LoadingField label="Verificando CPF/CNPJ no Luxus Task..." />
                )}
                {!checkingDocument && documentMatch && (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                    Este documento já está cadastrado para <strong>{documentMatch.name}</strong>.
                    A demanda usará esse cliente existente.
                  </p>
                )}
                {!checkingDocument
                  && !documentMatch
                  && manualDocument.length === (manualDocumentType === 'pf' ? 11 : 14) && (
                    <p className="rounded-md border border-green-500/40 bg-green-500/10 p-2 text-xs text-green-700 dark:text-green-300">
                      Documento não encontrado. O cliente será cadastrado automaticamente no Luxus Task.
                    </p>
                  )}
              </div>
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
            </>
          )}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Descreva o que precisa..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading
              || responsiblesLoading
              || partnersLoading
              || responsibles.length === 0
            }
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando demanda...
              </span>
            ) : 'Criar demanda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
