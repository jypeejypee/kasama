import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Button, Muted, Say, Title } from '@/components/ui';
import { FONT, useColors } from '@/lib/theme';
import { addIdeas, getIdeas, saveIdeas } from '@/lib/storage';
import { makeTaskFromIdea } from '@/lib/actions';
import type { Idea, Task } from '@/lib/types';

const FROM = { dump: 'from a brain dump', chat: 'from talking', manual: 'written by you' } as const;
const SHELLS = ['#efd9c6', '#d9e6ea', '#e3ead9', '#ece2ef'];
const WEEK = 7 * 24 * 60 * 60 * 1000;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function Shell({ color }: { color: string }) {
  return (
    <Svg width={26} height={24} viewBox="0 0 22 20">
      <Path d="M11 2 C 4 2, 1 9, 2 15 L 11 18 L 20 15 C 21 9, 18 2, 11 2 Z" fill={color} />
      <Path d="M11 3 L11 17 M6 5 L8 16 M16 5 L14 16" stroke="#00000018" strokeWidth={1} />
    </Svg>
  );
}

// Every idea you've had, in one place. Now and then an old one comes back for one small step.
export function IdeaList({ onTasks }: { onTasks: (t: Task[]) => void }) {
  const c = useColors();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [later, setLater] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useFocusEffect(useCallback(() => { getIdeas().then(setIdeas); setMsg(''); setNow(Date.now()); }, []));

  async function add() {
    if (!text.trim()) return;
    setIdeas(await addIdeas([text], 'manual'));
    setText('');
  }

  async function remove(id: string) {
    const next = ideas.filter((i) => i.id !== id);
    setIdeas(next);
    await saveIdeas(next);
  }

  async function toTask(idea: Idea) {
    onTasks(await makeTaskFromIdea(idea.text));
    await remove(idea.id);
    setMsg(`"${idea.text}" is on your to-do list now. One small step.`);
  }

  // The oldest idea from more than a week ago comes back, unless you said "not yet"
  const old = [...ideas].reverse().find((i) => now - Date.parse(i.created_at) > WEEK && i.id !== later);
  const q = search.trim().toLowerCase();
  const shown = (q ? ideas.filter((i) => i.text.toLowerCase().includes(q)) : ideas).filter((i) => i.id !== old?.id || !!q);

  return (
    <View style={{ gap: 12 }}>
      {old && !q && (
        <View style={{ backgroundColor: c.band, padding: 20, gap: 8, borderTopLeftRadius: 30, borderTopRightRadius: 26, borderBottomRightRadius: 32, borderBottomLeftRadius: 24 }}>
          <Text style={{ color: c.accent, fontFamily: FONT.strong, fontSize: 14 }}>From {day(old.created_at)}</Text>
          <Title size={19}>{old.text}</Title>
          <Say style={{ fontSize: 15, lineHeight: 22 }}>Still curious about this one? Want to take just one small step?</Say>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}><Button title="Let's do it" onPress={() => toTask(old)} /></View>
            <Button title="Not yet" variant="link" onPress={() => setLater(old.id)} />
          </View>
        </View>
      )}
      {!!msg && <Text style={{ color: c.accent, fontFamily: FONT.strong, fontSize: 15 }}>✓ {msg}</Text>}

      <TextInput accessibilityLabel="New idea" value={text} onChangeText={setText} placeholder="Write down an idea…" placeholderTextColor="#8a9590" onSubmitEditing={add} returnKeyType="done" style={{ color: c.text, backgroundColor: '#ffffff', borderRadius: 26, paddingHorizontal: 20, paddingVertical: 14, fontSize: 16, fontFamily: FONT.body }} />
      {!!text.trim() && <Button title="Keep this idea" onPress={add} />}
      {ideas.length > 5 && <TextInput accessibilityLabel="Search ideas" value={search} onChangeText={setSearch} placeholder={`Search ${ideas.length} ideas`} placeholderTextColor="#8a9590" style={{ color: c.text, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, fontSize: 15, fontFamily: FONT.body }} />}
      {ideas.length === 0 && <Muted>No ideas yet. Write one above, or tell Kasama &quot;Idea: …&quot; anytime.</Muted>}

      {shown.map((i, k) => (
        <View key={i.id} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 6 }}>
          <View style={{ marginTop: 2 }}><Shell color={SHELLS[k % SHELLS.length]} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.text, fontFamily: FONT.title, fontSize: 16, lineHeight: 22 }}>{i.text}</Text>
            <Muted style={{ fontSize: 14 }}>{day(i.created_at)}, {FROM[i.source]}</Muted>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Make it a to-do: ${i.text}`} onPress={() => toTask(i)} hitSlop={10} style={{ padding: 6 }}>
            <Ionicons name="add-circle-outline" size={22} color={c.accent} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Let go of idea: ${i.text}`} onPress={() => remove(i.id)} hitSlop={10} style={{ padding: 6 }}>
            <Ionicons name="close" size={20} color={c.muted} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
