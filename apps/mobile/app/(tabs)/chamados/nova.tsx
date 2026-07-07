import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TicketCategory, TicketPriority } from '@luxus/types';
import { useTheme } from '@/contexts/ThemeContext';
import { ticketsApi } from '@/services/api';
import { Button, Input } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TICKET_CATEGORY_LABELS, TICKET_PRIORITY_LABELS } from '@/utils/labels';
import { spacing, typography, radius } from '@/theme';

const CATEGORIES = Object.values(TicketCategory);
const PRIORITIES = Object.values(TicketPriority);

export default function NovoChamadoScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>(TicketCategory.SUPPORT);
  const [priority, setPriority] = useState<TicketPriority>(TicketPriority.MEDIUM);

  const handleSubmit = async () => {
    if (!subject.trim()) {
      Alert.alert('Atenção', 'Informe o assunto do chamado');
      return;
    }
    setLoading(true);
    try {
      const response = await ticketsApi.create({ subject, category, priority });
      if (response.success && response.data) {
        Alert.alert('Sucesso', 'Chamado criado', [
          { text: 'Ver chamado', onPress: () => router.replace(`/(tabs)/chamados/${response.data!.id}` as never) },
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao criar chamado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Novo Chamado" showBack />

          <Input label="Assunto *" value={subject} onChangeText={setSubject} placeholder="Descreva brevemente o problema" />

          <Text style={[styles.label, { color: colors.text }]}>Categoria</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.chip,
                  {
                    backgroundColor: category === c ? colors.primary : colors.surface,
                    borderColor: category === c ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setCategory(c)}
              >
                <Text style={{ color: category === c ? '#FFF' : colors.text, ...typography.caption, fontSize: 11 }}>
                  {TICKET_CATEGORY_LABELS[c]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Prioridade</Text>
          <View style={styles.chips}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.chip,
                  {
                    backgroundColor: priority === p ? colors.primary : colors.surface,
                    borderColor: priority === p ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setPriority(p)}
              >
                <Text style={{ color: priority === p ? '#FFF' : colors.text, ...typography.caption, fontSize: 11 }}>
                  {TICKET_PRIORITY_LABELS[p]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button title="Abrir chamado" onPress={handleSubmit} loading={loading} fullWidth />
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1 },
});
