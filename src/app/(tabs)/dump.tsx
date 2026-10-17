import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Button, Card, Chip, DemoBadge, H, Muted } from '@/components/ui';
import { useColors } from '@/lib/theme';
import { useData } from '@/lib/useData';
import { sortThoughts } from '@/lib/api';
import { addTasks } from '@/lib/actions';
import { addIdeas, getNotes, newId, saveNotes } from '@/lib/storage';
import { fmtDue } from '@/lib/time';
import type { DumpResult, Priority, ProposedTask } from '@/lib/types';

type Row = ProposedTask & { keep: boolean };

// Type (or use the keyboard's microphone to talk) everything on your mind. Taglish is fine.
export default function Dump() {
  const c = useColors();
  const { settings } = useData();
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DumpResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  async function sort() {
    setBusy(true);
    setError('');
    try {
      const r = await sortThoughts(raw, settings);
      setResult(r);
      setRows(r.tasks.map((t) => ({ ...t, keep: true })));
      const notes = await getNotes();
      await saveNotes([{ id: newId(), raw, summary: r.summary, ideas: r.ideas, created_at: new Date().toISOString() }, ...notes].slice(0, 200));
      await addIdeas(r.ideas, 'dump');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    await addTasks(rows.filter((r) => r.keep).map(({ keep: _keep, ...t }) => t));
    setRaw('');
    setResult(null);
    setRows([]);
    router.navigate('/');
  }

  const edit = (i: number, patch: Partial<Row>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const input = { color: c.text, borderColor: c.line, backgroundColor: c.bg, borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 16 } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
        <Card>
          <DemoBadge />
          <Muted>Messy is fine. Example: &quot;submit java activity sat, apply to 3 jobs this week, pay meralco before 20th, pagod ako lately&quot;</Muted>
          <TextInput
            accessibilityLabel="Your thoughts"
            value={raw}
            onChangeText={setRaw}
            multiline
            placeholder="What's on your mind?"
            placeholderTextColor={c.muted}
            style={[input, { minHeight: 160, textAlignVertical: 'top' }]}
          />
          <Button title="Sort my thoughts" onPress={sort} busy={busy} disabled={raw.trim().length < 3} />
          {!!error && <Text style={{ color: c.high }}>{error}</Text>}
        </Card>

        {result && (
          <>
            <Card>
              <H>Summary</H>
              <Text style={{ color: c.text, fontSize: 15, lineHeight: 21 }}>{result.summary}</Text>
              {result.heads_up.length > 0 && <Text style={{ color: c.medium, fontWeight: '700' }}>Heads up</Text>}
              {result.heads_up.map((h) => <Muted key={h}>• {h}</Muted>)}
              {result.ideas.length > 0 && <Text style={{ color: c.text, fontWeight: '700' }}>Ideas (saved to your Ideas tab)</Text>}
              {result.ideas.map((h) => <Muted key={h}>• {h}</Muted>)}
            </Card>

            <H>Tasks to add ({rows.filter((r) => r.keep).length})</H>
            {rows.map((r, i) => (
              <Card key={i} style={{ opacity: r.keep ? 1 : 0.5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: r.keep }} accessibilityLabel="Keep this task" onPress={() => edit(i, { keep: !r.keep })} hitSlop={10}>
                    <Ionicons name={r.keep ? 'checkbox' : 'square-outline'} size={24} color={c.accent} />
                  </Pressable>
                  <TextInput accessibilityLabel="Task title" value={r.title} onChangeText={(v) => edit(i, { title: v })} style={[input, { flex: 1 }]} />
                </View>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {(['high', 'medium', 'low'] as Priority[]).map((p) => <Chip key={p} label={p} active={r.priority === p} onPress={() => edit(i, { priority: p })} />)}
                  <Muted>{r.duration_min} min{r.repeat ? ` · repeats ${r.repeat}` : ''}</Muted>
                </View>
                {r.due_at ? (
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Muted>Due {fmtDue(r.due_at)}</Muted>
                    <Pressable accessibilityRole="button" onPress={() => edit(i, { due_at: null })}><Text style={{ color: c.accent }}>Remove date</Text></Pressable>
                  </View>
                ) : <Muted>No deadline</Muted>}
              </Card>
            ))}
            <Button title="Save tasks" onPress={save} />
          </>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
