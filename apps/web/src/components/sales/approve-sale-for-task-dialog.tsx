'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { ContractFormat } from '@luxus/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toaster';
import {
  DigitCountdownInput,
  formatCnpjDigits,
  formatCpfDigits,
} from './digit-countdown-input';

interface Responsible { id: string; name: string; email: string }
interface TaskClient { id: string; name: string; document?: string; tradeName?: string }
interface SaleSummary {
  protocol: string;
  contractFormat?: ContractFormat | null;
  client?: { name: string; document: string };
  partner?: { name: string };
}

export function ApproveSaleForTaskDialog({ saleId, open, onOpenChange, onSuccess }: {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [sale, setSale] = useState<SaleSummary | null>(null);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [clients, setClients] = useState<TaskClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [responsibleId, setResponsibleId] = useState('');
  const [clientMode, setClientMode] = useState<'task' | 'manual'>('task');
  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientName, setClientName] = useState('');
  const [documentType, setDocumentType] = useState<'pf' | 'pj'>('pf');
  const [document, setDocument] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !saleId) return;
    setLoading(true);
    Promise.all([
      api<SaleSummary>(`/sales/${saleId}`),
      api<Responsible[]>('/task-integration/responsibles'),
      api<TaskClient[]>('/task-integration/clients'),
    ]).then(([saleData, responsibleData, clientData]) => {
      setSale(saleData);
      setResponsibles(responsibleData);
      setClients(clientData);
      setClientName(saleData.client?.name ?? '');
      setDocument(saleData.client?.document ?? '');
      setResponsibleId((current) => current || responsibleData[0]?.id || '');
      const saleDocument = saleData.client?.document?.replace(/\D/g, '') ?? '';
      const matchingClient = saleDocument
        ? clientData.find((client) => client.document?.replace(/\D/g, '') === saleDocument)
        : undefined;
      if (matchingClient) {
        setClientMode('task');
        setClientId(matchingClient.id);
        setClientSearch(matchingClient.name);
      } else {
        setClientMode('manual');
        setClientId('');
        setDocumentType(saleDocument.length > 11 ? 'pj' : 'pf');
      }
      const suggestedDeadline = new Date();
      suggestedDeadline.setDate(suggestedDeadline.getDate() + 7);
      setDeadline((current) => current || suggestedDeadline.toISOString().slice(0, 10));
    }).catch((error) => toast({
      title: 'Não foi possível carregar os dados do Luxus Task',
      description: error instanceof Error ? error.message : 'Tente novamente.',
      variant: 'destructive',
    })).finally(() => setLoading(false));
  }, [open, saleId, toast]);

  useEffect(() => {
    if (!open || clientMode !== 'task') return;
    let active = true;
    const timer = setTimeout(() => {
      setLoadingClients(true);
      api<TaskClient[]>(`/task-integration/clients${clientSearch.trim() ? `?search=${encodeURIComponent(clientSearch.trim())}` : ''}`)
        .then((items) => {
          if (active) setClients(items);
        })
        .catch(() => {
          if (active) setClients([]);
        })
        .finally(() => {
          if (active) setLoadingClients(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [clientSearch, clientMode, open]);

  const selectedClient = useMemo(() => clients.find((client) => client.id === clientId), [clients, clientId]);
  const duplicateDocument = useMemo(() => {
    const digits = document.replace(/\D/g, '');
    return digits ? clients.find((client) => client.document?.replace(/\D/g, '') === digits) : undefined;
  }, [clients, document]);

  const approve = async () => {
    if (!saleId || !responsibleId || !deadline) {
      toast({ title: 'Informe responsável e prazo', variant: 'destructive' });
      return;
    }
    if (clientMode === 'task' && !clientId) {
      toast({ title: 'Selecione o cliente do Luxus Task', variant: 'destructive' });
      return;
    }
    if (clientMode === 'manual' && (!clientName.trim() || !document.trim())) {
      toast({ title: 'Informe nome e CPF/CNPJ do cliente', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await api(`/sales/${saleId}/approve-for-task`, {
        method: 'POST',
        body: {
          responsibleId,
          clientId: clientMode === 'task' ? clientId : undefined,
          clientName: clientMode === 'task' ? selectedClient?.name : clientName,
          clientDocumentType: clientMode === 'manual' ? documentType : undefined,
          clientDocument: clientMode === 'manual' ? document : undefined,
          deadline: new Date(`${deadline}T23:59:59`).toISOString(),
          priority,
          notes: notes || undefined,
        },
      });
      toast({
        title: 'Venda aprovada e enfileirada',
        description: 'Você pode fechar esta tela. O envio ao Luxus Task continuará em segundo plano.',
        variant: 'success',
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({ title: 'Não foi possível aprovar', description: error instanceof Error ? error.message : 'Falha', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader><DialogTitle>Aprovar e enviar ao Luxus Task</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando responsáveis e clientes do Luxus Task...
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
              <p className="text-xs text-muted-foreground">{sale?.protocol} · {sale?.partner?.name}</p>
              <p className="mt-1 font-semibold">Contrato: {sale?.contractFormat === ContractFormat.ZAPSIGN ? 'ZapSign' : 'Impressão'}</p>
              <p className="mt-1 text-xs text-muted-foreground">A assinatura será solicitada e tratada dentro do Luxus Task.</p>
            </div>
            <div className="space-y-2">
              <Label>Responsável no Luxus Task * (sugerido automaticamente)</Label>
              <Select value={responsibleId} onValueChange={setResponsibleId}>
                <SelectTrigger><SelectValue placeholder="Selecione quem continuará a venda" /></SelectTrigger>
                <SelectContent>{responsibles.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {item.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              <Button type="button" variant={clientMode === 'task' ? 'default' : 'ghost'} onClick={() => setClientMode('task')}>Cliente existente</Button>
              <Button type="button" variant={clientMode === 'manual' ? 'default' : 'ghost'} onClick={() => setClientMode('manual')}>Informar manualmente</Button>
            </div>
            {clientMode === 'task' ? (
              <div className="space-y-2">
                <Label>Cliente no Luxus Task *</Label>
                <Input
                  value={clientSearch}
                  onChange={(event) => {
                    setClientSearch(event.target.value);
                    setClientId('');
                  }}
                  placeholder="Buscar por nome, CPF ou CNPJ"
                  autoComplete="off"
                />
                <div
                  className="max-h-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-sm"
                  role="listbox"
                  aria-label="Sugestões de clientes do Luxus Task"
                >
                  {loadingClients ? (
                    <p className="flex items-center justify-center gap-2 px-3 py-5 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Atualizando sugestões...
                    </p>
                  ) : clients.length === 0 ? (
                    <p className="px-3 py-5 text-center text-sm text-muted-foreground">
                      Nenhum cliente encontrado. Use “Informar manualmente”.
                    </p>
                  ) : (
                    clients.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={clientId === item.id}
                        className={`flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${clientId === item.id ? 'bg-primary/10 text-primary' : ''}`}
                        onClick={() => {
                          setClientId(item.id);
                          setClientSearch(item.name);
                        }}
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{item.document || 'Sem CPF/CNPJ'}</span>
                      </button>
                    ))
                  )}
                </div>
                {selectedClient && (
                  <p className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Selecionado: {selectedClient.name}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="space-y-2"><Label>Nome / razão social *</Label><Input value={clientName} onChange={(event) => setClientName(event.target.value)} /></div>
                <div className="grid gap-3 sm:grid-cols-[130px_1fr]">
                  <div className="space-y-2"><Label>Documento</Label><Select value={documentType} onValueChange={(value) => setDocumentType(value as 'pf' | 'pj')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pf">CPF</SelectItem><SelectItem value="pj">CNPJ</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>{documentType === 'pf' ? 'CPF' : 'CNPJ'} *</Label>
                    <DigitCountdownInput
                      value={document}
                      onChange={setDocument}
                      requiredDigits={documentType === 'pf' ? 11 : 14}
                      formatDisplay={documentType === 'pf' ? formatCpfDigits : formatCnpjDigits}
                      hintLabel={documentType === 'pf' ? 'CPF' : 'CNPJ'}
                    />
                  </div>
                </div>
                {duplicateDocument && <p className="flex items-center gap-2 text-sm text-amber-600"><AlertCircle className="h-4 w-4" /> Este documento já pertence a {duplicateDocument.name}. Use o cliente existente.</p>}
              </div>
            )}
            <div className="space-y-2"><Label>Prazo no Luxus Task * (sugerido automaticamente)</Label><Input type="date" value={deadline} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setDeadline(event.target.value)} /></div>
            <label className="flex items-center gap-2"><Checkbox checked={priority} onCheckedChange={(checked) => setPriority(checked === true)} /> Marcar como prioridade</label>
            <div className="space-y-2"><Label>Complemento interno (opcional)</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Informações que ajudarão o responsável no Luxus Task" /></div>
            <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Após confirmar, o processamento continua automaticamente. Não é necessário manter a janela aberta.</div>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={approve} disabled={loading || saving || Boolean(duplicateDocument)}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enfileirando...</> : 'Aprovar e enviar'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
