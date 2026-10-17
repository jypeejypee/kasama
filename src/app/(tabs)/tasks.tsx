import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Button, Card, Chip, H, Muted } from '@/components/ui';
import { TaskRow } from '@/components/TaskRow';
import { useColors } from '@/lib/theme';
import { useData } from '@/lib/useData';
import { addTasks, dropTask, toggleTask } from '@/lib/actions';
import type { Priority, Repeat } from '@/lib/types';

export default function Tasks() {
  const c = useColors();
  const { tasks, setTasks } = useData();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [repeat, setRepeat] = useState<Repeat | null>(null);
  const open = tasks.filter((t) => t.status === 'todo');

  async function quickAdd() {
    if (!title.trim()) return;
    setTasks(await addTasks([{ title: title.trim(), notes: null, due_at: null, duration_min: 30, priority, repeat }]));
    setTitle('');
    setRepeat(null);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
      <Card>
        <TextInput
          accessibilityLabel="New task"
          value={title}
          onChangeText={setTitle}
          placeholder="Quick add a task"
          placeholderTextColor={c.muted}
          onSubmitEditing={quickAdd}
          returnKeyType="done"
          style={{ color: c.text, borderColor: c.line, backgroundColor: c.bg, borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 16 }}
        />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['high', 'medium', 'low'] as Priority[]).map((p) => <Chip key={p} label={p} active={priority === p} onPress={() => setPriority(p)} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {([null, 'daily', 'weekly', 'monthly'] as (Repeat | null)[]).map((r) => <Chip key={r ?? 'once'} label={r ?? 'once'} active={repeat === r} onPress={() => setRepeat(r)} />)}
        </View>
        <Button title="Add" onPress={quickAdd} disabled={!title.trim()} />
      </Card>

      {open.length === 0 && <Muted>Nothing open. Nice.</Muted>}
      {(['high', 'medium', 'low'] as Priority[]).map((p) => {
        const list = open.filter((t) => t.priority === p);
        if (!list.length) return null;
        return (
          <View key={p} style={{ gap: 8 }}>
            <H>{p === 'high' ? 'High priority' : p === 'medium' ? 'Medium' : 'Low'} ({list.length})</H>
            {list.map((t) => <TaskRow key={t.id} task={t} onToggle={async () => setTasks(await toggleTask(t))} onDrop={async () => setTasks(await dropTask(t))} />)}
          </View>
        );
      })}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
