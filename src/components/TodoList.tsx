import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button, Chip, H, Muted } from '@/components/ui';
import { TaskRow } from '@/components/TaskRow';
import { DetailSheet } from '@/components/DetailSheet';
import { FONT, useColors } from '@/lib/theme';
import { addTasks, dropTask, toggleTask, updateTaskSafely } from '@/lib/actions';
import { endOfDay } from '@/lib/time';
import type { Repeat, Task } from '@/lib/types';

const inDays = (n: number) => { const d = endOfDay(); d.setDate(d.getDate() + n); return d; };

// Grouped by when, the way you'd think about it, not by priority labels
function group(open: Task[]) {
  const today = open.filter((t) => t.due_at && new Date(t.due_at) <= endOfDay());
  const week = open.filter((t) => !today.includes(t) && t.due_at && new Date(t.due_at) <= inDays(7));
  const later = open.filter((t) => !today.includes(t) && !week.includes(t) && t.due_at);
  const someday = open.filter((t) => !t.due_at);
  return [['Today', today], ['This week', week], ['Later', later], ['Whenever', someday]] as const;
}

export function TodoList({ tasks, setTasks }: { tasks: Task[]; setTasks: (t: Task[]) => void }) {
  const c = useColors();
  const [title, setTitle] = useState('');
  const [repeat, setRepeat] = useState<Repeat | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = tasks.filter((t) => t.status === 'todo');
  const opened = tasks.find((t) => t.id === openId);

  async function quickAdd() {
    if (!title.trim()) return;
    setTasks(await addTasks([{ title: title.trim(), notes: null, due_at: null, duration_min: 30, priority: 'medium', repeat }]));
    setTitle('');
    setRepeat(null);
  }

  return (
    <View style={{ gap: 6 }}>
      <TextInput
        accessibilityLabel="Add something to do"
        value={title}
        onChangeText={setTitle}
        placeholder="Add something…"
        placeholderTextColor="#8a9590"
        onSubmitEditing={quickAdd}
        returnKeyType="done"
        style={{ color: c.text, backgroundColor: '#ffffff', borderRadius: 26, paddingHorizontal: 20, paddingVertical: 14, fontSize: 16, fontFamily: FONT.body }}
      />
      {!!title.trim() && (
        <View style={{ gap: 10, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {([null, 'daily', 'weekly', 'monthly'] as (Repeat | null)[]).map((r) => (
              <Chip key={r ?? 'once'} label={r ? `every ${r === 'daily' ? 'day' : r.replace('ly', '')}` : 'just once'} active={repeat === r} onPress={() => setRepeat(r)} />
            ))}
          </View>
          <Button title="Add" onPress={quickAdd} />
        </View>
      )}
      {open.length === 0 && <Muted style={{ marginTop: 16 }}>Nothing to carry right now. Enjoy it.</Muted>}
      {group(open).map(([name, list]) => list.length > 0 && (
        <View key={name}>
          <H>{name}</H>
          {list.map((t) => <TaskRow key={t.id} task={t} onOpen={() => setOpenId(t.id)} onToggle={async () => setTasks(await toggleTask(t))} onDrop={async () => setTasks(await dropTask(t))} />)}
        </View>
      ))}
      <DetailSheet
        kind="task"
        item={opened ? { title: opened.title, notes: opened.notes, steps: opened.steps ?? [] } : null}
        onClose={() => setOpenId(null)}
        onSave={async (d) => { if (opened) setTasks(await updateTaskSafely(opened.id, d)); }}
      />
    </View>
  );
}
