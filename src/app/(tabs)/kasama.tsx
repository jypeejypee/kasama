import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DemoBadge, Say, Title } from '@/components/ui';
import { Scene, TINTS, Vessel } from '@/components/Scene';
import { Drift } from '@/components/Motion';
import { FONT, useColors } from '@/lib/theme';
import { useData } from '@/lib/useData';
import { chat, MAX_CHAT_CHARS, MAX_DUMP_CHARS, sortThoughts } from '@/lib/api';
import { addTasks, applyChatResult } from '@/lib/actions';
import { addIdeas, getAlarms, getChat, getIdeas, getNotes, getSettings, getTasks, newId, saveAlarms, saveChat, saveIdeas, saveNotes, saveSettings, saveTasks } from '@/lib/storage';
import { rescheduleAll } from '@/lib/notifications';
import { fmtDue } from '@/lib/time';
import { toggleListening, useVoice, voiceTarget } from '@/lib/voice';
import { KEYBOARD_BEHAVIOR, useKeyboardOpen } from '@/lib/keyboard';
import type { Alarm, ChatMessage, Idea, Note, Task } from '@/lib/types';

// Your messages sit like smooth stones, each one a little different
const STONE = [[22, 22, 6, 24], [24, 20, 6, 22], [20, 24, 6, 20]];

// Thoughts split from a messy message: "java sat, meralco before 20th, call mama"
const pieces = (raw: string) => raw.split(/[,\n;]+/).map((s) => s.trim().replace(/^(idea:|and)\s*/i, '')).filter((s) => s.length > 2);
// Several thoughts at once → sort them into tasks and ideas. One thought or a question → just talk.
const looksLikeDump = (raw: string) => pieces(raw).length >= 3 || (pieces(raw).length >= 2 && raw.length > 60);

type Snapshot = { messageId: string; tasks: Task[]; ideas: Idea[]; notes: Note[]; alarms: Alarm[]; aboutMe: string; clock: boolean };

