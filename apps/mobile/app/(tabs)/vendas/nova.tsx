import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Check, ChevronRight } from 'lucide-react-native';
import { ContractFormat, DocumentType } from '@luxus/types';
import { validateCPF } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import {
  salesApi,
  uploadsApi,
  operatorsApi,
  plansApi,
  type Operator,
  type Plan,
} from '@/services/api';
import { Button, Input, Card } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatCommission } from '@luxus/utils';
import { spacing, typography, radius } from '@/theme';

const STEPS = ['Linha vendida', 'Cliente', 'Portabilidade', 'Finalizar'];

type PhotoAsset = { uri: string; name: string; mimeType?: string };

export default function NovaVendaScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [operators, setOperators] = useState<Operator[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const [operatorId, setOperatorId] = useState('');
  const [planId, setPlanId] = useState('');
  const [value, setValue] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [isVirginChip, setIsVirginChip] = useState(true);
  const [chipIccid, setChipIccid] = useState('');
  const [linePhoto, setLinePhoto] = useState<PhotoAsset | null>(null);
  const [chipPhoto, setChipPhoto] = useState<PhotoAsset | null>(null);
  const [cpfPhoto, setCpfPhoto] = useState<PhotoAsset | null>(null);
  const [rgPhoto, setRgPhoto] = useState<PhotoAsset | null>(null);
  const [contractFile, setContractFile] = useState<PhotoAsset | null>(null);
  const [contractFormat, setContractFormat] = useState<ContractFormat | ''>('');

  const [clientForm, setClientForm] = useState({
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
  });

  const [isPortability, setIsPortability] = useState(false);
  const [portabilityNumber, setPortabilityNumber] = useState('');

  useEffect(() => {
    operatorsApi.list().then((r) => r.success && r.data && setOperators(r.data));
  }, []);

  useEffect(() => {
    if (operatorId) {
      plansApi.list(operatorId).then((r) => {
        if (r.success && r.data) setPlans(r.data);
      });
    } else {
      setPlans([]);
    }
  }, [operatorId]);

  const pickContractFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setContractFile({
        uri: asset.uri,
        name: asset.name ?? 'contrato.pdf',
        mimeType: asset.mimeType ?? 'application/pdf',
      });
    }
  };

  const pickPhoto = async (target: 'line' | 'chip' | 'cpf' | 'rg' | 'contract') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      const names: Record<typeof target, string> = {
        line: 'linha.jpg',
        chip: 'chip.jpg',
        cpf: 'cpf.jpg',
        rg: 'rg.jpg',
        contract: 'contrato.jpg',
      };
      const asset = { uri: result.assets[0].uri, name: names[target], mimeType: 'image/jpeg' };
      if (target === 'line') setLinePhoto(asset);
      else if (target === 'chip') setChipPhoto(asset);
      else if (target === 'cpf') setCpfPhoto(asset);
      else if (target === 'rg') setRgPhoto(asset);
      else setContractFile(asset);
    }
  };

  const takePhoto = async (target: 'line' | 'chip' | 'cpf' | 'rg' | 'contract') => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão', 'É necessário permitir acesso à câmera');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
    if (!result.canceled && result.assets[0]) {
      const names: Record<typeof target, string> = {
        line: 'linha-foto.jpg',
        chip: 'chip-foto.jpg',
        cpf: 'cpf-foto.jpg',
        rg: 'rg-foto.jpg',
        contract: 'contrato-foto.jpg',
      };
      const asset = { uri: result.assets[0].uri, name: names[target], mimeType: 'image/jpeg' };
      if (target === 'line') setLinePhoto(asset);
      else if (target === 'chip') setChipPhoto(asset);
      else if (target === 'cpf') setCpfPhoto(asset);
      else if (target === 'rg') setRgPhoto(asset);
      else setContractFile(asset);
    }
  };

  const validateStep = () => {
    if (step === 0) {
      if (!operatorId || !planId || !newNumber.trim()) {
        Alert.alert('Atenção', 'Preencha operadora, plano e número da linha');
        return false;
      }
      if (!contractFormat) {
        Alert.alert('Atenção', 'Selecione o formato do contrato');
        return false;
      }
      if (!chipPhoto) {
        Alert.alert('Atenção', 'Anexe a foto do chip');
        return false;
      }
      if (isVirginChip && !chipIccid.trim()) {
        Alert.alert('Atenção', 'Informe o ICCID do chip virgem');
        return false;
      }
      if (!contractFile) {
        Alert.alert('Atenção', 'Anexe o contrato assinado');
        return false;
      }
    }
    if (step === 1) {
      if (!clientForm.name.trim() || !clientForm.document.trim() || !clientForm.phone.trim()) {
        Alert.alert('Atenção', 'Preencha nome, CPF e telefone de contato do cliente');
        return false;
      }
      if (!cpfPhoto) {
        Alert.alert('Atenção', 'Anexe a foto do CPF do cliente');
        return false;
      }
      if (!rgPhoto) {
        Alert.alert('Atenção', 'Anexe a foto do RG do cliente');
        return false;
      }
      if (!validateCPF(clientForm.document.replace(/\D/g, ''))) {
        Alert.alert('Atenção', 'CPF inválido');
        return false;
      }
      const lineDigits = newNumber.replace(/\D/g, '');
      const phoneDigits = clientForm.phone.replace(/\D/g, '');
      if (lineDigits && phoneDigits && lineDigits === phoneDigits) {
        Alert.alert('Atenção', 'Telefone de contato deve ser diferente da linha vendida');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!operatorId || !planId || !newNumber || !contractFormat || !chipPhoto || !cpfPhoto || !rgPhoto || !contractFile) {
      Alert.alert('Atenção', 'Preencha todos os campos e anexe as fotos e o contrato');
      return;
    }
    if (isVirginChip && !chipIccid.trim()) {
      Alert.alert('Atenção', 'Informe o ICCID do chip virgem');
      return;
    }
    setLoading(true);
    try {
      const response = await salesApi.create({
        operatorId,
        planId,
        value: parseFloat(value) || plans.find((p) => p.id === planId)?.price || 0,
        newNumber,
        isVirginChip,
        chipIccid: isVirginChip ? chipIccid.trim() : chipIccid.trim() || undefined,
        contractFormat,
        isPortability,
        portabilityNumber: isPortability ? portabilityNumber : undefined,
        client: {
          name: clientForm.name,
          document: clientForm.document.replace(/\D/g, ''),
          documentType: 'CPF',
          rg: clientForm.rg || undefined,
          email: clientForm.email || undefined,
          phone: clientForm.phone,
          address: clientForm.address || undefined,
          addressNumber: clientForm.addressNumber || undefined,
          complement: clientForm.complement || undefined,
          neighborhood: clientForm.neighborhood || undefined,
          city: clientForm.city || undefined,
          state: clientForm.state || undefined,
          zipCode: clientForm.zipCode || undefined,
        },
      });

      if (response.success && response.data) {
        const saleId = response.data.id;
        const clientId = response.data.client?.id;

        if (linePhoto) {
          await uploadsApi.upload({
            uri: linePhoto.uri,
            name: linePhoto.name,
            type: DocumentType.LINE_PHOTO,
            saleId,
            clientId,
          });
        }
        await uploadsApi.upload({
          uri: chipPhoto.uri,
          name: chipPhoto.name,
          type: DocumentType.CHIP_PHOTO,
          saleId,
          clientId,
        });
        await uploadsApi.upload({
          uri: cpfPhoto.uri,
          name: cpfPhoto.name,
          type: DocumentType.CPF,
          saleId,
          clientId,
        });
        await uploadsApi.upload({
          uri: rgPhoto.uri,
          name: rgPhoto.name,
          type: DocumentType.RG,
          saleId,
          clientId,
        });
        await uploadsApi.upload({
          uri: contractFile.uri,
          name: contractFile.name,
          mimeType: contractFile.mimeType,
          type: DocumentType.CONTRACT,
          saleId,
          clientId,
        });

        Alert.alert('Sucesso', 'Venda registrada com sucesso', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao registrar venda');
    } finally {
      setLoading(false);
    }
  };

  const renderPhotoBlock = (
    label: string,
    photo: PhotoAsset | null,
    target: 'line' | 'chip' | 'cpf' | 'rg' | 'contract',
    required = false,
    showPdfPicker = false,
  ) => (
    <View style={styles.photoBlock}>
      <Text style={[styles.photoLabel, { color: colors.text }]}>
        {label}
        {required ? ' *' : ''}
      </Text>
      {photo ? (
        <View style={styles.photoPreview}>
          {photo.mimeType?.startsWith('image/') !== false &&
          !photo.name.toLowerCase().endsWith('.pdf') ? (
            <Image source={{ uri: photo.uri }} style={styles.photoImage} />
          ) : (
            <Text style={[styles.photoName, { color: colors.text }]}>{photo.name}</Text>
          )}
          <Text style={[styles.photoName, { color: colors.success }]}>Arquivo anexado</Text>
        </View>
      ) : null}
      <View style={styles.photoActions}>
        <Button title="Galeria" variant="outline" size="sm" onPress={() => pickPhoto(target)} />
        <Button title="Câmera" variant="outline" size="sm" onPress={() => takePhoto(target)} />
        {showPdfPicker && (
          <Button title="PDF" variant="outline" size="sm" onPress={pickContractFile} />
        )}
      </View>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Dados da linha vendida</Text>
            {operators.map((op) => (
              <SelectItem
                key={op.id}
                label={op.name}
                selected={operatorId === op.id}
                onPress={() => { setOperatorId(op.id); setPlanId(''); setValue(''); }}
                colors={colors}
              />
            ))}
            {operatorId && plans.map((plan) => (
              <SelectItem
                key={plan.id}
                label={`${plan.name} — R$ ${plan.price}`}
                subtitle={`Comissão: ${plan.commissionType ? formatCommission(plan.commissionType, Number(plan.commissionValue ?? plan.commission)) : `${plan.commission}%`}`}
                selected={planId === plan.id}
                onPress={() => { setPlanId(plan.id); setValue(String(plan.price)); }}
                colors={colors}
              />
            ))}
            <Input label="Valor (R$) *" value={value} onChangeText={setValue} keyboardType="decimal-pad" />
            <Input label="Número da linha *" value={newNumber} onChangeText={setNewNumber} keyboardType="phone-pad" placeholder="(11) 99999-9999" />
            {renderPhotoBlock('Foto da linha', linePhoto, 'line')}
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Chip virgem</Text>
              <Switch value={isVirginChip} onValueChange={setIsVirginChip} trackColor={{ true: colors.primary }} />
            </View>
            {isVirginChip && (
              <Input label="ICCID do chip *" value={chipIccid} onChangeText={setChipIccid} placeholder="8955..." />
            )}
            {renderPhotoBlock('Foto do chip', chipPhoto, 'chip', true)}
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Formato do contrato *</Text>
            <SelectItem
              label="Impressão"
              subtitle="Contrato físico para assinatura"
              selected={contractFormat === ContractFormat.PRINT}
              onPress={() => setContractFormat(ContractFormat.PRINT)}
              colors={colors}
            />
            <SelectItem
              label="ZapSign"
              subtitle="Assinatura digital via ZapSign"
              selected={contractFormat === ContractFormat.ZAPSIGN}
              onPress={() => setContractFormat(ContractFormat.ZAPSIGN)}
              colors={colors}
            />
            {renderPhotoBlock('Contrato assinado', contractFile, 'contract', true, true)}
          </>
        );
      case 1:
        return (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Dados do cliente</Text>
            <Input label="Nome *" value={clientForm.name} onChangeText={(v) => setClientForm({ ...clientForm, name: v })} />
            <Input label="CPF *" value={clientForm.document} onChangeText={(v) => setClientForm({ ...clientForm, document: v })} keyboardType="numeric" />
            <Input label="RG" value={clientForm.rg} onChangeText={(v) => setClientForm({ ...clientForm, rg: v })} />
            <Input label="E-mail" value={clientForm.email} onChangeText={(v) => setClientForm({ ...clientForm, email: v })} keyboardType="email-address" autoCapitalize="none" />
            <Input label="Telefone de contato *" value={clientForm.phone} onChangeText={(v) => setClientForm({ ...clientForm, phone: v })} keyboardType="phone-pad" placeholder="Diferente da linha vendida" />
            <Input label="Endereço" value={clientForm.address} onChangeText={(v) => setClientForm({ ...clientForm, address: v })} />
            <Input label="Número" value={clientForm.addressNumber} onChangeText={(v) => setClientForm({ ...clientForm, addressNumber: v })} />
            <Input label="Complemento" value={clientForm.complement} onChangeText={(v) => setClientForm({ ...clientForm, complement: v })} />
            <Input label="Bairro" value={clientForm.neighborhood} onChangeText={(v) => setClientForm({ ...clientForm, neighborhood: v })} />
            <Input label="Cidade" value={clientForm.city} onChangeText={(v) => setClientForm({ ...clientForm, city: v })} />
            <Input label="UF" value={clientForm.state} onChangeText={(v) => setClientForm({ ...clientForm, state: v })} maxLength={2} autoCapitalize="characters" />
            <Input label="CEP" value={clientForm.zipCode} onChangeText={(v) => setClientForm({ ...clientForm, zipCode: v })} keyboardType="numeric" />
            {renderPhotoBlock('Foto do CPF', cpfPhoto, 'cpf', true)}
            {renderPhotoBlock('Foto do RG', rgPhoto, 'rg', true)}
          </>
        );
      case 2:
        return (
          <>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Portabilidade</Text>
              <Switch value={isPortability} onValueChange={setIsPortability} trackColor={{ true: colors.primary }} />
            </View>
            {isPortability && (
              <Input label="Número para portabilidade" value={portabilityNumber} onChangeText={setPortabilityNumber} keyboardType="phone-pad" />
            )}
          </>
        );
      case 3:
        return (
          <View style={styles.summary}>
            <SummaryRow label="Linha" value={newNumber} colors={colors} />
            <SummaryRow label="Chip" value={isVirginChip ? `Virgem — ${chipIccid}` : chipIccid || 'Não virgem'} colors={colors} />
            <SummaryRow label="Plano" value={plans.find((p) => p.id === planId)?.name ?? '—'} colors={colors} />
            <SummaryRow label="Valor" value={`R$ ${value}`} colors={colors} />
            <SummaryRow label="Contrato" value={contractFormat === ContractFormat.ZAPSIGN ? 'ZapSign' : 'Impressão'} colors={colors} />
            <SummaryRow label="Cliente" value={clientForm.name} colors={colors} />
            <SummaryRow label="CPF" value={clientForm.document} colors={colors} />
            <SummaryRow label="Contato" value={clientForm.phone} colors={colors} />
            {linePhoto && <Text style={{ color: colors.success, ...typography.caption }}>✓ Foto da linha anexada</Text>}
            <Text style={{ color: colors.success, ...typography.caption }}>✓ Foto do chip anexada</Text>
            <Text style={{ color: colors.success, ...typography.caption }}>✓ Foto do CPF anexada</Text>
            <Text style={{ color: colors.success, ...typography.caption }}>✓ Foto do RG anexada</Text>
            <Text style={{ color: colors.success, ...typography.caption }}>✓ Contrato anexado</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Nova Venda" subtitle={`Passo ${step + 1} de ${STEPS.length}`} showBack />

          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <View key={s} style={styles.stepItem}>
                <View style={[styles.stepDot, { backgroundColor: i <= step ? colors.primary : colors.border }]}>
                  <Text style={styles.stepNum}>{i + 1}</Text>
                </View>
                <Text style={[styles.stepLabel, { color: i <= step ? colors.text : colors.textSecondary }]}>{s}</Text>
              </View>
            ))}
          </View>

          <Card title={STEPS[step]} noPadding={false}>
            <View style={styles.stepContent}>{renderStep()}</View>
          </Card>

          <View style={styles.nav}>
            {step > 0 && (
              <Button title="Voltar" variant="outline" onPress={() => setStep(step - 1)} style={styles.navBtn} />
            )}
            {step < 3 && (
              <Button
                title="Próximo"
                onPress={() => { if (validateStep()) setStep(step + 1); }}
                style={styles.navBtn}
              />
            )}
            {step === 3 && (
              <Button title="Registrar venda" onPress={handleSubmit} loading={loading} fullWidth />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SelectItem({
  label,
  subtitle,
  selected,
  onPress,
  colors,
}: {
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  colors: { text: string; textSecondary: string; primary: string; border: string; card: string };
}) {
  return (
    <TouchableOpacity
      style={[styles.selectItem, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? `${colors.primary}10` : colors.card }]}
      onPress={onPress}
    >
      <View style={styles.selectText}>
        <Text style={[styles.selectLabel, { color: colors.text }]}>{label}</Text>
        {subtitle && <Text style={[styles.selectSub, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      {selected ? <Check size={18} color={colors.primary} /> : <ChevronRight size={18} color={colors.textSecondary} />}
    </TouchableOpacity>
  );
}

function SummaryRow({ label, value, colors }: { label: string; value: string; colors: { text: string; textSecondary: string } }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stepItem: { alignItems: 'center', gap: 4, minWidth: 72 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  stepLabel: { ...typography.caption, fontSize: 10, textAlign: 'center' },
  stepContent: { gap: spacing.sm },
  sectionTitle: { ...typography.label, marginBottom: spacing.xs },
  fieldLabel: { ...typography.label, marginTop: spacing.sm },
  nav: { flexDirection: 'row', gap: spacing.sm },
  navBtn: { flex: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  switchLabel: { ...typography.label },
  selectItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm },
  selectText: { flex: 1 },
  selectLabel: { ...typography.label, fontWeight: '500' },
  selectSub: { ...typography.caption },
  photoBlock: { gap: spacing.sm, marginVertical: spacing.xs },
  photoLabel: { ...typography.label },
  photoPreview: { gap: spacing.xs },
  photoImage: { width: '100%', height: 120, borderRadius: radius.md },
  photoName: { ...typography.caption },
  photoActions: { flexDirection: 'row', gap: spacing.sm },
  summary: { gap: spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  summaryLabel: { ...typography.bodySmall },
  summaryValue: { ...typography.label, flex: 1, textAlign: 'right' },
});
