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
    }).catch((error) => toast({
      title: 'Não foi possível carregar os dados do Luxus Task',
      description: error instanceof Error ? error.message : 'Tente novamente.',
      variant: 'destructive',
    })).finally(() => setLoading(false));
  }, [open, saleId, toast]);

  useEffect(() => {
    if (!open || clientMode !== 'task') return;
    const timer = setTimeout(() => {
      api<TaskClient[]>(`/task-integration/clients${clientSearch.trim() ? `?search=${encodeURIComponent(clientSearch.trim())}` : ''}`)
        .then(setClients)
        .catch(() => setClients([]));
    }, 350);
    return () => clearTimeout(timer);
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
              <Label>Responsável no Luxus Task *</Label>
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
                <Input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Buscar por nome, CPF ou CNPJ" />
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent className="z-[100] max-h-64">{clients.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}{item.document ? ` · ${item.document}` : ''}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="space-y-2"><Label>Nome / razão social *</Label><Input value={clientName} onChange={(event) => setClientName(event.target.value)} /></div>
                <div className="grid gap-3 sm:grid-cols-[130px_1fr]">
                  <div className="space-y-2"><Label>Documento</Label><Select value={documentType} onValueChange={(value) => setDocumentType(value as 'pf' | 'pj')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pf">CPF</SelectItem><SelectItem value="pj">CNPJ</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>{documentType === 'pf' ? 'CPF' : 'CNPJ'} *</Label><Input value={document} onChange={(event) => setDocument(event.target.value)} /></div>
                </div>
                {duplicateDocument && <p className="flex items-center gap-2 text-sm text-amber-600"><AlertCircle className="h-4 w-4" /> Este documento já pertence a {duplicateDocument.name}. Use o cliente existente.</p>}
              </div>
            )}
            <div className="space-y-2"><Label>Prazo no Luxus Task *</Label><Input type="date" value={deadline} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setDeadline(event.target.value)} /></div>
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
