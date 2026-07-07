import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { validateCPF, validateCNPJ } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { clientsApi } from '@/services/api';
import { Button, Input } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { spacing } from '@/theme';

export default function NovoClienteScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    document: '',
    documentType: 'CPF',
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
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Nome é obrigatório';
    if (!form.document.trim()) newErrors.document = 'Documento é obrigatório';
    else if (form.documentType === 'CPF' && !validateCPF(form.document)) {
      newErrors.document = 'CPF inválido';
    } else if (form.documentType === 'CNPJ' && !validateCNPJ(form.document)) {
      newErrors.document = 'CNPJ inválido';
    }
    if (!form.phone.trim()) newErrors.phone = 'Telefone de contato é obrigatório';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const response = await clientsApi.create(form);
      if (response.success && response.data) {
        Alert.alert('Sucesso', 'Cliente cadastrado com sucesso', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Novo Cliente" subtitle="Cadastre um novo cliente" showBack />

          <Input label="Nome completo *" value={form.name} onChangeText={(v) => update('name', v)} error={errors.name} />
          <Input label="CPF/CNPJ *" value={form.document} onChangeText={(v) => update('document', v)} keyboardType="numeric" error={errors.document} />
          <Input label="RG" value={form.rg} onChangeText={(v) => update('rg', v)} />
          <Input label="Telefone de contato *" value={form.phone} onChangeText={(v) => update('phone', v)} keyboardType="phone-pad" error={errors.phone} placeholder="Diferente da linha vendida" />
          <Input label="E-mail" value={form.email} onChangeText={(v) => update('email', v)} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Endereço" value={form.address} onChangeText={(v) => update('address', v)} />
          <Input label="Número" value={form.addressNumber} onChangeText={(v) => update('addressNumber', v)} />
          <Input label="Complemento" value={form.complement} onChangeText={(v) => update('complement', v)} />
          <Input label="Bairro" value={form.neighborhood} onChangeText={(v) => update('neighborhood', v)} />
          <Input label="Cidade" value={form.city} onChangeText={(v) => update('city', v)} />
          <Input label="Estado" value={form.state} onChangeText={(v) => update('state', v)} maxLength={2} autoCapitalize="characters" />
          <Input label="CEP" value={form.zipCode} onChangeText={(v) => update('zipCode', v)} keyboardType="numeric" />
          <Input label="Observações" value={form.notes} onChangeText={(v) => update('notes', v)} multiline numberOfLines={3} />

          <Button title="Cadastrar cliente" onPress={handleSubmit} loading={loading} fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
});
