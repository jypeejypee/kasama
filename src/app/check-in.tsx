import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Muted } from '@/components/ui';
import { useColors } from '@/lib/theme';
import { useData } from '@/lib/useData';
import { endOfDay, fmtDue, fmtTime, isToday } from '@/lib/time';
import { dropTask, moveToTomorrow, toggleTask } from '@/lib/actions';
import type { Task } from '@/lib/types';

// Kasama goes through today with you: tick off what you finished, move the rest to tomorrow.
export default function CheckIn() {
  const c = useColors();
  const { tasks, setTasks } = useData();
  const [handled, setHandled] = useState<Record<string, string>>({}); // task id -> what you chose

  const todays = (t: Task) => isToday(t.scheduled_start) || (!!t.due_at && new Date(t.due_at) <= endOfDay());
  const list = tasks.filter((t) => todays(t) && (t.status === 'todo' || handled[t.id]));
  const left = list.filter((t) => !handled[t.id]);
  const doneToday = tasks.filter((t) => t.status === 'done' && isToday(t.done_at)).length;

  const mark = (t: Task, label: string) => setHandled((h) => ({ ...h, [t.id]: label }));
  const done = async (t: Task) => { setTasks(await toggleTask(t)); mark(t, 'Done'); };
  const tomorrow = async (t: Task) => { setTasks(await moveToTomorrow([t.id])); mark(t, 'Moved to tomorrow'); };
  const drop = async (t: Task) => { setTasks(await dropTask(t)); mark(t, 'Dropped'); };
  async function allToTomorrow() {
    setTasks(await moveToTomorrow(left.map((t) => t.id)));
    setHandled((h) => ({ ...h, ...Object.fromEntries(left.map((t) => [t.id, 'Moved to tomorrow'])) }));
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Card>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>How did today go?</Text>
        <Muted>
          {doneToday > 0 ? `You finished ${doneToday} task${doneToday === 1 ? '' : 's'} today. Nice work. ` : ''}
          {left.length > 0 ? 'For each one left, tell me what happened.' : 'Everything for today is handled. Rest well.'}
        </Muted>
      </Card>

      {list.map((t) => (
        <Card key={t.id} style={{ borderLeftWidth: 4, borderLeftColor: c[t.priority] }}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>{t.title}</Text>
          <Muted>{[t.scheduled_start && `Planned ${fmtTime(t.scheduled_start)}`, t.due_at && `Due ${fmtDue(t.due_at)}`].filter(Boolean).join(' · ')}</Muted>
          {handled[t.id] ? (
            <Text style={{ color: c.accent, fontWeight: '700' }}>{handled[t.id]}</Text>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button title="Done" onPress={() => done(t)} /></View>
              <View style={{ flex: 1 }}><Button title="Tomorrow" variant="secondary" onPress={() => tomorrow(t)} /></View>
              <View style={{ flex: 1 }}><Button title="Drop" variant="secondary" onPress={() => drop(t)} /></View>
            </View>
          )}
        </Card>
      ))}

      {left.length > 1 && <Button title={`Move all ${left.length} to tomorrow`} variant="secondary" onPress={allToTomorrow} />}
      <Button title={left.length === 0 ? 'Good night' : 'Close'} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
