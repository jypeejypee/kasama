import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, DemoBadge, H, Muted } from '@/components/ui';
import { TaskRow } from '@/components/TaskRow';
import { useColors } from '@/lib/theme';
import { useData } from '@/lib/useData';
import { endOfDay, isToday } from '@/lib/time';
import { planDay } from '@/lib/api';
import { applyPlan, describeMoves, dropTask, isMissed, moveToTomorrow, toggleTask } from '@/lib/actions';

export default function Today() {
  const c = useColors();
  const { tasks, settings, setTasks } = useData();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [moves, setMoves] = useState<string[]>([]);

  const open = tasks.filter((t) => t.status === 'todo');
  const missed = open.filter((t) => isMissed(t));
  const planned = open.filter((t) => isToday(t.scheduled_start) && !missed.includes(t)).sort((a, b) => (a.scheduled_start ?? '').localeCompare(b.scheduled_start ?? ''));
  const due = open.filter((t) => !planned.includes(t) && !missed.includes(t) && t.due_at && new Date(t.due_at) <= endOfDay());
  const rest = open.filter((t) => !planned.includes(t) && !missed.includes(t) && !due.includes(t));
  const doneToday = tasks.filter((t) => t.status === 'done' && isToday(t.done_at));

  async function plan() {
    if (open.length === 0) return setMessage('No open tasks yet. Add a brain dump first.');
    setBusy(true);
    try {
      const result = await planDay(tasks, settings);
      const next = await applyPlan(result);
      // Tell you what changed for the tasks you missed, like an assistant would
      setMoves(describeMoves(missed, next));
      setTasks(next);
      setMessage(result.message);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function missedToTomorrow() {
    setTasks(await moveToTomorrow(missed.map((t) => t.id)));
    setMoves(missed.map((t) => `Moved ${t.title} to tomorrow`));
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Card>
        <Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>{today}</Text>
        <Muted>{open.length} open · {doneToday.length} done today</Muted>
        <DemoBadge />
        <Button title="Plan the rest of my day" onPress={plan} busy={busy} />
        {!!message && <Muted>{message}</Muted>}
        {moves.map((m) => <Text key={m} style={{ color: c.accent, fontWeight: '600' }}>{m}</Text>)}
        <Button title="Evening check-in" variant="secondary" onPress={() => router.push('/check-in')} />
      </Card>

      {missed.length > 0 && (
        <Card style={{ borderColor: c.high }}>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>
            {missed.length === 1 ? 'You missed 1 planned task' : `You missed ${missed.length} planned tasks`}
          </Text>
          <Muted>No problem. I can fit {missed.length === 1 ? 'it' : 'them'} into the rest of today, or move {missed.length === 1 ? 'it' : 'them'} to tomorrow.</Muted>
          {missed.map((t) => <TaskRow key={t.id} task={t} showSlot onToggle={async () => setTasks(await toggleTask(t))} onDrop={async () => setTasks(await dropTask(t))} />)}
          <Button title="Fix my day" onPress={plan} busy={busy} />
          <Button title="Move to tomorrow" variant="secondary" onPress={missedToTomorrow} />
        </Card>
      )}

      <H>Planned for today</H>
      {planned.length === 0 && <Muted>Nothing planned yet. Tap the button above.</Muted>}
      {planned.map((t) => <TaskRow key={t.id} task={t} showSlot onToggle={async () => setTasks(await toggleTask(t))} onDrop={async () => setTasks(await dropTask(t))} />)}

      {due.length > 0 && <H>Due today or overdue</H>}
      {due.map((t) => <TaskRow key={t.id} task={t} onToggle={async () => setTasks(await toggleTask(t))} onDrop={async () => setTasks(await dropTask(t))} />)}

      {rest.length > 0 && <H>Other open tasks</H>}
      {rest.slice(0, 10).map((t) => <TaskRow key={t.id} task={t} onToggle={async () => setTasks(await toggleTask(t))} onDrop={async () => setTasks(await dropTask(t))} />)}

      {doneToday.length > 0 && <H>Done today</H>}
      {doneToday.map((t) => <TaskRow key={t.id} task={t} onToggle={async () => setTasks(await toggleTask(t))} />)}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
