import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { Button, Card, Muted } from '@/components/ui';
import { useColors } from '@/lib/theme';
import { addIdeas, getIdeas, saveIdeas } from '@/lib/storage';
import { makeTaskFromIdea } from '@/lib/actions';
import type { Idea } from '@/lib/types';

const FROM = { dump: 'From brain dump', chat: 'From chat', manual: 'Added by you' } as const;

// Every idea you have, collected in one place: from brain dumps, chat, or typed here.
export default function Ideas() {
  const c = useColors();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');

  useFocusEffect(useCallback(() => { getIdeas().then(setIdeas); setMsg(''); }, []));

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
    await makeTaskFromIdea(idea.text);
    await remove(idea.id);
    setMsg(`"${idea.text}" is now a task.`);
  }

  const input = { color: c.text, borderColor: c.line, backgroundColor: c.bg, borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 16 } as const;
  const shown = search.trim() ? ideas.filter((i) => i.text.toLowerCase().includes(search.trim().toLowerCase())) : ideas;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
      <Card>
        <TextInput accessibilityLabel="New idea" value={text} onChangeText={setText} placeholder="Write down an idea" placeholderTextColor={c.muted} onSubmitEditing={add} returnKeyType="done" style={input} />
        <Button title="Save idea" onPress={add} disabled={!text.trim()} />
        <Muted>Ideas from brain dumps and chat land here too.</Muted>
      </Card>

      {ideas.length > 5 && <TextInput accessibilityLabel="Search ideas" value={search} onChangeText={setSearch} placeholder={`Search ${ideas.length} ideas`} placeholderTextColor={c.muted} style={input} />}
      {!!msg && <Text style={{ color: c.accent, fontWeight: '600' }}>{msg}</Text>}
      {ideas.length === 0 && <Muted>No ideas yet. Write one above, or tell Kasama &quot;Idea: …&quot; in chat.</Muted>}

      {shown.map((i) => (
        <Card key={i.id}>
          <Text style={{ color: c.text, fontSize: 16, lineHeight: 22 }}>{i.text}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Muted>{FROM[i.source]} · {new Date(i.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Muted>
            <View style={{ flex: 1 }} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Make a task: ${i.text}`} onPress={() => toTask(i)} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="add-circle-outline" size={20} color={c.accent} />
              <Text style={{ color: c.accent, fontWeight: '600' }}>Task</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete idea: ${i.text}`} onPress={() => remove(i.id)} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color={c.muted} />
            </Pressable>
          </View>
        </Card>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