// The heart of the app: talk or speak to Kasama. Questions get answers; messy dumps get sorted.
// Every change Kasama makes shows an Undo, so you can trust it even in a hurry.
export default function KasamaScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { tasks, settings, setTasks } = useData();
  const voice = useVoice();
  const typing = useKeyboardOpen(); // the bottom bar hides while typing, so the box can sit right above the keyboard
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'' | 'thinking' | 'sorting'>('');
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const list = useRef<FlatList<ChatMessage>>(null);
  const input = useRef<TextInput>(null);
  const textRef = useRef(text);
  useEffect(() => { textRef.current = text; }, [text]);
  const sending = useRef(false); // state updates too late to stop a quick double tap
  const sendRef = useRef<(t: string) => void>(() => {}); // the latest send, for the mic to call

  useFocusEffect(useCallback(() => { getChat().then(setMessages); }, []));
  // While you're here, speaking fills the message box
  // and when you stop talking, it's sent for you
  useFocusEffect(useCallback(() => voiceTarget({ get: () => textRef.current, put: setText, focus: () => input.current?.focus(), send: (t) => sendRef.current(t) }), []));
  // Leaving this screen ends Undo: you may change things elsewhere, and Undo must never wipe those
  useFocusEffect(useCallback(() => () => setSnap(null), []));

  async function send(raw = text) {
    const message = raw.trim();
    if (!message || sending.current) return;
    // Very long messages cost a lot; ask to split them instead (nothing is sent, your text stays in the box)
    const limit = looksLikeDump(message) ? MAX_DUMP_CHARS : MAX_CHAT_CHARS;
    if (message.length > limit) {
      const tip: ChatMessage = { id: newId(), role: 'assistant', text: `That's a lot to hold at once! Can you send it in two parts? About ${limit} letters at a time works best. (You're at ${message.length}.)`, created_at: new Date().toISOString() };
      const withTip = [...messages, tip];
      setMessages(withTip);
      await saveChat(withTip);
      return;
    }
    sending.current = true;
    if (voice.listening) toggleListening();
    const mine: ChatMessage = { id: newId(), role: 'user', text: message, created_at: new Date().toISOString() };
    const history = messages;
    let next = [...history, mine];
    setMessages(next);
    setText('');
    const dump = looksLikeDump(message);
    setBusy(dump ? 'sorting' : 'thinking');
    const replyId = newId();
    try {
      const fresh = await getSettings(); // memory may have changed in chat or You
      const before: Snapshot = { messageId: replyId, tasks: await getTasks(), ideas: await getIdeas(), notes: await getNotes(), alarms: await getAlarms(), aboutMe: fresh.aboutMe ?? '', clock: false };
      let reply: string;
      let changes: string[];
      if (dump) {
        const r = await sortThoughts(message, fresh);
        setTasks(await addTasks(r.tasks));
        await addIdeas(r.ideas, 'dump');
        const notes = await getNotes();
        await saveNotes([{ id: newId(), raw: message, summary: r.summary, ideas: r.ideas, created_at: new Date().toISOString() }, ...notes].slice(0, 200));
        reply = [r.summary, ...r.heads_up.map((h) => `Heads up: ${h}`)].join('\n\n');
        changes = [...r.tasks.map((t) => `Added ${t.title}${t.due_at ? `, by ${fmtDue(t.due_at)}` : ''}`), ...r.ideas.map((i) => `Kept your idea: ${i}`)];
      } else {
        const r = await chat(message, history, tasks, fresh);
        const applied = await applyChatResult(r);
        setTasks(applied.tasks);
        reply = r.reply;
        changes = applied.changes;
      }
      before.clock = changes.some((ch) => ch.startsWith('Opened your Clock app'));
      setSnap(changes.length ? before : null);
      next = [...next, { id: replyId, role: 'assistant', text: reply, changes, created_at: new Date().toISOString() }];
    } catch (e) {
      next = [...next, { id: replyId, role: 'assistant', text: `Sorry, I couldn't reach my brain just now. ${(e as Error).message}`, created_at: new Date().toISOString() }];
    } finally {
      setMessages(next);
      await saveChat(next);
      setBusy('');
      sending.current = false;
    }
  }
  useEffect(() => { sendRef.current = (t) => { send(t); }; });

  // Put tasks, ideas and memory back exactly as they were before Kasama's last change
  async function undo() {
    if (!snap) return;
    await saveTasks(snap.tasks);
    await saveIdeas(snap.ideas);
    await saveNotes(snap.notes);
    await saveAlarms(snap.alarms);
    await saveSettings({ ...(await getSettings()), aboutMe: snap.aboutMe });
    await rescheduleAll();
    setTasks(snap.tasks);
    const undone = snap.clock ? 'Undone. Alarms in your Clock app stay, so delete those there.' : 'Undone. Everything is back how it was.';
    const next = messages.map((m) => (m.id === snap.messageId ? { ...m, changes: [undone] } : m));
    setMessages(next);
    await saveChat(next);
    setSnap(null);
  }

  async function clear() {
    setMessages([]);
    setSnap(null);
    await saveChat([]);
  }

  const name = settings.name?.trim();
  const caught = looksLikeDump(text) ? pieces(text) : [];
  const status = busy === 'sorting' ? `sorting your thoughts… they're ${c.verb} home` : busy ? 'thinking…' : voice.listening ? 'listening…' : 'here for you';
  const hour = new Date().getHours();

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.sky }} behavior={KEYBOARD_BEHAVIOR}>
      <View>
        <Scene height={160 + insets.top} />
        <View style={[styles.head, { paddingTop: insets.top + 14 }]}>
          <Title size={24}>Kasama</Title>
          <Text style={{ color: c.muted, fontFamily: FONT.strong, fontSize: 14 }}>{status}</Text>
        </View>
        {caught.length > 0 && (
          <View style={styles.fleet}>
            {caught.slice(-3).map((t, i) => <Drift key={`${t}-${i}`} index={i}><Vessel label={t.length > 14 ? `${t.slice(0, 13)}…` : t} tint={TINTS[i % TINTS.length]} /></Drift>)}
          </View>
        )}
      </View>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        style={{ backgroundColor: c.ground }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingVertical: 18, gap: 18, flexGrow: 1 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ gap: 16 }}>
            <KasamaLine>{`${hour < 12 ? 'Good morning' : hour < 18 ? 'Hey' : 'Good evening'}${name ? `, ${name}` : ''}. Talk to me, or just let it all out. Messy is fine. I'll sort it.`}</KasamaLine>
            <DemoBadge />
          </View>
        }
        ListFooterComponent={
          <View style={{ gap: 10 }}>
            {!!busy && <Thinking />}
            {messages.length > 0 && !busy && (
              <Pressable accessibilityRole="button" onPress={clear} style={{ alignSelf: 'center', padding: 10 }}>
                <Text style={{ color: c.muted, fontSize: 13, fontFamily: FONT.semi }}>Start fresh</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item: m, index }) => {
          if (m.role === 'user') {
            const r = STONE[index % STONE.length];
            return (
              <View style={[styles.mine, { borderTopLeftRadius: r[0], borderTopRightRadius: r[1], borderBottomRightRadius: r[2], borderBottomLeftRadius: r[3] }]}>
                <Text style={{ color: c.text, fontSize: 16, lineHeight: 23, fontFamily: FONT.body }}>{m.text}</Text>
              </View>
            );
          }
          return (
            <View style={{ gap: 6 }}>
              <KasamaLine>{m.text}</KasamaLine>
              {m.changes?.map((ch) => (
                <View key={ch} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginLeft: 24 }}>
                  <Ionicons name="checkmark" size={16} color={c.accent} />
                  <Text style={{ color: c.accent, fontSize: 14, fontFamily: FONT.strong, flexShrink: 1 }}>{ch}</Text>
                </View>
              ))}
              {snap?.messageId === m.id && (
                <Pressable accessibilityRole="button" accessibilityLabel="Undo what Kasama just changed" onPress={undo} hitSlop={8} style={styles.undo}>
                  <Ionicons name="arrow-undo" size={15} color={c.text} />
                  <Text style={{ color: c.text, fontFamily: FONT.bold, fontSize: 14 }}>Undo</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
      <View style={[styles.bar, { backgroundColor: c.ground, paddingBottom: typing ? 10 : 104 }]}>
        <View style={styles.box}>
          <TextInput
            ref={input}
            accessibilityLabel="Message Kasama"
            value={text}
            onChangeText={setText}
            multiline
            placeholder={voice.listening ? 'Listening…' : 'Talk to me, or let it all out…'}
            placeholderTextColor="#8a9590"
            style={{ flex: 1, color: c.text, fontSize: 16, fontFamily: FONT.body, maxHeight: 140, paddingVertical: 10 }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={voice.listening ? 'Stop listening' : 'Speak to Kasama'} onPress={toggleListening} hitSlop={8} style={[styles.round, { backgroundColor: voice.listening ? '#c4664a' : c.sky }]}>
            <Ionicons name={voice.listening ? 'stop' : 'mic'} size={20} color={voice.listening ? '#ffffff' : c.accent} />
          </Pressable>
          {!!text.trim() && (
            <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={() => send()} disabled={!!busy} style={[styles.round, { backgroundColor: c.accent, opacity: busy ? 0.5 : 1 }]}>
              <Ionicons name="arrow-up" size={20} color="#ffffff" />
            </Pressable>
          )}
        </View>
        {!!voice.note && !voice.listening && <Text style={{ color: c.accent, fontFamily: FONT.strong, fontSize: 13, marginTop: 6, marginLeft: 8 }}>{voice.note}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}

// Kasama's words: no bubble, just a warm little light beside them, like a friend talking
function KasamaLine({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, maxWidth: '94%' }}>
      <View style={styles.light} />
      <Say style={{ flex: 1 }}>{children}</Say>
    </View>
  );
}

// Three soft ripples while Kasama thinks
function Thinking() {
  const c = useColors();
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));
  useEffect(() => {
    const loops = dots.map((d, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 180),
      Animated.timing(d, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(d, { toValue: 0.3, duration: 420, useNativeDriver: true }),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginLeft: 24 }} accessibilityLabel="Kasama is thinking">
      {dots.map((d, i) => <Animated.View key={i} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent, opacity: d }} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 24 },
  fleet: { position: 'absolute', left: 12, right: 12, bottom: 14, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end' },
  mine: { alignSelf: 'flex-end', maxWidth: '80%', paddingVertical: 12, paddingHorizontal: 18, backgroundColor: '#ffffff', shadowColor: '#3b3430', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  light: { width: 12, height: 12, borderRadius: 6, marginTop: 7, backgroundColor: '#f2b48a', shadowColor: '#f2b48a', shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  undo: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginLeft: 24, marginTop: 2, paddingVertical: 8, paddingHorizontal: 14, minHeight: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.85)' },
  bar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 104 },
  box: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: '#ffffff', borderRadius: 28, paddingLeft: 20, paddingRight: 6, paddingVertical: 6 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
