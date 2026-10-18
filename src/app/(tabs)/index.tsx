import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, DemoBadge, H, Muted, Say, Title } from '@/components/ui';
import { Scene } from '@/components/Scene';
import { TaskRow } from '@/components/TaskRow';
import { CheckIn } from '@/components/CheckIn';
import { FONT, useColors } from '@/lib/theme';
import { useData } from '@/lib/useData';
import { endOfDay, fmtDue, fmtTime, isToday, parseHHMM } from '@/lib/time';
import { planDay } from '@/lib/api';
import { applyPlan, describeMoves, dropTask, isMissed, moveToTomorrow, toggleTask } from '@/lib/actions';
import { toggleListening } from '@/lib/voice';
import { nudgeFor, sayHi } from '@/lib/people';
import { getSettings, saveSettings } from '@/lib/storage';
import type { Task } from '@/lib/types';
import { asleepAt } from '@/lib/sleep';

const rank = { high: 0, medium: 1, low: 2 } as const;
// The open tasks, as one short key, to know whether the list changed since Kasama spoke
const openKey = (list: Task[]) => list.filter((t) => t.status === 'todo').map((t) => t.id).sort().join(',');

// Home follows YOUR day, not the clock (night shift too): a short path for the first hours after you wake up,
// "what's next" after that, and from half an hour before your check-in until you wake, the check-in.
function modeFor(now: Date, wake: string, checkIn: string): 'morning' | 'afternoon' | 'night' {
  const at = (s: string) => { const { hour, minute } = parseHHMM(s); return hour * 60 + minute; };
  const since = (from: number) => (now.getHours() * 60 + now.getMinutes() - from + 1440) % 1440; // minutes since, around midnight
  const nightStart = at(checkIn) - 30;
  const nightLength = (at(wake) - nightStart + 1440) % 1440;
  if (since(nightStart) < nightLength) return 'night';
  return since(at(wake)) < 5 * 60 ? 'morning' : 'afternoon';
}

