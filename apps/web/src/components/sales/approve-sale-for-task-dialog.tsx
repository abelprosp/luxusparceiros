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

type ApproveFlow = 'choose' | 'task';

export function ApproveSaleForTaskDialog({ saleId, open, onOpenChange, onSuccess }: {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [flow, setFlow] = useState<ApproveFlow>('choose');
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
  const minDeadline = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  useEffect(() => {
    if (!open) {
      setFlow('choose');
      return;
    }
    if (!saleId) return;
    setFlow('choose');
    setLoading(true);
    api<SaleSummary>(`/sales/${saleId}`)
      .then((saleData) => {
        setSale(saleData);
        setClientName(saleData.client?.name ?? '');
        setDocument(saleData.client?.document ?? '');
        const saleDocument = saleData.client?.document?.replace(/\D/g, '') ?? '';
        setDocumentType(saleDocument.length > 11 ? 'pj' : 'pf');
        const suggestedDeadline = new Date();
        suggestedDeadline.setDate(suggestedDeadline.getDate() + 7);
        const y = suggestedDeadline.getFullYear();
        const m = String(suggestedDeadline.getMonth() + 1).padStart(2, '0');
        const d = String(suggestedDeadline.getDate()).padStart(2, '0');
        setDeadline((current) => current || `${y}-${m}-${d}`);
      })
      .catch((error) => toast({
        title: 'Não foi possível carregar a venda',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      }))
      .finally(() => setLoading(false));
  }, [open, saleId, toast]);

  useEffect(() => {
    if (!open || flow !== 'task' || !saleId) return;
    let active = true;
    setLoading(true);
    Promise.all([
      api<Responsible[]>('/task-integration/responsibles'),
      api<TaskClient[]>('/task-integration/clients'),
    ]).then(([responsibleData, clientData]) => {
      if (!active) return;
      setResponsibles(responsibleData);
      setClients(clientData);
      setResponsibleId((current) => current || responsibleData[0]?.id || '');
      const saleDocument = sale?.client?.document?.replace(/\D/g, '') ?? '';
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
      }
    }).catch((error) => {
      if (!active) return;
      toast({
        title: 'Não foi possível carregar os dados do Luxus Task',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [flow, open, sale?.client?.document, saleId, toast]);

  useEffect(() => {
    if (!open || flow !== 'task' || clientMode !== 'task') return;
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
  }, [clientSearch, clientMode, open, flow]);

  const selectedClient = useMemo(() => clients.find((client) => client.id === clientId), [clients, clientId]);
  const duplicateDocument = useMemo(() => {
    const digits = document.replace(/\D/g, '');
    return digits ? clients.find((client) => client.document?.replace(/\D/g, '') === digits) : undefined;
  }, [clients, document]);

  const approveInternal = async () => {
    if (!saleId) return;
    setSaving(true);
    try {
      await api(`/sales/${saleId}/approve-internal`, { method: 'POST' });
      toast({
        title: 'Venda concluída no Luxus Parceiros',
        description: 'A venda foi aprovada e finalizada sem enviar ao Luxus Task.',
        variant: 'success',
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Não foi possível concluir',
        description: error instanceof Error ? error.message : 'Falha',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

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
        <DialogHeader>
          <DialogTitle>
            {flow === 'choose' ? 'Como deseja seguir com a venda?' : 'Aprovar e enviar ao Luxus Task'}
          </DialogTitle>
        </DialogHeader>

        {flow === 'choose' ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
              <p className="text-xs text-muted-foreground">{sale?.protocol} · {sale?.partner?.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Escolha se a venda continua no Luxus Task ou se será resolvida toda aqui no Luxus Parceiros.
              </p>
            </div>
            <Button
              className="h-auto w-full flex-col items-start gap-1 whitespace-normal px-4 py-3 text-left"
              variant="outline"
              disabled={loading || saving}
              onClick={() => setFlow('task')}
            >
              <span className="font-semibold">Enviar ao Luxus Task</span>
              <span className="text-xs font-normal text-muted-foreground">
                Contrato, assinatura e conferência seguem no fluxo integrado com o Task.
              </span>
            </Button>
            <Button
              className="h-auto w-full flex-col items-start gap-1 whitespace-normal px-4 py-3 text-left"
              variant="outline"
              disabled={loading || saving}
              onClick={() => void approveInternal()}
            >
              <span className="font-semibold">
                {saving ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Concluindo...
                  </span>
                ) : (
                  'Resolver no Luxus Parceiros'
                )}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                Aprova e conclui a venda agora, sem criar demanda no Luxus Task.
              </span>
            </Button>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            </DialogFooter>
          </div>
        ) : loading ? (
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
                />
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder={loadingClients ? 'Buscando...' : 'Selecione o cliente'} /></SelectTrigger>
                  <SelectContent>
                    {clients.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}{item.document ? ` · ${item.document}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome do cliente *</Label>
                  <Input value={clientName} onChange={(event) => setClientName(event.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={documentType} onValueChange={(value: 'pf' | 'pj') => setDocumentType(value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pf">CPF</SelectItem>
                        <SelectItem value="pj">CNPJ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{documentType === 'pf' ? 'CPF' : 'CNPJ'} *</Label>
                    <DigitCountdownInput
                      value={document}
                      onChange={setDocument}
                      requiredDigits={documentType === 'pf' ? 11 : 14}
                      formatDisplay={documentType === 'pf' ? formatCpfDigits : formatCnpjDigits}
                      hintLabel={documentType === 'pf' ? 'CPF' : 'CNPJ'}
                    />
                  </div>
                </div>
                {duplicateDocument && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    Já existe cliente com este documento no Luxus Task: {duplicateDocument.name}. Prefira selecioná-lo.
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Prazo *</Label>
              <Input
                type="date"
                min={minDeadline}
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Não pode ser anterior a hoje. Sugestão automática: 7 dias.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="priority" checked={priority} onCheckedChange={(checked) => setPriority(checked === true)} />
              <Label htmlFor="priority">Prioridade alta no Luxus Task</Label>
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </div>
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Após aprovar, o envio segue em segundo plano. Você pode continuar no sistema.
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setFlow('choose')}>Voltar</Button>
              <Button onClick={approve} disabled={loading || saving || Boolean(duplicateDocument)}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enfileirando...</> : 'Aprovar e enviar'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
