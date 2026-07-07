import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import type { ApiResponse } from '@luxus/types';
import { branchesApi, type BranchItem } from '@/services/api';
import { Button, Input } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { spacing } from '@/theme';

export default function EditarFilialScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [branch, setBranch] = useState<BranchItem | null>(null);
  const [form, setForm] = useState({
    name: '',
    document: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    if (!id) return;
    branchesApi.get(id).then((r: ApiResponse<BranchItem>) => {
      if (r.success && r.data) {
        const b = r.data as BranchItem;
        setBranch(b);
        setForm({
          name: b.name,
          document: b.document,
          email: b.email,
          phone: b.phone,
          address: b.address ?? '',
          city: b.city ?? '',
          state: b.state ?? '',
        });
      }
    });
  }, [id]);

  const handleSubmit = async () => {
    if (!id) return;
    setLoading(true);
    try {
      await branchesApi.update(id, form);
      Alert.alert('Sucesso', 'Filial atualizada', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao atualizar');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = () => {
    if (!id || branch?.status === 'INACTIVE') return;
    Alert.alert('Desativar filial', 'A filial ficará inativa e não poderá receber novas vendas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desativar',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await branchesApi.update(id, { status: 'INACTIVE' });
            Alert.alert('Sucesso', 'Filial desativada', [{ text: 'OK', onPress: () => router.back() }]);
          } catch (err) {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao desativar');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    if (!id) return;
    const hasLinks = (branch?._count?.sales ?? 0) > 0 || (branch?._count?.clients ?? 0) > 0;
    if (hasLinks) {
      Alert.alert(
        'Não é possível excluir',
        'Esta filial possui vendas ou clientes vinculados. Desative-a em vez de excluir.',
      );
      return;
    }
    Alert.alert('Excluir filial', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await branchesApi.delete(id);
            Alert.alert('Sucesso', 'Filial excluída', [{ text: 'OK', onPress: () => router.back() }]);
          } catch (err) {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao excluir');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Editar Filial" showBack />

          <Input label="Nome" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
          <Input label="Documento" value={form.document} onChangeText={(v) => setForm({ ...form, document: v })} />
          <Input label="E-mail" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} />
          <Input label="Telefone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} />
          <Input label="Endereço" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} />
          <Input label="Cidade" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
          <Input label="UF" value={form.state} onChangeText={(v) => setForm({ ...form, state: v })} maxLength={2} autoCapitalize="characters" />

          <Button title="Salvar alterações" onPress={handleSubmit} loading={loading} fullWidth />

          {branch?.status === 'ACTIVE' && (
            <View style={styles.actions}>
              <Button
                title="Desativar filial"
                variant="outline"
                onPress={handleDeactivate}
                loading={loading}
                fullWidth
              />
            </View>
          )}

          <View style={styles.actions}>
            <Button
              title="Excluir filial"
              variant="danger"
              onPress={handleDelete}
              loading={loading}
              fullWidth
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  actions: { marginTop: spacing.sm },
});
