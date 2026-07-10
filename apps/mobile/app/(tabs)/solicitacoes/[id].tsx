import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { formatDateTime } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { requestsApi, type RequestItem, type RequestComment } from '@/services/api';
import { Badge, SkeletonList } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ActivityLog } from '@/components/ActivityLog';
import { getStatusLabel, REQUEST_STATUS_LABELS, REQUEST_TYPE_LABELS } from '@/utils/labels';
import { spacing, typography, radius } from '@/theme';

export default function SolicitacaoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [request, setRequest] = useState<RequestItem | null>(null);
  const [comments, setComments] = useState<RequestComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const loadRequest = async () => {
    if (!id) return;
    try {
      const response = await requestsApi.get(id);
      if (response.success && response.data) {
        setRequest(response.data);
        setComments(response.data.comments ?? []);
      }
    } catch {
      setRequest(null);
    }
  };

  useEffect(() => {
    loadRequest().finally(() => setLoading(false));
  }, [id]);

  const handleSend = async () => {
    if (!comment.trim() || !id) return;
    setSending(true);
    try {
      const response = await requestsApi.addComment(id, comment.trim());
      if (response.success && response.data) {
        setComments((prev) =>
          prev.some((c) => c.id === response.data!.id) ? prev : [...prev, response.data!],
        );
        setComment('');
        await loadRequest();
        listRef.current?.scrollToEnd();
      }
    } finally {
      setSending(false);
    }
  };

  const renderComment = ({ item }: { item: RequestComment }) => {
    const isOwn = item.user?.id === user?.id;
    return (
      <View
        style={[
          styles.messageBubble,
          isOwn ? styles.ownBubble : styles.otherBubble,
          { backgroundColor: isOwn ? colors.primary : colors.surface },
        ]}
      >
        {!isOwn && item.user && (
          <Text style={[styles.sender, { color: isOwn ? '#FFF' : colors.primary }]}>{item.user.name}</Text>
        )}
        <Text style={[styles.messageText, { color: isOwn ? '#FFF' : colors.text }]}>{item.content}</Text>
        <Text style={[styles.messageTime, { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
          {formatDateTime(item.createdAt)}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.padding}>
          <ScreenHeader title="Solicitação" showBack />
          <SkeletonList count={4} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView style={styles.padding} contentContainerStyle={styles.headerContent}>
          <ScreenHeader title={request?.protocol ?? 'Solicitação'} showBack />
          {request && (
            <>
              <View style={styles.badges}>
                <Badge label={getStatusLabel(request.status, REQUEST_STATUS_LABELS)} />
                <Badge label={getStatusLabel(request.type, REQUEST_TYPE_LABELS)} variant="outline" />
              </View>
              <Text style={[styles.description, { color: colors.text }]}>{request.description}</Text>
              {request.client && (
                <Text style={[styles.meta, { color: colors.textSecondary }]}>Cliente: {request.client.name}</Text>
              )}
              {request.resolution && (
                <View style={[styles.resolution, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.meta, { color: colors.textSecondary, fontWeight: '600' }]}>Resolução</Text>
                  <Text style={[styles.description, { color: colors.text }]}>{request.resolution}</Text>
                </View>
              )}
              <ActivityLog entries={request.timeline} />
            </>
          )}
        </ScrollView>

        <FlatList
          ref={listRef}
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <Text style={[styles.emptyComments, { color: colors.textSecondary }]}>Nenhum comentário ainda</Text>
          }
        />

        <View style={[styles.inputBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface }]}
            placeholder="Adicionar comentário..."
            placeholderTextColor={colors.textSecondary}
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: sending || !comment.trim() ? 0.5 : 1 }]}
            onPress={handleSend}
            disabled={sending || !comment.trim()}
          >
            <Send size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  padding: { paddingHorizontal: spacing.md },
  headerContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  description: { ...typography.bodySmall },
  meta: { ...typography.caption },
  resolution: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs },
  messages: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  emptyComments: { textAlign: 'center', ...typography.caption, paddingVertical: spacing.lg },
  messageBubble: { maxWidth: '80%', padding: spacing.md, borderRadius: radius.lg, gap: spacing.xs },
  ownBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  otherBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  sender: { ...typography.caption, fontWeight: '600' },
  messageText: { ...typography.bodySmall },
  messageTime: { ...typography.caption, fontSize: 10, alignSelf: 'flex-end' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.sm, borderTopWidth: 1, gap: spacing.sm },
  input: { flex: 1, maxHeight: 100, padding: spacing.sm, borderRadius: radius.md, ...typography.bodySmall },
  sendBtn: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
