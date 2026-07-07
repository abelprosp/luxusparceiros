import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { branchesApi } from '@/services/api';
import { Button, Input } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { spacing } from '@/theme';

export default function NovaFilialScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    document: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
  });

  const handleSubmit = async () => {
    if (!form.name || !form.document || !form.email || !form.phone) {
      Alert.alert('Atenção', 'Preencha nome, documento, e-mail e telefone');
      return;
    }
    if (!user?.partnerId) {
      Alert.alert('Erro', 'Parceiro não identificado');
      return;
    }
    setLoading(true);
    try {
      const response = await branchesApi.create(form);
      if (response.success) {
        Alert.alert('Sucesso', 'Filial criada', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao criar filial');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Nova Filial" showBack />

          <Input label="Nome *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Input label="Documento *" value={form.document} onChangeText={(v) => setForm({ ...form, document: v })} />
          <Input label="E-mail *" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Telefone *" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
          <Input label="Endereço" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} />
          <Input label="Cidade" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
          <Input label="UF" value={form.state} onChangeText={(v) => setForm({ ...form, state: v })} maxLength={2} autoCapitalize="characters" />

          <Button title="Salvar filial" onPress={handleSubmit} loading={loading} fullWidth />
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
