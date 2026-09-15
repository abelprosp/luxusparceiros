'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
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
  taskDeadline?: string | null;
  partner?: { name?: string | null } | null;
  client?: {
    name?: string | null;
    document?: string | null;
  } | null;
}

export function SendSaleToTaskDialog({ saleId, open, onOpenChange, onSuccess }: {
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
  const minDeadline = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  useEffect(() => {
    if (!open || !saleId) return;
    setLoading(true);
    setResponsibleId('');
    setClientId('');
    setClientSearch('');
    setNotes('');
    setPriority(false);
    Promise.all([
      api<SaleSummary>(`/sales/${saleId}`),
      api<Responsible[]>('/task-integration/responsibles'),
      api<TaskClient[]>('/task-integration/clients'),
    ])
      .then(([saleData, responsibleData, clientData]) => {
        setSale(saleData);
        setResponsibles(responsibleData);
        setClients(clientData);
        setResponsibleId(responsibleData[0]?.id || '');
        setClientName(saleData.client?.name ?? '');
        setDocument(saleData.client?.document ?? '');
        const saleDocument = saleData.client?.document?.replace(/\D/g, '') ?? '';
        setDocumentType(saleDocument.length > 11 ? 'pj' : 'pf');
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
        const suggestedDeadline = new Date();
        suggestedDeadline.setDate(suggestedDeadline.getDate() + 7);
        const y = suggestedDeadline.getFullYear();
        const m = String(suggestedDeadline.getMonth() + 1).padStart(2, '0');
        const d = String(suggestedDeadline.getDate()).padStart(2, '0');
        const existingDeadline = saleData.taskDeadline
          ? (() => {
              const raw = String(saleData.taskDeadline);
              const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
              if (match) return `${match[1]}-${match[2]}-${match[3]}`;
              const date = new Date(raw);
              if (Number.isNaN(date.getTime())) return '';
              const ey = date.getUTCFullYear();
              const em = String(date.getUTCMonth() + 1).padStart(2, '0');
              const ed = String(date.getUTCDate()).padStart(2, '0');
              return `${ey}-${em}-${ed}`;
            })()
          : '';
        setDeadline(
          existingDeadline && existingDeadline >= minDeadline
            ? existingDeadline
            : `${y}-${m}-${d}`,
        );
      })
      .catch((error) => toast({
        title: 'Não foi possível carregar os dados',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      }))
      .finally(() => setLoading(false));
  }, [open, saleId, toast, minDeadline]);

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

  const submit = async () => {
    if (!saleId || !responsibleId || !deadline) {
      toast({ title: 'Informe responsável e prazo', variant: 'destructive' });
      return;
    }
    if (deadline < minDeadline) {
      toast({
        title: 'Prazo inválido',
        description: 'O prazo não pode ser anterior à data de hoje.',
        variant: 'destructive',
      });
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
      await api(`/sales/${saleId}/send-to-task`, {
        method: 'POST',
        body: {
          responsibleId,
          clientId: clientMode === 'task' ? clientId : undefined,
          clientName: clientMode === 'task' ? selectedClient?.name : clientName,
          clientDocumentType: clientMode === 'manual' ? documentType : undefined,
          clientDocument: clientMode === 'manual' ? document : undefined,
          deadline,
          priority,
          notes: notes || undefined,
        },
      });
      toast({
        title: 'Enviado ao Luxus Task',
        description: 'A demanda será criada no primeiro status do template. A finalização fica com o Task.',
        variant: 'success',
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Não foi possível enviar',
        description: error instanceof Error ? error.message : 'Falha',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Enviar Luxus Task</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando responsáveis e clientes...
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
              <p className="text-xs text-muted-foreground">{sale?.protocol} · {sale?.partner?.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A demanda nasce no primeiro status do template do Parceiros. A equipe do Luxus Task assume
                o restante — sem retorno ou sinalização para o Luxus Parceiros.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Responsável no Luxus Task * (sugerido automaticamente)</Label>
              <Select value={responsibleId} onValueChange={setResponsibleId}>
                <SelectTrigger><SelectValue placeholder="Selecione quem receberá a demanda" /></SelectTrigger>
                <SelectContent>
                  {responsibles.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name} · {item.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              <Button type="button" variant={clientMode === 'task' ? 'default' : 'ghost'} onClick={() => setClientMode('task')}>
                Cliente existente
              </Button>
              <Button type="button" variant={clientMode === 'manual' ? 'default' : 'ghost'} onClick={() => setClientMode('manual')}>
                Informar manualmente
              </Button>
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
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="handoff-priority" checked={priority} onCheckedChange={(checked) => setPriority(checked === true)} />
              <Label htmlFor="handoff-priority">Prioridade alta no Luxus Task</Label>
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </div>
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              Anexos e observações da venda seguem com a demanda. Depois disso, o Parceiros só registra que foi enviado.
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => void submit()} disabled={loading || saving || Boolean(duplicateDocument)}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : 'Enviar Luxus Task'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