export default function Home() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { tasks, settings, setTasks } = useData();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [moves, setMoves] = useState<string[]>([]);
  const [planFor, setPlanFor] = useState(''); // which open list the message and moves were made for
  const [showDay, setShowDay] = useState(false);
  const [nudgeDone, setNudgeDone] = useState(false);

  const now = new Date();
  // Inside your Sleep block, Home is the night screen too, whatever the check-in time says
  const sleepy = asleepAt(settings, now);
  const mode = sleepy ? 'night' : modeFor(now, settings.morningDigest || '07:00', settings.eveningReview || '21:30');
  if (mode === 'night' && !showDay) return <CheckIn tasks={tasks} settings={settings} setTasks={setTasks} bedtime={sleepy} onSeeDay={() => setShowDay(true)} />;

  const open = tasks.filter((t) => t.status === 'todo');
  const missed = open.filter((t) => isMissed(t));
  const planned = open.filter((t) => isToday(t.scheduled_start) && !missed.includes(t)).sort((a, b) => (a.scheduled_start ?? '').localeCompare(b.scheduled_start ?? ''));
  const due = open.filter((t) => !planned.includes(t) && !missed.includes(t) && t.due_at && new Date(t.due_at) <= endOfDay());
  const others = open.filter((t) => !planned.includes(t) && !missed.includes(t) && !due.includes(t)).sort((a, b) => rank[a.priority] - rank[b.priority]);
  // Never more than three things on today's path. The rest waits in Things.
  const path: Task[] = [...planned, ...due, ...others].slice(0, 3);
  const waiting = open.length - missed.length - path.length;
  const unplanned = path.filter((t) => !t.scheduled_start).length;
  const doneToday = tasks.filter((t) => t.status === 'done' && isToday(t.done_at));
  const soon = open.find((t) => t.due_at && new Date(t.due_at) > endOfDay() && new Date(t.due_at).getTime() - now.getTime() < 2 * 24 * 60 * 60 * 1000);
  const next = planned.find((t) => new Date(t.scheduled_start ?? 0) >= now) ?? path[0];
  const name = settings.name?.trim();
  const friend = nudgeFor(settings, now.getTime());
  const nudged = async () => { setNudgeDone(true); await saveSettings({ ...(await getSettings()), nudgedAt: new Date().toISOString() }); };

  async function plan() {
    if (open.length === 0) { setPlanFor(openKey(tasks)); return setMessage('Nothing to plan yet. Tell me what is on your mind first.'); }
    setBusy(true);
    try {
      const result = await planDay(tasks, settings);
      const nextTasks = await applyPlan(result);
      // Say plainly what got a time, like a friend would, so the plan is easy to see
      const slots = result.blocks.filter((b) => b.task_id).map((b) => `${fmtTime(b.start)} ${b.title}`);
      setMoves([...describeMoves(missed, nextTasks), ...slots]);
      setTasks(nextTasks);
      setPlanFor(openKey(nextTasks));
      setMessage(slots.length ? result.message : `${result.message} Nothing more fits today, so the rest can wait for tomorrow.`);
    } catch (e) {
      setPlanFor(openKey(tasks));
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function missedToTomorrow() {
    const next = await moveToTomorrow(missed.map((t) => t.id));
    setTasks(next);
    setPlanFor(openKey(next));
    setMoves(missed.map((t) => `Moved ${t.title} to tomorrow`));
  }
  // Kasama's last plan only makes sense for the list it was made for: once you finish, add or
  // let go of something, the old message quietly disappears instead of contradicting the screen
  const fresh = planFor === openKey(tasks);
  const toggle = async (t: Task) => setTasks(await toggleTask(t));
  const drop = async (t: Task) => setTasks(await dropTask(t));
  const talk = () => { router.navigate('/kasama'); setTimeout(toggleListening, 350); };

  const hello = now.getHours() < 12 && now.getHours() >= 4 ? 'Good morning' : now.getHours() >= 12 && now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const finished = `${doneToday.length} thing${doneToday.length === 1 ? '' : 's'}`;
  const line = open.length === 0 && doneToday.length > 0
    ? `You finished ${finished} today, and nothing is left. Rest well.`
    : open.length === 0
      ? 'Your day is wide open. Nothing to carry yet.'
      : doneToday.length > 0
        ? `You've already finished ${finished} today. I saw that.`
        : mode === 'morning' ? "Today's path is short:" : "Here's what's next.";

  return (
    <ScrollView style={{ backgroundColor: c.ground }} contentContainerStyle={{ paddingBottom: 130 }}>
      <View>
        <Scene height={240 + insets.top} time={mode === 'morning' ? 'dawn' : 'day'} />
        <View style={[styles.over, { paddingTop: insets.top + 18 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, color: c.muted, fontSize: 15, fontFamily: FONT.strong }}>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Open my calendar" onPress={() => router.navigate({ pathname: '/things', params: { view: 'calendar', at: String(Date.now()) } })} style={styles.round}>
              <Ionicons name="calendar-outline" size={21} color={c.text} />
            </Pressable>
          </View>
          <Title size={28} style={{ marginTop: 14 }}>{hello}{name ? `, ${name}` : ''}.</Title>
          <Say style={{ marginTop: 8, maxWidth: 300 }}>{line}</Say>
        </View>
      </View>

      <View style={styles.body}>
        <DemoBadge />
        {fresh && !!message && <Say>{message}</Say>}
        {fresh && moves.map((m) => <Text key={m} style={{ color: c.accent, fontFamily: FONT.strong, fontSize: 15 }}>✓ {m}</Text>)}

        {missed.length > 0 && (
          <View style={styles.soft}>
            <Title size={18}>{missed.length === 1 ? 'One thing slipped by' : `${missed.length} things slipped by`}</Title>
            <Muted>No problem. I can fit {missed.length === 1 ? 'it' : 'them'} into the rest of today, or move {missed.length === 1 ? 'it' : 'them'} to tomorrow.</Muted>
            {missed.map((t) => <TaskRow key={t.id} task={t} showSlot onToggle={() => toggle(t)} onDrop={() => drop(t)} />)}
            <Button title="Fix my day" onPress={plan} busy={busy} />
            <Button title="Move to tomorrow" variant="link" onPress={missedToTomorrow} />
          </View>
        )}

        {mode === 'afternoon' && next && (
          <View style={[styles.soft, { backgroundColor: c.band }]}>
            <Text style={{ color: c.accent, fontFamily: FONT.strong, fontSize: 14 }}>NEXT{next.scheduled_start ? ` · ${fmtTime(next.scheduled_start)}` : next.due_at ? ` · by ${fmtDue(next.due_at)}` : ''}</Text>
            <Title size={22}>{next.title}</Title>
            <Button title="Done" onPress={() => toggle(next)} />
          </View>
        )}

        {path.filter((t) => mode !== 'afternoon' || t !== next).length > 0 && <H>{mode === 'morning' ? "Today's path" : 'After that'}</H>}
        {path.filter((t) => mode !== 'afternoon' || t !== next).map((t) => (
          <TaskRow key={t.id} task={t} showSlot={!!t.scheduled_start} onToggle={() => toggle(t)} onDrop={() => drop(t)} />
        ))}
        {waiting > 0 && (
          <Text accessibilityRole="link" onPress={() => router.navigate('/things')} style={{ color: c.accent, fontFamily: FONT.strong, fontSize: 15, paddingVertical: 8 }}>
            + {waiting} more waiting in Things
          </Text>
        )}
        {soon && <Muted style={{ marginTop: 6 }}>Heads up: {soon.title} is due {fmtDue(soon.due_at)}.</Muted>}
        {friend && !nudgeDone && (
          <View style={[styles.soft, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
            <Say style={{ flex: 1, fontSize: 16 }}>You haven&apos;t said hi to {friend.name} in a while. Want to?</Say>
            <Button title="Say hi" variant="link" onPress={async () => { await sayHi(friend); await nudged(); }} />
            <Button title="Later" variant="link" onPress={nudged} />
          </View>
        )}

        {doneToday.length > 0 && <H>Done today</H>}
        {doneToday.map((t) => <TaskRow key={t.id} task={t} onToggle={() => toggle(t)} />)}

        <View style={{ height: 12 }} />
        {open.length === 0 && <Button title="Tell me what's on your mind" onPress={talk} />}
        {/* Planning is an offer, not the point of Home: it only shows when some of today's things have no time yet */}
        {unplanned > 0 && missed.length === 0 && (
          <Button title={unplanned === 1 ? 'Want me to find a time for it?' : 'Want me to find times for these?'} variant="link" onPress={plan} busy={busy} />
        )}
        {mode === 'night' && <Button title="Back to tonight's check-in" variant="link" onPress={() => setShowDay(false)} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  over: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 24 },
  body: { paddingHorizontal: 24, gap: 6 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' },
  soft: { borderRadius: 26, padding: 18, gap: 8, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.75)' },
});
