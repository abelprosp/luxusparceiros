import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Alert, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RequestType } from '@luxus/types';
import { useTheme } from '@/contexts/ThemeContext';
import { requestsApi, clientsApi, type Client } from '@/services/api';
import { Button, Input } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { REQUEST_TYPE_LABELS } from '@/utils/labels';
import { spacing, typography, radius } from '@/theme';

const REQUEST_TYPES = Object.values(RequestType);

export default function NovaSolicitacaoScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<RequestType>(RequestType.NEW_ACTIVATION);
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    clientsApi.list({ limit: 50 }).then((r) => r.success && r.data && setClients(r.data.data));
  }, []);

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Atenção', 'Descreva a solicitação');
      return;
    }
    setLoading(true);
    try {
      const response = await requestsApi.create({ type, description, clientId: clientId || undefined });
      if (response.success) {
        Alert.alert('Sucesso', 'Solicitação criada', [{ text: 'OK', onPress: () => router.back() }]);
      }
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao criar solicitação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Nova Solicitação" showBack />

          <Text style={[styles.label, { color: colors.text }]}>Tipo</Text>
          <View style={styles.types}>
            {REQUEST_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeChip, { backgroundColor: type === t ? colors.primary : colors.surface, borderColor: type === t ? colors.primary : colors.border }]}
                onPress={() => setType(t)}
              >
                <Text style={{ color: type === t ? '#FFF' : colors.text, ...typography.caption, fontSize: 11 }}>
                  {REQUEST_TYPE_LABELS[t]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Cliente (opcional)</Text>
          <View style={styles.clients}>
            {clients.slice(0, 10).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.clientChip, { backgroundColor: clientId === c.id ? `${colors.primary}20` : colors.surface, borderColor: clientId === c.id ? colors.primary : colors.border }]}
                onPress={() => setClientId(clientId === c.id ? '' : c.id)}
              >
                <Text style={{ color: colors.text, ...typography.caption }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input label="Descrição *" value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholder="Descreva o que precisa..." />

          <Button title="Enviar solicitação" onPress={handleSubmit} loading={loading} fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  label: { ...typography.label, fontWeight: '600' },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1 },
  clients: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  clientChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.md, borderWidth: 1 },
});
