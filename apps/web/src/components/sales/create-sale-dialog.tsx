'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ContractFormat, DocumentType, DonorOperator } from '@luxus/types';
import { api, getPaginated, uploadFile } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { isPartnerScopedUser } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toaster';
import { IccidScanner, isValidIccid, normalizeIccid } from './iccid-scanner';

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

interface Branch {
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

const DONOR_OPERATORS: { value: DonorOperator; label: string }[] = [
  { value: DonorOperator.VIVO, label: 'Vivo' },
  { value: DonorOperator.TIM, label: 'TIM' },
  { value: DonorOperator.CLARO, label: 'Claro' },
  { value: DonorOperator.SURF, label: 'Surf' },
  { value: DonorOperator.OTHER, label: 'Outras' },
];

interface CreateSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateSaleDialog({ open, onOpenChange, onSuccess }: CreateSaleDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPartnerScoped = isPartnerScopedUser(user);
  const [saving, setSaving] = useState(false);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [partnerId, setPartnerId] = useState('');
  const [branchId, setBranchId] = useState('');
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
  const [donorOperator, setDonorOperator] = useState<DonorOperator | ''>('');

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      const results = await Promise.allSettled([
        getPaginated<Operator>('/operators', { limit: 100 }),
        ...(isPartnerScoped ? [] : [getPaginated<Partner>('/partners', { limit: 100 })]),
      ]);

      const [opsResult, ptsResult] = results;
      if (opsResult.status === 'fulfilled') {
        setOperators(opsResult.value.data);
      } else {
        setOperators([]);
      }
      if (!isPartnerScoped && ptsResult?.status === 'fulfilled') {
        setPartners(ptsResult.value.data);
      }
    };

    void load();

    if (isPartnerScoped) {
      if (user?.partnerId) {
        setPartnerId(user.partnerId);
        setBranchId(user.branchId ?? '');
      } else {
        toast({
          title: 'Conta sem parceiro vinculado',
          description: 'Peça ao administrador para vincular seu usuário a um parceiro.',
          variant: 'destructive',
        });
      }
    }
  }, [open, isPartnerScoped, user?.partnerId, user?.branchId, toast]);

  useEffect(() => {
    if (!open || !partnerId) {
      setBranches([]);
      return;
    }

    getPaginated<Branch>('/branches', { limit: 100, partnerId })
      .then((result) => {
        setBranches(result.data);
        if (user?.branchId) setBranchId(user.branchId);
      })
      .catch(() => setBranches([]));
  }, [open, partnerId, user?.branchId]);

  useEffect(() => {
    if (!open || !operatorId) {
      if (!operatorId) setPlans([]);
      return;
    }

    const plansPath = isPartnerScoped ? '/plans/available' : '/plans';
    getPaginated<Plan>(plansPath, { limit: 100, operatorId })
      .then((pls) => setPlans(pls.data))
      .catch(() => setPlans([]));
  }, [open, operatorId, isPartnerScoped]);

  const filteredPlans = plans.filter((p) => p.operatorId === operatorId);

  const reset = () => {
    setPartnerId(isPartnerScoped && user?.partnerId ? user.partnerId : '');
    setBranchId(user?.branchId ?? '');
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
    setDonorOperator('');
  };

  const handleSave = async () => {
    if (isPartnerScoped && !user?.partnerId) {
      toast({
        title: 'Conta sem parceiro vinculado',
        description: 'Não é possível registrar vendas sem vínculo com um parceiro.',
        variant: 'destructive',
      });
      return;
    }
    if (!partnerId || !operatorId || !planId || !newNumber || !contractFormat) {
      toast({ title: 'Preencha parceiro, operadora, plano, linha e formato do contrato', variant: 'destructive' });
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
    if (isVirginChip) {
      if (!chipIccid) {
        toast({ title: 'ICCID é obrigatório para chip virgem', variant: 'destructive' });
        return;
      }
      if (!isValidIccid(chipIccid)) {
        toast({
          title: 'ICCID inválido',
          description: 'O ICCID deve começar com 89 e ter de 19 a 22 dígitos.',
          variant: 'destructive',
        });
        return;
      }
    }
    if (isPortability && (!donorOperator || !portabilityNumber.trim())) {
      toast({
        title: 'Selecione a operadora doadora e informe o número a ser portado',
        variant: 'destructive',
      });
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
          branchId: branchId || undefined,
          operatorId,
          planId,
          value: parseFloat(value) || filteredPlans.find((p) => p.id === planId)?.price,
          newNumber,
          isVirginChip,
          chipIccid: isVirginChip ? normalizeIccid(chipIccid) : normalizeIccid(chipIccid) || undefined,
          contractFormat,
          isPortability,
          portabilityNumber: isPortability ? portabilityNumber : undefined,
          donorOperator: isPortability ? donorOperator : undefined,
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
      if (contractFile) {
        await uploadFile(contractFile, DocumentType.CONTRACT, { saleId: sale.id, clientId });
      }
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
              {!isPartnerScoped && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Parceiro *</Label>
                  <Select
                    value={partnerId}
                    onValueChange={(value) => {
                      setPartnerId(value);
                      setBranchId('');
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {partnerId && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Loja responsável</Label>
                  <Select
                    value={branchId || '__matrix'}
                    disabled={Boolean(user?.branchId)}
                    onValueChange={(value) => setBranchId(value === '__matrix' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a matriz ou uma filial" />
                    </SelectTrigger>
                    <SelectContent>
                      {!user?.branchId && <SelectItem value="__matrix">Matriz</SelectItem>}
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Somente lojas do parceiro selecionado são exibidas.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Operadora *</Label>
                <Select value={operatorId} onValueChange={(v) => { setOperatorId(v); setPlanId(''); setValue(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {operators.length === 0 ? (
                      <SelectItem value="__empty" disabled>Nenhuma operadora cadastrada</SelectItem>
                    ) : (
                      operators.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plano *</Label>
                <Select
                  value={planId}
                  disabled={!operatorId}
                  onValueChange={(v) => { setPlanId(v); const p = filteredPlans.find((x) => x.id === v); if (p) setValue(String(p.price)); }}
                >
                  <SelectTrigger><SelectValue placeholder={operatorId ? 'Selecione' : 'Escolha a operadora'} /></SelectTrigger>
                  <SelectContent>
                    {filteredPlans.length === 0 ? (
                      <SelectItem value="__empty" disabled>
                        {operatorId ? 'Nenhum plano para esta operadora' : 'Escolha a operadora primeiro'}
                      </SelectItem>
                    ) : (
                      filteredPlans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
                    )}
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
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={chipIccid}
                      onChange={(e) => setChipIccid(normalizeIccid(e.target.value))}
                      placeholder="8955..."
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={22}
                    />
                    <IccidScanner value={chipIccid} onScan={setChipIccid} />
                  </div>
                  <p className="text-xs text-muted-foreground">Deve começar com 89 e ter de 19 a 22 dígitos.</p>
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
                <Label>Contrato assinado (opcional no cadastro)</Label>
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setContractFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  Foto do contrato impresso ou PDF do ZapSign. Obrigatório antes de aprovar a venda.
                </p>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Operadora doadora *</Label>
                  <Select
                    value={donorOperator}
                    onValueChange={(value) => setDonorOperator(value as DonorOperator)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a operadora" />
                    </SelectTrigger>
                    <SelectContent>
                      {DONOR_OPERATORS.map((operator) => (
                        <SelectItem key={operator.value} value={operator.value}>
                          {operator.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Número a ser portado *</Label>
                  <Input
                    value={portabilityNumber}
                    onChange={(e) => setPortabilityNumber(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
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
