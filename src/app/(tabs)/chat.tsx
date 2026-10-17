import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { DemoBadge, Muted } from '@/components/ui';
import { useColors } from '@/lib/theme';
import { useData } from '@/lib/useData';
import { chat } from '@/lib/api';
import { applyChatResult } from '@/lib/actions';
import { getChat, getSettings, newId, saveChat } from '@/lib/storage';
import type { ChatMessage } from '@/lib/types';

const EXAMPLES = ['Pagod ako, what can I skip today?', 'Remind me to call Mama tomorrow 7pm', 'Pay Meralco every month on the 18th', 'Idea: sell my old laptop'];

// Talk to Kasama like a person. It answers, and changes your tasks, ideas and memory for you.
export default function Chat() {
  const c = useColors();
  const { tasks, setTasks } = useData();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef<FlatList<ChatMessage>>(null);

  useFocusEffect(useCallback(() => { getChat().then(setMessages); }, []));

  async function send(raw = text) {
    const message = raw.trim();
    if (!message || busy) return;
    const mine: ChatMessage = { id: newId(), role: 'user', text: message, created_at: new Date().toISOString() };
    const history = messages;
    let next = [...history, mine];
    setMessages(next);
    setText('');
    setBusy(true);
    try {
      // Memory may have changed in chat or Settings, so read the latest
      const r = await chat(message, history, tasks, await getSettings());
      const { tasks: updated, changes } = await applyChatResult(r);
      setTasks(updated);
      next = [...next, { id: newId(), role: 'assistant', text: r.reply, changes, created_at: new Date().toISOString() }];
    } catch (e) {
      next = [...next, { id: newId(), role: 'assistant', text: `Sorry, I couldn't reach my brain just now. ${(e as Error).message}`, created_at: new Date().toISOString() }];
    } finally {
      setMessages(next);
      await saveChat(next);
      setBusy(false);
    }
  }

  async function clear() {
    setMessages([]);
    await saveChat([]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ gap: 10 }}>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Kumusta? I&apos;m Kasama.</Text>
            <DemoBadge />
            <Muted>Tell me anything. I can add, finish, drop or move your tasks, save your ideas, and remember things about you. English or Taglish is fine.</Muted>
            {EXAMPLES.map((e) => (
              <Pressable key={e} accessibilityRole="button" onPress={() => send(e)} style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 12, padding: 12 }}>
                <Text style={{ color: c.text }}>{e}</Text>
              </Pressable>
            ))}
          </View>
        }
        ListFooterComponent={
          <View style={{ gap: 10 }}>
            {busy && <ActivityIndicator color={c.accent} style={{ alignSelf: 'flex-start', marginLeft: 8 }} />}
            {messages.length > 0 && !busy && (
              <Pressable accessibilityRole="button" onPress={clear} style={{ alignSelf: 'center', padding: 8 }}>
                <Text style={{ color: c.muted, fontSize: 13 }}>Clear chat</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item: m }) => {
          const mine = m.role === 'user';
          return (
            <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', gap: 4 }}>
              <View style={{ backgroundColor: mine ? c.accent : c.card, borderColor: c.line, borderWidth: mine ? 0 : 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 }}>
                <Text style={{ color: mine ? c.accentText : c.text, fontSize: 15, lineHeight: 21 }}>{m.text}</Text>
              </View>
              {m.changes?.map((ch) => (
                <View key={ch} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingLeft: 6 }}>
                  <Ionicons name="checkmark-circle" size={14} color={c.accent} />
                  <Text style={{ color: c.accent, fontSize: 13, fontWeight: '600', flexShrink: 1 }}>{ch}</Text>
                </View>
              ))}
            </View>
          );
        }}
      />
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderColor: c.line, backgroundColor: c.card, alignItems: 'flex-end' }}>
        <TextInput
          accessibilityLabel="Message Kasama"
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Message Kasama"
          placeholderTextColor={c.muted}
          style={{ flex: 1, color: c.text, borderColor: c.line, backgroundColor: c.bg, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, maxHeight: 120 }}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={() => send()} disabled={busy || !text.trim()} style={{ backgroundColor: c.accent, borderRadius: 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: busy || !text.trim() ? 0.5 : 1 }}>
          <Ionicons name="send" size={18} color={c.accentText} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
