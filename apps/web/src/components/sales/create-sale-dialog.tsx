'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ContractFormat, DocumentType } from '@luxus/types';
import { api, getPaginated, uploadFile } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { isPartnerUser } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toaster';

interface Operator {
  id: string;
  name: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  operatorId: string;
}

interface Partner {
  id: string;
  name: string;
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

interface CreateSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateSaleDialog({ open, onOpenChange, onSuccess }: CreateSaleDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPartner = isPartnerUser(user);
  const [saving, setSaving] = useState(false);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  const [partnerId, setPartnerId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [planId, setPlanId] = useState('');
  const [value, setValue] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [isVirginChip, setIsVirginChip] = useState(true);
  const [chipIccid, setChipIccid] = useState('');
  const [chipPhoto, setChipPhoto] = useState<File | null>(null);
  const [cpfPhoto, setCpfPhoto] = useState<File | null>(null);
  const [rgPhoto, setRgPhoto] = useState<File | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [contractFormat, setContractFormat] = useState<ContractFormat | ''>('');
  const [client, setClient] = useState(emptyClient);
  const [isPortability, setIsPortability] = useState(false);
  const [portabilityNumber, setPortabilityNumber] = useState('');

  useEffect(() => {
    if (!open) return;
    getPaginated<Operator>('/operators', { limit: 100 }).then((ops) => setOperators(ops.data));
    const plansPath = isPartner ? '/plans/available' : '/plans';
    getPaginated<Plan>(plansPath, { limit: 100 }).then((pls) => setPlans(pls.data));
    if (!isPartner) {
      getPaginated<Partner>('/partners', { limit: 100, status: 'ACTIVE' }).then((pts) => setPartners(pts.data));
    }
    if (isPartner && user?.partnerId) setPartnerId(user.partnerId);
  }, [open, isPartner, user?.partnerId]);

  const filteredPlans = plans.filter((p) => p.operatorId === operatorId);

  const reset = () => {
    setPartnerId('');
    setOperatorId('');
    setPlanId('');
    setValue('');
    setNewNumber('');
    setIsVirginChip(true);
    setChipIccid('');
    setChipPhoto(null);
    setCpfPhoto(null);
    setRgPhoto(null);
    setContractFile(null);
    setContractFormat('');
    setClient(emptyClient);
    setIsPortability(false);
    setPortabilityNumber('');
  };

  const handleSave = async () => {
    if (!partnerId || !operatorId || !planId || !newNumber || !contractFormat) {
      toast({ title: 'Preencha parceiro, operadora, plano, linha e contrato', variant: 'destructive' });
      return;
    }
    if (!client.name || !client.document || !client.phone) {
      toast({ title: 'Preencha nome, CPF e telefone do cliente', variant: 'destructive' });
      return;
    }
    if (!chipPhoto) {
      toast({ title: 'Anexe a foto do chip', variant: 'destructive' });
      return;
    }
    if (!cpfPhoto) {
      toast({ title: 'Anexe a foto do CPF', variant: 'destructive' });
      return;
    }
    if (!rgPhoto) {
      toast({ title: 'Anexe a foto do RG', variant: 'destructive' });
      return;
    }
    if (!contractFile) {
      toast({ title: 'Anexe o contrato assinado', variant: 'destructive' });
      return;
    }
    if (isVirginChip && !chipIccid.trim()) {
      toast({ title: 'ICCID é obrigatório para chip virgem', variant: 'destructive' });
      return;
    }
    const lineDigits = newNumber.replace(/\D/g, '');
    const phoneDigits = client.phone.replace(/\D/g, '');
    if (lineDigits && phoneDigits && lineDigits === phoneDigits) {
      toast({ title: 'Telefone de contato deve ser diferente da linha vendida', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const sale = await api<{ id: string; client?: { id: string } }>('/sales', {
        method: 'POST',
        body: {
          partnerId,
          operatorId,
          planId,
          value: parseFloat(value) || filteredPlans.find((p) => p.id === planId)?.price,
          newNumber,
          isVirginChip,
          chipIccid: isVirginChip ? chipIccid.trim() : chipIccid.trim() || undefined,
          contractFormat,
          isPortability,
          portabilityNumber: isPortability ? portabilityNumber : undefined,
          client: {
            ...client,
            document: client.document.replace(/\D/g, ''),
            documentType: DocumentType.CPF,
          },
        },
      });

      const clientId = sale.client?.id;
      await uploadFile(chipPhoto, DocumentType.CHIP_PHOTO, { saleId: sale.id, clientId });
      await uploadFile(cpfPhoto, DocumentType.CPF, { saleId: sale.id, clientId });
      await uploadFile(rgPhoto, DocumentType.RG, { saleId: sale.id, clientId });
      await uploadFile(contractFile, DocumentType.CONTRACT, { saleId: sale.id, clientId });
      toast({ title: 'Venda registrada', variant: 'success' });
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Venda</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Dados da linha vendida</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {!isPartner && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Parceiro *</Label>
                  <Select value={partnerId} onValueChange={setPartnerId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Operadora *</Label>
                <Select value={operatorId} onValueChange={(v) => { setOperatorId(v); setPlanId(''); setValue(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {operators.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plano *</Label>
                <Select value={planId} onValueChange={(v) => { setPlanId(v); const p = filteredPlans.find((x) => x.id === v); if (p) setValue(String(p.price)); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {filteredPlans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Número da linha *</Label>
                <Input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  id="virgin-chip"
                  checked={isVirginChip}
                  onChange={(e) => setIsVirginChip(e.target.checked)}
                />
                <Label htmlFor="virgin-chip">Chip virgem</Label>
              </div>
              {isVirginChip && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>ICCID do chip *</Label>
                  <Input value={chipIccid} onChange={(e) => setChipIccid(e.target.value)} placeholder="8955..." />
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label>Foto do chip *</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setChipPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Formato do contrato *</Label>
                <Select value={contractFormat} onValueChange={(v) => setContractFormat(v as ContractFormat)}>
                  <SelectTrigger><SelectValue placeholder="Impressão ou ZapSign" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ContractFormat.PRINT}>Impressão</SelectItem>
                    <SelectItem value={ContractFormat.ZAPSIGN}>ZapSign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Contrato assinado *</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setContractFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">Foto do contrato impresso ou PDF do ZapSign</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Dados do cliente</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nome *</Label>
                <Input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input value={client.document} onChange={(e) => setClient({ ...client, document: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>RG</Label>
                <Input value={client.rg} onChange={(e) => setClient({ ...client, rg: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefone de contato *</Label>
                <Input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} placeholder="Diferente da linha" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Endereço</Label>
                <Input value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input value={client.addressNumber} onChange={(e) => setClient({ ...client, addressNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input value={client.complement} onChange={(e) => setClient({ ...client, complement: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={client.neighborhood} onChange={(e) => setClient({ ...client, neighborhood: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={client.city} onChange={(e) => setClient({ ...client, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input value={client.state} onChange={(e) => setClient({ ...client, state: e.target.value })} maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input value={client.zipCode} onChange={(e) => setClient({ ...client, zipCode: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Foto do CPF *</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCpfPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Foto do RG *</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setRgPhoto(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Portabilidade</h3>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="portability" checked={isPortability} onChange={(e) => setIsPortability(e.target.checked)} />
              <Label htmlFor="portability">Venda com portabilidade</Label>
            </div>
            {isPortability && (
              <Input value={portabilityNumber} onChange={(e) => setPortabilityNumber(e.target.value)} placeholder="Número para portabilidade" />
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Registrar venda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateSaleButton({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Nova Venda
      </Button>
      <CreateSaleDialog open={open} onOpenChange={setOpen} onSuccess={onSuccess} />
    </>
  );
}
