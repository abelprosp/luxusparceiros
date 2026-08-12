'use client';

import { useEffect, useState } from 'react';
import { ContractFormat, SaleReviewStatus, SaleStatus } from '@luxus/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toaster';

interface SaleDetail {
  id: string;
  protocol: string;
  status: SaleStatus;
  reviewStatus: SaleReviewStatus;
  correctionReason?: string | null;
  value: number;
  newNumber?: string | null;
  chipIccid?: string | null;
  contractFormat?: ContractFormat | null;
  notes?: string | null;
  client: {
    id: string;
    name: string;
    document: string;
    rg?: string | null;
    email?: string | null;
    phone: string;
    address?: string | null;
    addressNumber?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  };
}

const emptyClient = {
  name: '',
  document: '',
  rg: '',
  email: '',
  phone: '',
  address: '',
  addressNumber: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
};

interface EditSaleDialogProps {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditSaleDialog({ saleId, open, onOpenChange, onSuccess }: EditSaleDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [client, setClient] = useState(emptyClient);
  const [value, setValue] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [chipIccid, setChipIccid] = useState('');
  const [contractFormat, setContractFormat] = useState<ContractFormat | ''>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !saleId) return;
    setLoading(true);
    setSale(null);
    api<SaleDetail>(`/sales/${saleId}`)
      .then((data) => {
        setSale(data);
        setClient({
          name: data.client.name ?? '',
          document: data.client.document ?? '',
          rg: data.client.rg ?? '',
          email: data.client.email ?? '',
          phone: data.client.phone ?? '',
          address: data.client.address ?? '',
          addressNumber: data.client.addressNumber ?? '',
          complement: data.client.complement ?? '',
          neighborhood: data.client.neighborhood ?? '',
          city: data.client.city ?? '',
          state: data.client.state ?? '',
          zipCode: data.client.zipCode ?? '',
        });
        setValue(String(data.value ?? ''));
        setNewNumber(data.newNumber ?? '');
        setChipIccid(data.chipIccid ?? '');
        setContractFormat(data.contractFormat ?? '');
        setNotes(data.notes ?? '');
      })
      .catch((error) => {
        toast({
          title: 'Erro ao carregar a venda',
          description: error instanceof Error ? error.message : 'Falha na requisição',
          variant: 'destructive',
        });
        onOpenChange(false);
      })
      .finally(() => setLoading(false));
  }, [open, saleId, onOpenChange, toast]);

  const save = async () => {
    if (!sale) return;
    if (!client.name.trim() || !client.document.trim() || !client.phone.trim() || !value) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }
    if (!contractFormat) {
      toast({ title: 'Informe o formato do contrato', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      await api(`/sales/${sale.id}`, {
        method: 'PATCH',
        body: {
          value: Number(value),
          newNumber: newNumber || undefined,
          chipIccid: chipIccid || undefined,
          contractFormat: contractFormat || undefined,
          notes,
          client: {
            ...client,
            email: client.email || undefined,
            rg: client.rg || undefined,
          },
        },
      });
      const shouldResubmit = sale.reviewStatus === SaleReviewStatus.CHANGES_REQUESTED;
      const shouldRetrySync = sale.reviewStatus === SaleReviewStatus.APPROVED;
      if (shouldResubmit) await api(`/sales/${sale.id}/submit`, { method: 'POST' });
      if (shouldRetrySync) await api(`/sales/${sale.id}/retry-task-sync`, { method: 'POST' });
      toast({
        title: shouldResubmit
          ? 'Venda corrigida e reenviada'
          : shouldRetrySync
            ? 'Venda atualizada e reenviada ao Luxus Task'
            : 'Venda atualizada',
        description: shouldResubmit
          ? 'O administrador foi avisado para analisar novamente.'
          : shouldRetrySync
            ? 'O sync com o Luxus Task foi reenfileirado com os dados corrigidos.'
            : undefined,
        variant: 'success',
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar a venda',
        description: error instanceof Error ? error.message : 'Falha na requisição',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Editar venda {sale?.protocol ? `— ${sale.protocol}` : ''}</DialogTitle>
        </DialogHeader>

        {loading || !sale ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-6 py-2">
            {sale.correctionReason && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                <p className="font-semibold">Correção solicitada pelo administrador</p>
                <p className="mt-1">{sale.correctionReason}</p>
              </div>
            )}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Dados da venda</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Valor *</Label>
                  <Input type="number" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Número da linha</Label>
                  <Input value={newNumber} onChange={(event) => setNewNumber(event.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>ICCID do chip</Label>
                  <Input value={chipIccid} onChange={(event) => setChipIccid(event.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Formato do contrato</Label>
                  <Select value={contractFormat} onValueChange={(format) => setContractFormat(format as ContractFormat)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ContractFormat.PRINT}>Impressão</SelectItem>
                      <SelectItem value={ContractFormat.ZAPSIGN}>ZapSign</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div>
                <h3 className="text-sm font-semibold">Assinatura do contrato</h3>
                <p className="text-xs text-muted-foreground">Não anexe contrato assinado aqui. A assinatura será obtida no Luxus Task conforme o formato escolhido.</p>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Dados do cliente</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2"><Label>Nome *</Label><Input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} /></div>
                <div className="space-y-2"><Label>CPF *</Label><Input value={client.document} onChange={(e) => setClient({ ...client, document: e.target.value })} /></div>
                <div className="space-y-2"><Label>RG</Label><Input value={client.rg} onChange={(e) => setClient({ ...client, rg: e.target.value })} /></div>
                <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Telefone *</Label><Input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Endereço</Label><Input value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} /></div>
                <div className="space-y-2"><Label>Número</Label><Input value={client.addressNumber} onChange={(e) => setClient({ ...client, addressNumber: e.target.value })} /></div>
                <div className="space-y-2"><Label>Complemento</Label><Input value={client.complement} onChange={(e) => setClient({ ...client, complement: e.target.value })} /></div>
                <div className="space-y-2"><Label>Bairro</Label><Input value={client.neighborhood} onChange={(e) => setClient({ ...client, neighborhood: e.target.value })} /></div>
                <div className="space-y-2"><Label>Cidade</Label><Input value={client.city} onChange={(e) => setClient({ ...client, city: e.target.value })} /></div>
                <div className="space-y-2"><Label>UF</Label><Input maxLength={2} value={client.state} onChange={(e) => setClient({ ...client, state: e.target.value.toUpperCase() })} /></div>
                <div className="space-y-2"><Label>CEP</Label><Input value={client.zipCode} onChange={(e) => setClient({ ...client, zipCode: e.target.value })} /></div>
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={loading || saving || !sale}>
            {saving ? 'Salvando...' : sale?.reviewStatus === SaleReviewStatus.CHANGES_REQUESTED ? 'Salvar e reenviar' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
