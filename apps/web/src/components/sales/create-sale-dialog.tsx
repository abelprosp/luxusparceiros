'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
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
import {
  DigitCountdownInput,
  formatCepDigits,
  formatCpfDigits,
  formatPhoneDigits,
  formatRgValue,
} from './digit-countdown-input';

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

interface PreviousSale {
  id: string;
  protocol: string;
  createdAt: string;
  value: number | string;
  newNumber?: string | null;
  simType?: 'CHIP' | 'ESIM';
  isVirginChip: boolean;
  chipIccid?: string | null;
  deviceImei?: string | null;
  deviceEid?: string | null;
  devicePlatform?: 'IOS' | 'ANDROID' | null;
  contractFormat?: ContractFormat | null;
  isPortability: boolean;
  portabilityNumber?: string | null;
  donorOperator?: DonorOperator | null;
  branchId?: string | null;
  operatorId: string;
  planId: string;
  operator?: { name: string };
  plan?: { name: string; price?: number };
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
  documents: { id: string; name: string; type: DocumentType }[];
}

const PREVIOUS_DOC_LABELS: Record<string, string> = {
  [DocumentType.CPF]: 'Foto do CPF',
  [DocumentType.RG]: 'Foto do RG',
  [DocumentType.CHIP_PHOTO]: 'Foto do chip',
  [DocumentType.DEVICE_SCREEN]: 'Foto da tela do aparelho',
  [DocumentType.CONTRACT]: 'Contrato',
  [DocumentType.OTHER]: 'Anexo',
};

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
  const [simType, setSimType] = useState<'CHIP' | 'ESIM'>('CHIP');
  const [deviceImei, setDeviceImei] = useState('');
  const [deviceEid, setDeviceEid] = useState('');
  const [devicePlatform, setDevicePlatform] = useState<'IOS' | 'ANDROID' | ''>('');
  const [screenPhoto, setScreenPhoto] = useState<File | null>(null);
  const [chipIccid, setChipIccid] = useState('');
  const [chipPhoto, setChipPhoto] = useState<File | null>(null);
  const [cpfPhoto, setCpfPhoto] = useState<File | null>(null);
  const [rgPhoto, setRgPhoto] = useState<File | null>(null);
  const [contractFormat, setContractFormat] = useState<ContractFormat | ''>('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const validationRef = useRef<HTMLDivElement>(null);
  const [client, setClient] = useState(emptyClient);
  const [isPortability, setIsPortability] = useState(false);
  const [portabilityNumber, setPortabilityNumber] = useState('');
  const [donorOperator, setDonorOperator] = useState<DonorOperator | ''>('');
  const [isUpgrade, setIsUpgrade] = useState(false);
  const [upgradeCpf, setUpgradeCpf] = useState('');
  const [previousSales, setPreviousSales] = useState<PreviousSale[]>([]);
  const [upgradeSale, setUpgradeSale] = useState<PreviousSale | null>(null);
  const [searchingUpgrade, setSearchingUpgrade] = useState(false);

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
    setSimType('CHIP');
    setDeviceImei('');
    setDeviceEid('');
    setDevicePlatform('');
    setScreenPhoto(null);
    setChipIccid('');
    setChipPhoto(null);
    setCpfPhoto(null);
    setRgPhoto(null);
    setContractFormat('');
    setValidationErrors([]);
    setClient(emptyClient);
    setIsPortability(false);
    setPortabilityNumber('');
    setDonorOperator('');
    setIsUpgrade(false);
    setUpgradeCpf('');
    setPreviousSales([]);
    setUpgradeSale(null);
  };

  const hasPreviousDocument = (type: DocumentType) =>
    Boolean(upgradeSale?.documents.some((document) => document.type === type));

  const applyUpgradeSale = (sale: PreviousSale) => {
    setUpgradeSale(sale);
    setClient({
      name: sale.client.name ?? '',
      document: sale.client.document ?? '',
      rg: sale.client.rg ?? '',
      email: sale.client.email ?? '',
      phone: sale.client.phone ?? '',
      address: sale.client.address ?? '',
      addressNumber: sale.client.addressNumber ?? '',
      complement: sale.client.complement ?? '',
      neighborhood: sale.client.neighborhood ?? '',
      city: sale.client.city ?? '',
      state: sale.client.state ?? '',
      zipCode: (sale.client.zipCode ?? '').replace(/\D/g, ''),
    });
    setOperatorId(sale.operatorId);
    setPlanId(sale.planId);
    setValue(String(sale.plan?.price ?? sale.value ?? ''));
    setNewNumber((sale.newNumber ?? '').replace(/\D/g, ''));
    setSimType(sale.simType === 'ESIM' ? 'ESIM' : 'CHIP');
    setDeviceImei(sale.deviceImei ?? '');
    setDeviceEid(sale.deviceEid ?? '');
    setDevicePlatform(sale.devicePlatform ?? '');
    setIsVirginChip(Boolean(sale.isVirginChip));
    setChipIccid(sale.chipIccid ?? '');
    setChipPhoto(null);
    setScreenPhoto(null);
    setCpfPhoto(null);
    setRgPhoto(null);
    setContractFormat(sale.contractFormat ?? '');
    setIsPortability(Boolean(sale.isPortability));
    setPortabilityNumber((sale.portabilityNumber ?? '').replace(/\D/g, ''));
    setDonorOperator(sale.donorOperator ?? '');
    if (sale.branchId) setBranchId(sale.branchId);
  };

  const searchUpgradeSales = async () => {
    if (!partnerId) {
      toast({ title: 'Selecione o parceiro antes de buscar o CPF', variant: 'destructive' });
      return;
    }
    const digits = upgradeCpf.replace(/\D/g, '');
    if (digits.length !== 11) {
      toast({ title: 'Informe um CPF com 11 dígitos', variant: 'destructive' });
      return;
    }
    setSearchingUpgrade(true);
    try {
      const rows = await api<PreviousSale[]>(
        `/sales/previous?document=${digits}&partnerId=${encodeURIComponent(partnerId)}`,
      );
      setPreviousSales(rows);
      if (rows.length === 1) applyUpgradeSale(rows[0]);
      else setUpgradeSale(null);
      if (!rows.length) {
        toast({ title: 'Nenhuma venda encontrada para este CPF', variant: 'destructive' });
      }
    } catch (error) {
      toast({
        title: 'Não foi possível buscar o CPF',
        description: error instanceof Error ? error.message : 'Falha',
        variant: 'destructive',
      });
    } finally {
      setSearchingUpgrade(false);
    }
  };

  const handleSave = async () => {
    const errors: string[] = [];
    if (!partnerId) errors.push('Parceiro');
    if (!operatorId) errors.push('Operadora');
    if (!planId) errors.push('Plano');
    if (!newNumber.trim()) errors.push('Número da linha');
    else if (newNumber.replace(/\D/g, '').length < 10) errors.push('Linha com ao menos 10 dígitos');
    if (!contractFormat) errors.push('Formato do contrato');
    if (!client.name.trim()) errors.push('Nome do cliente');
    if (!client.document.trim()) errors.push('CPF do cliente');
    else if (client.document.replace(/\D/g, '').length !== 11) errors.push('CPF com 11 dígitos');
    if (!client.phone.trim()) errors.push('Telefone de contato');
    else if (client.phone.replace(/\D/g, '').length < 10) errors.push('Telefone com ao menos 10 dígitos');
    const isEsim = simType === 'ESIM';
    if (isUpgrade && !upgradeSale) errors.push('Venda anterior do upgrade');
    if (!isEsim && !chipPhoto && !hasPreviousDocument(DocumentType.CHIP_PHOTO)) errors.push('Foto do chip');
    if (isEsim && deviceImei.length !== 15) errors.push('IMEI com 15 dígitos');
    if (isEsim && deviceEid.length !== 32) errors.push('EID com 32 dígitos');
    if (isEsim && !devicePlatform) errors.push('iOS ou Android');
    if (isEsim && !screenPhoto && !hasPreviousDocument(DocumentType.DEVICE_SCREEN)) errors.push('Foto da tela do aparelho');
    if (!cpfPhoto && !hasPreviousDocument(DocumentType.CPF)) errors.push('Foto do CPF');
    if (!rgPhoto && !hasPreviousDocument(DocumentType.RG)) errors.push('Foto do RG');
    if (!isEsim && isVirginChip && !chipIccid) errors.push('ICCID do chip');
    if (isPortability && !donorOperator) errors.push('Operadora doadora');
    if (isPortability && !portabilityNumber.trim()) errors.push('Número a ser portado');
    else if (isPortability && portabilityNumber.replace(/\D/g, '').length < 10) errors.push('Número portado com ao menos 10 dígitos');
    if (client.rg.trim() && client.rg.replace(/[^0-9A-Za-z]/g, '').length < 7) {
      errors.push('RG com ao menos 7 caracteres');
    }
    if (client.state.trim() && client.state.replace(/[^A-Za-z]/g, '').length !== 2) {
      errors.push('UF com 2 letras');
    }
    if (client.zipCode.trim() && client.zipCode.replace(/\D/g, '').length !== 8) {
      errors.push('CEP com 8 dígitos');
    }
    if (errors.length) {
      setValidationErrors(errors);
      requestAnimationFrame(() => validationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      toast({ title: `${errors.length} campo(s) precisam de atenção`, description: errors.join(', '), variant: 'destructive' });
      return;
    }
    setValidationErrors([]);
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
    if (!isEsim && !chipPhoto && !hasPreviousDocument(DocumentType.CHIP_PHOTO)) {
      toast({ title: 'Anexe a foto do chip', variant: 'destructive' });
      return;
    }
    if (isEsim && deviceImei.length !== 15) {
      toast({ title: 'IMEI deve ter 15 dígitos', variant: 'destructive' });
      return;
    }
    if (isEsim && deviceEid.length !== 32) {
      toast({ title: 'EID do aparelho deve ter 32 dígitos', variant: 'destructive' });
      return;
    }
    if (isEsim && !devicePlatform) {
      toast({ title: 'Informe se o aparelho é iOS ou Android', variant: 'destructive' });
      return;
    }
    if (isEsim && !screenPhoto && !hasPreviousDocument(DocumentType.DEVICE_SCREEN)) {
      toast({ title: 'Anexe a foto da tela do aparelho', variant: 'destructive' });
      return;
    }
    if (!cpfPhoto && !hasPreviousDocument(DocumentType.CPF)) {
      toast({ title: 'Anexe a foto do CPF', variant: 'destructive' });
      return;
    }
    if (!rgPhoto && !hasPreviousDocument(DocumentType.RG)) {
      toast({ title: 'Anexe a foto do RG', variant: 'destructive' });
      return;
    }
    if (!isEsim && isVirginChip) {
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
    let createdSaleId: string | null = null;
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
          simType,
          deviceImei: isEsim ? deviceImei : undefined,
          deviceEid: isEsim ? deviceEid : undefined,
          devicePlatform: isEsim ? devicePlatform : undefined,
          isVirginChip: isEsim ? false : isVirginChip,
          chipIccid: isEsim ? undefined : (isVirginChip ? normalizeIccid(chipIccid) : normalizeIccid(chipIccid) || undefined),
          contractFormat,
          isPortability,
          isUpgrade: Boolean(upgradeSale),
          upgradeOfSaleId: upgradeSale?.id,
          portabilityNumber: isPortability ? portabilityNumber : undefined,
          donorOperator: isPortability ? donorOperator : undefined,
          client: {
            ...client,
            document: client.document.replace(/\D/g, ''),
            documentType: DocumentType.CPF,
          },
        },
      });
      createdSaleId = sale.id;

      const clientId = sale.client?.id;
      if (!isEsim && chipPhoto) {
        await uploadFile(chipPhoto, DocumentType.CHIP_PHOTO, { saleId: sale.id, clientId });
      }
      if (isEsim && screenPhoto) {
        await uploadFile(screenPhoto, DocumentType.DEVICE_SCREEN, { saleId: sale.id, clientId });
      }
      if (cpfPhoto) await uploadFile(cpfPhoto, DocumentType.CPF, { saleId: sale.id, clientId });
      if (rgPhoto) await uploadFile(rgPhoto, DocumentType.RG, { saleId: sale.id, clientId });
      await api(`/sales/${sale.id}/submit`, { method: 'POST' });
      toast({
        title: 'Venda enviada para análise',
        description: 'O administrador foi avisado e poderá revisar os dados.',
        variant: 'success',
      });
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      if (createdSaleId) {
        await api(`/sales/${createdSaleId}/discard-draft`, { method: 'POST' }).catch(() => undefined);
      }
      toast({ title: 'Erro', description: err instanceof Error ? err.message : 'Falha', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Nova Venda</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {validationErrors.length > 0 && (
            <div ref={validationRef} className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm" role="alert">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <AlertCircle className="h-4 w-4" /> Revise os campos destacados abaixo
              </div>
              <p className="mt-2 text-muted-foreground">{validationErrors.join(' · ')}</p>
            </div>
          )}
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
                      setPreviousSales([]);
                      setUpgradeSale(null);
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
              <div className="space-y-3 sm:col-span-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sale-upgrade"
                    checked={isUpgrade}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setIsUpgrade(checked);
                      if (!checked) {
                        setPreviousSales([]);
                        setUpgradeSale(null);
                      }
                    }}
                  />
                  <Label htmlFor="sale-upgrade">Upgrade</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use quando o cliente já tem uma linha e vai aumentar ou diminuir o plano. Os dados e os anexos da venda anterior são trazidos, e o plano pode ser trocado.
                </p>
                {isUpgrade && (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1 space-y-2">
                        <Label>CPF da venda anterior *</Label>
                        <DigitCountdownInput
                          value={upgradeCpf}
                          onChange={setUpgradeCpf}
                          requiredDigits={11}
                          formatDisplay={formatCpfDigits}
                          hintLabel="CPF"
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <Button type="button" variant="outline" onClick={() => void searchUpgradeSales()} disabled={searchingUpgrade}>
                        {searchingUpgrade ? 'Buscando...' : 'Buscar'}
                      </Button>
                    </div>
                    {previousSales.length > 1 && (
                      <div className="space-y-2">
                        {previousSales.map((sale) => (
                          <button
                            key={sale.id}
                            type="button"
                            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${upgradeSale?.id === sale.id ? 'border-primary bg-primary/10' : ''}`}
                            onClick={() => applyUpgradeSale(sale)}
                          >
                            <span className="font-medium">{sale.plan?.name ?? 'Plano'}</span>
                            <span className="text-muted-foreground"> · {sale.protocol} · {sale.operator?.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {upgradeSale && (
                      <div className="space-y-1 text-sm">
                        <p>
                          Venda anterior: <span className="font-medium">{upgradeSale.protocol}</span>
                          {upgradeSale.plan?.name ? ` · plano ${upgradeSale.plan.name}` : ''}. Troque o plano abaixo.
                        </p>
                        {upgradeSale.documents.length > 0 && (
                          <ul className="text-xs text-muted-foreground">
                            {upgradeSale.documents.map((document) => (
                              <li key={document.id}>
                                {PREVIOUS_DOC_LABELS[document.type] ?? 'Anexo'}: {document.name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                <DigitCountdownInput
                  value={newNumber}
                  onChange={setNewNumber}
                  requiredDigits={10}
                  maxDigits={11}
                  formatDisplay={formatPhoneDigits}
                  hintLabel="telefone da linha"
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Tipo de ativação *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={simType === 'CHIP' ? 'default' : 'outline'}
                    onClick={() => {
                      setSimType('CHIP');
                      setDeviceImei('');
                      setDeviceEid('');
                      setDevicePlatform('');
                      setScreenPhoto(null);
                    }}
                  >
                    Chip
                  </Button>
                  <Button
                    type="button"
                    variant={simType === 'ESIM' ? 'default' : 'outline'}
                    onClick={() => {
                      setSimType('ESIM');
                      setIsVirginChip(false);
                      setChipIccid('');
                      setChipPhoto(null);
                    }}
                  >
                    eSIM
                  </Button>
                </div>
                {simType === 'ESIM' && (
                  <p className="text-xs text-muted-foreground">
                    O QR Code do eSIM entra como anexo no Luxus Task. Quando o arquivo chegar, aparece um aviso para abrir os anexos da venda.
                  </p>
                )}
              </div>
              {simType === 'ESIM' && (
              <>
              <div className="space-y-2">
                <Label>IMEI *</Label>
                <DigitCountdownInput
                  value={deviceImei}
                  onChange={setDeviceImei}
                  requiredDigits={15}
                  maxDigits={15}
                  hintLabel="IMEI"
                  placeholder="15 dígitos"
                />
              </div>
              <div className="space-y-2">
                <Label>EID do aparelho *</Label>
                <DigitCountdownInput
                  value={deviceEid}
                  onChange={setDeviceEid}
                  requiredDigits={32}
                  maxDigits={32}
                  hintLabel="EID"
                  placeholder="32 dígitos"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>iOS ou Android *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={devicePlatform === 'IOS' ? 'default' : 'outline'}
                    onClick={() => setDevicePlatform('IOS')}
                  >
                    iOS
                  </Button>
                  <Button
                    type="button"
                    variant={devicePlatform === 'ANDROID' ? 'default' : 'outline'}
                    onClick={() => setDevicePlatform('ANDROID')}
                  >
                    Android
                  </Button>
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Foto da tela do aparelho {hasPreviousDocument(DocumentType.DEVICE_SCREEN) ? '' : '*'}</Label>
                {hasPreviousDocument(DocumentType.DEVICE_SCREEN) ? (
                  <p className="text-xs text-muted-foreground">
                    A foto da venda anterior será usada: {upgradeSale?.documents.find((document) => document.type === DocumentType.DEVICE_SCREEN)?.name}
                  </p>
                ) : (
                <Input
                  type="file"
                  accept="*/*"
                  onChange={(e) => setScreenPhoto(e.target.files?.[0] ?? null)}
                />
                )}
                <p className="text-xs text-muted-foreground">
                  Foto da tela Sobre do celular, onde aparecem o IMEI e o EID.
                </p>
              </div>
              </>
              )}
              {simType === 'CHIP' && (
              <>
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
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="flex-1">
                      <DigitCountdownInput
                        value={chipIccid}
                        onChange={(digits) => setChipIccid(normalizeIccid(digits))}
                        requiredDigits={19}
                        maxDigits={22}
                        hintLabel="ICCID (começa com 89)"
                        placeholder="8955..."
                      />
                    </div>
                    <IccidScanner value={chipIccid} onScan={setChipIccid} />
                  </div>
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label>Foto do chip {hasPreviousDocument(DocumentType.CHIP_PHOTO) ? '' : '*'}</Label>
                {hasPreviousDocument(DocumentType.CHIP_PHOTO) ? (
                  <p className="text-xs text-muted-foreground">
                    A foto da venda anterior será usada: {upgradeSale?.documents.find((document) => document.type === DocumentType.CHIP_PHOTO)?.name}
                  </p>
                ) : (
                <Input
                  type="file"
                  accept="*/*"
                  onChange={(e) => setChipPhoto(e.target.files?.[0] ?? null)}
                />
                )}
              </div>
              </>
              )}
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
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-primary/30 bg-primary/10 p-4">
            <div>
              <h3 className="text-sm font-semibold">Assinatura do contrato</h3>
              <p className="text-xs text-muted-foreground">
                Não é obrigatório anexar o contrato assinado nesta etapa. Depois da criação, use a aba Documentos da venda ou o Luxus Task.
              </p>
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
                <DigitCountdownInput
                  value={client.document}
                  onChange={(digits) => setClient({ ...client, document: digits })}
                  requiredDigits={11}
                  formatDisplay={formatCpfDigits}
                  hintLabel="CPF"
                />
              </div>
              <div className="space-y-2">
                <Label>RG</Label>
                <DigitCountdownInput
                  value={client.rg}
                  onChange={(value) => setClient({ ...client, rg: value })}
                  requiredDigits={7}
                  maxDigits={11}
                  charset="alphanumeric"
                  formatDisplay={formatRgValue}
                  hintLabel="RG (mín. 7; até 9 ou CIN)"
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefone de contato *</Label>
                <DigitCountdownInput
                  value={client.phone}
                  onChange={(digits) => setClient({ ...client, phone: digits })}
                  requiredDigits={10}
                  maxDigits={11}
                  formatDisplay={formatPhoneDigits}
                  hintLabel="diferente da linha"
                  placeholder="Diferente da linha"
                />
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
                <DigitCountdownInput
                  value={client.state}
                  onChange={(value) => setClient({ ...client, state: value })}
                  requiredDigits={2}
                  charset="letters"
                  hintLabel="UF"
                  placeholder="RS"
                />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <DigitCountdownInput
                  value={client.zipCode}
                  onChange={(digits) => setClient({ ...client, zipCode: digits })}
                  requiredDigits={8}
                  formatDisplay={formatCepDigits}
                  hintLabel="CEP"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Foto do CPF {hasPreviousDocument(DocumentType.CPF) ? '' : '*'}</Label>
                {hasPreviousDocument(DocumentType.CPF) ? (
                  <p className="text-xs text-muted-foreground">
                    A foto da venda anterior será usada: {upgradeSale?.documents.find((document) => document.type === DocumentType.CPF)?.name}
                  </p>
                ) : (
                <Input
                  type="file"
                  accept="*/*"
                  onChange={(e) => setCpfPhoto(e.target.files?.[0] ?? null)}
                />
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Foto do RG {hasPreviousDocument(DocumentType.RG) ? '' : '*'}</Label>
                {hasPreviousDocument(DocumentType.RG) ? (
                  <p className="text-xs text-muted-foreground">
                    A foto da venda anterior será usada: {upgradeSale?.documents.find((document) => document.type === DocumentType.RG)?.name}
                  </p>
                ) : (
                <Input
                  type="file"
                  accept="*/*"
                  onChange={(e) => setRgPhoto(e.target.files?.[0] ?? null)}
                />
                )}
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
                  <DigitCountdownInput
                    value={portabilityNumber}
                    onChange={setPortabilityNumber}
                    requiredDigits={10}
                    maxDigits={11}
                    formatDisplay={formatPhoneDigits}
                    hintLabel="número portado"
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
            {saving ? 'Enviando...' : 'Enviar para análise'}
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
