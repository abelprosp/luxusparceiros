import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { formatDateTime, getInitials } from '@luxus/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ticketsApi, type Ticket, type TicketMessage } from '@/services/api';
import { connectSocket, subscribeToTicket, unsubscribeFromTicket } from '@/services/socket';
import { Badge, SkeletonList } from '@/components/ui';
import { ScreenHeader } from '@/components/ScreenHeader';
import { getStatusLabel, TICKET_STATUS_LABELS } from '@/utils/labels';
import { spacing, typography, radius } from '@/theme';

export default function ChamadoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const loadTicket = async () => {
    if (!id) return;
    try {
      const response = await ticketsApi.get(id);
      if (response.success && response.data) {
        setTicket(response.data);
        setMessages(response.data.messages ?? []);
      }
    } catch {
      setTicket(null);
    }
  };

  useEffect(() => {
    loadTicket().finally(() => setLoading(false));

    if (id) {
      connectSocket({
        onTicketMessage: (data) => {
          const msg = data as TicketMessage;
          if (!msg || msg.ticketId !== id) return;
          if (msg.isInternal) return;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        },
      });
      subscribeToTicket(id);
    }

    return () => {
      if (id) unsubscribeFromTicket(id);
    };
  }, [id]);

  const handleSend = async () => {
    if (!reply.trim() || !id) return;
    setSending(true);
    try {
      const response = await ticketsApi.reply(id, reply.trim());
      if (response.success && response.data) {
        setMessages((prev) =>
          prev.some((m) => m.id === response.data!.id) ? prev : [...prev, response.data!],
        );
        setReply('');
        listRef.current?.scrollToEnd();
      }
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: TicketMessage }) => {
    const isOwn = item.user?.id === user?.id;
    return (
      <View style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble, { backgroundColor: isOwn ? colors.primary : colors.surface }]}>
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
          <ScreenHeader title="Chamado" showBack />
          <SkeletonList count={4} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={styles.padding}>
          <ScreenHeader title={ticket?.subject ?? 'Chamado'} subtitle={ticket?.protocol} showBack />
          {ticket && <Badge label={getStatusLabel(ticket.status, TICKET_STATUS_LABELS)} />}
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd()}
        />

        <View style={[styles.inputBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface }]}
            placeholder="Digite sua mensagem..."
            placeholderTextColor={colors.textSecondary}
            value={reply}
            onChangeText={setReply}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: sending || !reply.trim() ? 0.5 : 1 }]}
            onPress={handleSend}
            disabled={sending || !reply.trim()}
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
  padding: { padding: spacing.md, gap: spacing.sm },
  messages: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
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
