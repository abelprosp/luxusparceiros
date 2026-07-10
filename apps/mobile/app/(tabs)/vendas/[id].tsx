import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { CheckCircle2, FileUp, RotateCcw } from 'lucide-react-native';
import { formatCurrency, formatDate } from '@luxus/utils';
import { salesApi, uploadsApi, type Sale } from '@/services/api';
import { Button, Card } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { getStatusLabel, SALE_STATUS_LABELS } from '@/utils/labels';
import { radius, spacing, typography } from '@/theme';

type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string;
};

export default function VendaDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [sale, setSale] = useState<Sale | null>(null);
  const [files, setFiles] = useState<Record<string, PickedFile>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const response = await salesApi.get(id);
    if (response.success && response.data) {
      setSale(response.data);
      setFiles((current) => {
        const pendingTypes = new Set(
          (response.data?.requiredDocuments ?? [])
            .filter((document) => !document.fulfilled)
            .map((document) => document.type),
        );
        return Object.fromEntries(
          Object.entries(current).filter(([type]) => pendingTypes.has(type)),
        );
      });
    }
  }, [id]);

  useEffect(() => {
    load()
      .catch((error) => {
        Alert.alert('Erro ao carregar venda', error instanceof Error ? error.message : 'Tente novamente');
        router.back();
      })
      .finally(() => setLoading(false));
  }, [load, router]);

  const requiredDocuments = sale?.requiredDocuments ?? [];
  const pendingDocuments = useMemo(
    () => requiredDocuments.filter((document) => !document.fulfilled),
    [requiredDocuments],
  );
  const canResubmit =
    sale?.status === 'DOCUMENTS_PENDING' &&
    requiredDocuments.length > 0 &&
    pendingDocuments.every((document) => files[document.type]);

  const pickFile = async (type: string) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setFiles((current) => ({
      ...current,
      [type]: {
        uri: asset.uri,
        name: asset.name ?? `${type.toLowerCase()}.jpg`,
        mimeType: asset.mimeType ?? undefined,
      },
    }));
  };

  const submitDocuments = async () => {
    if (!sale || sale.status !== 'DOCUMENTS_PENDING') return;
    const missing = pendingDocuments.find((document) => !files[document.type]);
    if (missing) {
      Alert.alert('Documento pendente', `Selecione o arquivo: ${missing.label}`);
      return;
    }

    setSubmitting(true);
    try {
      for (const document of pendingDocuments) {
        const file = files[document.type];
        await uploadsApi.upload({
          ...file,
          type: document.type,
          saleId: sale.id,
          clientId: sale.client?.id,
        });
        setSale((current) =>
          current
            ? {
                ...current,
                requiredDocuments: current.requiredDocuments?.map((item) =>
                  item.type === document.type ? { ...item, fulfilled: true } : item,
                ),
              }
            : current,
        );
      }
      await salesApi.resubmitDocuments(sale.id);
      Alert.alert('Documentos enviados', 'A venda voltou para análise.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      await load().catch(() => undefined);
      Alert.alert(
        'Erro ao enviar documentos',
        error instanceof Error ? error.message : 'Tente novamente',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!sale) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await load().catch(() => undefined);
              setRefreshing(false);
            }}
          />
        }
      >
        <ScreenHeader
          title="Detalhes da venda"
          subtitle={sale.protocol}
          showBack
        />

        <Card>
          <View style={styles.summaryHeader}>
            <Text style={[styles.client, { color: colors.text }]}>
              {sale.client?.name ?? 'Cliente'}
            </Text>
            <Text style={[styles.status, { color: colors.primary }]}>
              {getStatusLabel(sale.status, SALE_STATUS_LABELS)}
            </Text>
          </View>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {sale.plan?.name ?? 'Sem plano'} · {formatCurrency(Number(sale.value))}
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Registrada em {formatDate(sale.createdAt)}
          </Text>
        </Card>

        {sale.status === 'DOCUMENTS_PENDING' && (
          <Card>
            <View style={styles.sectionTitle}>
              <RotateCcw size={20} color={colors.warning} />
              <Text style={[styles.title, { color: colors.text }]}>Ação necessária</Text>
            </View>
            <Text style={[styles.instructions, { color: colors.textSecondary }]}>
              Envie somente os documentos solicitados abaixo. Os demais dados da venda não serão alterados.
            </Text>
            {sale.notes ? (
              <View style={[styles.message, { borderColor: colors.warning }]}>
                <Text style={[styles.messageLabel, { color: colors.text }]}>Mensagem da equipe</Text>
                <Text style={[styles.instructions, { color: colors.textSecondary }]}>{sale.notes}</Text>
              </View>
            ) : null}

            <View style={styles.documentList}>
              {requiredDocuments.map((document) => {
                const file = files[document.type];
                return (
                  <View
                    key={document.type}
                    style={[styles.document, { borderColor: colors.border }]}
                  >
                    <View style={styles.documentHeader}>
                      <Text style={[styles.documentLabel, { color: colors.text }]}>
                        {document.label}
                      </Text>
                      <Text
                        style={[
                          styles.documentState,
                          { color: document.fulfilled ? colors.success : colors.warning },
                        ]}
                      >
                        {document.fulfilled ? 'Enviado' : 'Pendente'}
                      </Text>
                    </View>
                    {!document.fulfilled && (
                      <TouchableOpacity
                        style={[styles.filePicker, { borderColor: colors.primary }]}
                        onPress={() => pickFile(document.type)}
                        disabled={submitting}
                      >
                        {file ? (
                          <CheckCircle2 size={18} color={colors.success} />
                        ) : (
                          <FileUp size={18} color={colors.primary} />
                        )}
                        <Text style={[styles.fileName, { color: colors.primary }]} numberOfLines={1}>
                          {file?.name ?? 'Selecionar foto ou PDF'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>

            <Button
              title={pendingDocuments.length === 0 ? 'Reenviar para análise' : 'Enviar documentos'}
              fullWidth
              loading={submitting}
              disabled={!canResubmit && pendingDocuments.length > 0}
              onPress={submitDocuments}
            />
          </Card>
        )}

        {sale.status !== 'DOCUMENTS_PENDING' && requiredDocuments.length > 0 && (
          <Card>
            <Text style={[styles.title, { color: colors.text }]}>Documentos solicitados</Text>
            {requiredDocuments.map((document) => (
              <View key={document.type} style={styles.completedRow}>
                <CheckCircle2 size={18} color={colors.success} />
                <Text style={[styles.instructions, { color: colors.text }]}>{document.label}</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  client: { ...typography.h3, flex: 1 },
  status: { ...typography.label, fontWeight: '700' },
  meta: { ...typography.bodySmall, marginTop: spacing.xs },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.h3 },
  instructions: { ...typography.bodySmall, lineHeight: 20 },
  message: { borderLeftWidth: 3, paddingLeft: spacing.sm, gap: spacing.xs },
  messageLabel: { ...typography.label, fontWeight: '700' },
  documentList: { gap: spacing.sm },
  document: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  documentHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  documentLabel: { ...typography.label, flex: 1, fontWeight: '600' },
  documentState: { ...typography.caption, fontWeight: '700' },
  filePicker: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fileName: { ...typography.bodySmall, flex: 1 },
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
