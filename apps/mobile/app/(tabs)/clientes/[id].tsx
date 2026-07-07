import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Phone, Mail, MapPin, FileText } from 'lucide-react-native';
import { formatDocument, formatPhone, formatDate } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { clientsApi, type Client } from '@/services/api';
import { Card, Badge, SkeletonList, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { getStatusLabel, LINE_STATUS_LABELS } from '@/utils/labels';
import { spacing, typography } from '@/theme';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadClient = async () => {
    if (!id) return;
    try {
      const response = await clientsApi.get(id);
      if (response.success && response.data) setClient(response.data);
    } catch {
      setClient(null);
    }
  };

  useEffect(() => {
    loadClient().finally(() => setLoading(false));
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClient();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.padding}>
          <ScreenHeader title="Cliente" showBack />
          <SkeletonList count={3} />
        </View>
      </SafeAreaView>
    );
  }

  if (!client) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState title="Cliente não encontrado" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <ScreenHeader title={client.name} subtitle={formatDocument(client.document)} showBack />

        <View style={styles.badges}>
          <Badge label={client.isActive ? 'Ativo' : 'Inativo'} />
          <Badge label={client.documentType} variant="outline" />
        </View>

        <Card title="Contato">
          <InfoRow icon={<Phone size={18} color={colors.primary} />} label="Telefone" value={formatPhone(client.phone)} colors={colors} />
          {client.email && (
            <InfoRow icon={<Mail size={18} color={colors.primary} />} label="E-mail" value={client.email} colors={colors} />
          )}
          {(client.address || client.city) && (
            <InfoRow
              icon={<MapPin size={18} color={colors.primary} />}
              label="Endereço"
              value={[client.address, client.city, client.state].filter(Boolean).join(', ')}
              colors={colors}
            />
          )}
        </Card>

        <Card title="Linhas" subtitle={`${client.lines?.length ?? 0} linha(s)`}>
          {client.lines?.length ? (
            client.lines.map((line) => (
              <View key={line.id} style={[styles.lineItem, { borderColor: colors.border }]}>
                <Text style={[styles.lineNumber, { color: colors.text }]}>{formatPhone(line.number)}</Text>
                <Text style={[styles.lineOperator, { color: colors.textSecondary }]}>
                  {line.operator?.name} · {line.plan?.name ?? 'Sem plano'}
                </Text>
                <Badge label={getStatusLabel(line.status, LINE_STATUS_LABELS)} />
              </View>
            ))
          ) : (
            <Text style={{ color: colors.textSecondary, ...typography.bodySmall }}>Nenhuma linha vinculada</Text>
          )}
        </Card>

        <Card title="Histórico">
          <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
            Cliente desde {formatDate(client.createdAt)}
          </Text>
        </Card>

        <Card title="Documentos" subtitle={`${client.documents?.length ?? 0} arquivo(s)`}>
          {client.documents?.length ? (
            client.documents.map((doc) => (
              <View key={doc.id} style={[styles.docItem, { borderColor: colors.border }]}>
                <FileText size={20} color={colors.primary} />
                <View style={styles.docInfo}>
                  <Text style={[styles.docName, { color: colors.text }]}>{doc.name}</Text>
                  <Text style={[styles.docDate, { color: colors.textSecondary }]}>
                    {doc.type} · {formatDate(doc.createdAt)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={{ color: colors.textSecondary, ...typography.bodySmall }}>Nenhum documento</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: { text: string; textSecondary: string };
}) {
  return (
    <View style={styles.infoRow}>
      {icon}
      <View>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  padding: { padding: spacing.md },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  badges: { flexDirection: 'row', gap: spacing.sm },
  infoRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  infoLabel: { ...typography.caption },
  infoValue: { ...typography.bodySmall },
  lineItem: { paddingVertical: spacing.sm, borderBottomWidth: 1, gap: spacing.xs },
  lineNumber: { ...typography.label, fontWeight: '600' },
  lineOperator: { ...typography.caption },
  historyDate: { ...typography.bodySmall },
  docItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  docInfo: { flex: 1 },
  docName: { ...typography.bodySmall, fontWeight: '500' },
  docDate: { ...typography.caption },
});
