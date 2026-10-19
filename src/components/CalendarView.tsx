import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Muted } from '@/components/ui';
import { FONT, useColors } from '@/lib/theme';
import { addTasks, toggleTask } from '@/lib/actions';
import { connectCalendars, eventsOn, type PhoneEvent } from '@/lib/calendar';
import { getSettings, saveSettings } from '@/lib/storage';
import { fmtTime } from '@/lib/time';
import type { Settings, Task } from '@/lib/types';

const PEBBLE = { high: '#e2a77e', medium: '#9ec29a', low: '#b8b0a2' } as const;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (iso: string | null, d: Date) => !!iso && midnight(new Date(iso)).getTime() === d.getTime();
const minutesOf = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const clock = (min: number) => fmtTime(new Date(2000, 0, 1, Math.floor(min / 60), min % 60).toISOString());

type Row = { key: string; at: number; time: string; title: string; kind: 'block' | 'event' | 'task'; color: string; task?: Task };

// "Dentist 3pm" or "call Mama at 7:30 pm" → a time on that day (or none)
function timeIn(text: string): { title: string; h: number; m: number } | null {
  const t = text.match(/\s*(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!t) return null;
  let h = Number(t[1]) % 12;
  if (t[3].toLowerCase() === 'pm') h += 12;
  return { title: text.replace(t[0], '').trim(), h, m: Number(t[2] ?? 0) };
}

// Your own calendar: a week at a time, everything for the day you tap
export function CalendarView({ tasks, setTasks, settings }: { tasks: Task[]; setTasks: (t: Task[]) => void; settings: Settings }) {
  const c = useColors();
  const today = midnight(new Date());
  const [day, setDay] = useState(today);
  const [week, setWeek] = useState(0); // weeks (or months, in month view) away from now
  const [mode, setMode] = useState<'week' | 'month'>('month');
  const [events, setEvents] = useState<PhoneEvent[]>([]);
  const [connected, setConnected] = useState<string[] | null>(null); // set right after connecting here
  const ids = connected ?? settings.calendarIds ?? [];
  const [text, setText] = useState('');
  const [note, setNote] = useState('');

  const idKey = ids.join(',');
  useEffect(() => {
    let live = true;
    eventsOn(idKey ? idKey.split(',') : [], day).then((e) => { if (live) setEvents(e); });
    return () => { live = false; };
  }, [idKey, day]);

  // Week (Sunday first) or the whole month, moved by ‹ ›
  const plus = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const sunday = plus(today, -today.getDay() + week * 7);
  const first = new Date(today.getFullYear(), today.getMonth() + week, 1); // in month view, "week" counts months
  const gridStart = plus(first, -first.getDay());
  const lastOfMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const weeksShown = Math.ceil((first.getDay() + lastOfMonth.getDate()) / 7);
  const days = mode === 'week'
    ? Array.from({ length: 7 }, (_, i) => plus(sunday, i))
    : Array.from({ length: weeksShown * 7 }, (_, i) => plus(gridStart, i));
  const busy = (d: Date) => tasks.some((t) => t.status === 'todo' && (sameDay(t.scheduled_start, d) || sameDay(t.due_at, d)));
  const switchMode = (m: 'week' | 'month') => { setMode(m); setWeek(0); };

  const rows: Row[] = [
    ...settings.fixedBlocks.filter((b) => b.days.includes(day.getDay())).map((b) => ({
      key: `b-${b.id}`, at: minutesOf(b.start), time: `${clock(minutesOf(b.start))} – ${clock(minutesOf(b.end))}`, title: b.label, kind: 'block' as const, color: '#c9c1b4',
    })),
    ...events.map((e) => ({
      key: `e-${e.id}`, at: e.allDay ? -1 : e.start.getHours() * 60 + e.start.getMinutes(), time: e.allDay ? 'All day' : `${fmtTime(e.start.toISOString())} – ${fmtTime(e.end.toISOString())}`, title: e.title, kind: 'event' as const, color: e.color ?? '#8fa9c9',
    })),
    ...tasks.filter((t) => t.status !== 'dropped' && (sameDay(t.scheduled_start, day) || (!t.scheduled_start && sameDay(t.due_at, day)))).map((t) => {
      const when = new Date((t.scheduled_start ?? t.due_at)!);
      const anyTime = !t.scheduled_start && when.getHours() === 23 && when.getMinutes() === 59;
      return {
        key: `t-${t.id}`, at: anyTime ? 24 * 60 : when.getHours() * 60 + when.getMinutes(),
        time: t.scheduled_start ? fmtTime(t.scheduled_start) : anyTime ? 'any time' : `by ${fmtTime(t.due_at)}`,
        title: t.title, kind: 'task' as const, color: PEBBLE[t.priority], task: t,
      };
    }),
  ].sort((a, b) => a.at - b.at);

  async function add() {
    if (!text.trim()) return;
    const found = timeIn(text);
    const due = new Date(day);
    if (found) due.setHours(found.h, found.m, 0, 0);
    else due.setHours(23, 59, 0, 0); // no time: just "this day"
    setTasks(await addTasks([{ title: (found?.title || text).trim(), notes: null, due_at: due.toISOString(), duration_min: 30, priority: 'medium', repeat: null }]));
    setText('');
  }

  async function connect() {
    const r = await connectCalendars();
    if (r === 'denied') return setNote('No problem. If you change your mind, allow Calendar for Kasama in your phone settings.');
    if (r === 'unavailable') return setNote('Your phone calendar works in the installed app, not in Expo Go.');
    const chosen = r.filter((x) => !/holiday|birthday|pista/i.test(x.title)).map((x) => x.id);
    await saveSettings({ ...(await getSettings()), calendarIds: chosen });
    setConnected(chosen);
    setNote(chosen.length ? '' : 'I found no calendars on this phone yet.');
  }

  const label = day.getTime() === today.getTime() ? 'Today' : day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.modes, { backgroundColor: 'rgba(255,255,255,0.7)' }]} accessibilityRole="tablist">
        {(['week', 'month'] as const).map((m) => (
          <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: mode === m }} onPress={() => switchMode(m)} style={[styles.mode, mode === m && { backgroundColor: c.accent }]}>
            <Text style={{ color: mode === m ? '#ffffff' : c.text, fontFamily: FONT.bold, fontSize: 14 }}>{m === 'week' ? 'Week' : 'Month'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.weekHead}>
        <Pressable accessibilityRole="button" accessibilityLabel={mode === 'week' ? 'Previous week' : 'Previous month'} onPress={() => setWeek(week - 1)} hitSlop={10} style={styles.arrow}><Ionicons name="chevron-back" size={20} color={c.text} /></Pressable>
        <Text style={{ flex: 1, textAlign: 'center', color: c.text, fontFamily: FONT.title, fontSize: 16 }}>{(mode === 'week' ? sunday : first).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={mode === 'week' ? 'Next week' : 'Next month'} onPress={() => setWeek(week + 1)} hitSlop={10} style={styles.arrow}><Ionicons name="chevron-forward" size={20} color={c.text} /></Pressable>
      </View>
      {mode === 'month' && (
        <View style={styles.week}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: c.muted, fontFamily: FONT.semi, fontSize: 12 }}>{w}</Text>)}
        </View>
      )}
      <View style={[styles.week, mode === 'month' && { flexWrap: 'wrap', gap: 0 }]}>
        {days.map((d) => {
          const on = d.getTime() === day.getTime();
          const isToday = d.getTime() === today.getTime();
          const outside = mode === 'month' && d.getMonth() !== first.getMonth();
          return (
            <Pressable
              key={d.getTime()}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={d.toDateString()}
              onPress={() => setDay(d)}
              style={[mode === 'week' ? styles.day : styles.cell, on && { backgroundColor: c.accent }, outside && { opacity: 0.35 }]}
            >
              {mode === 'week' && <Text style={{ color: on ? '#ffffff' : c.muted, fontFamily: FONT.semi, fontSize: 12 }}>{d.toLocaleDateString('en-US', { weekday: 'narrow' })}</Text>}
              <Text style={{ color: on ? '#ffffff' : c.text, fontFamily: FONT.title, fontSize: mode === 'week' ? 17 : 15, textDecorationLine: isToday && !on ? 'underline' : 'none' }}>{d.getDate()}</Text>
              <View style={[styles.dot, { backgroundColor: busy(d) ? (on ? '#ffffff' : c.accent) : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>
      {(week !== 0 || day.getTime() !== today.getTime()) && <Button title="Back to today" variant="link" onPress={() => { setWeek(0); setDay(today); }} />}

      <Text style={{ color: c.text, fontFamily: FONT.title, fontSize: 18, marginTop: 4 }}>{label}</Text>
      {rows.length === 0 && <Muted>Nothing on this day yet.</Muted>}
      {rows.map((r) => (
        <View key={r.key} style={styles.row}>
          <Text style={[styles.time, { color: c.muted }]}>{r.time}</Text>
          {r.task ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: r.task.status === 'done' }} accessibilityLabel={`Done: ${r.title}`} onPress={async () => setTasks(await toggleTask(r.task!))} hitSlop={8} style={[styles.pebble, { borderColor: r.color, backgroundColor: r.task.status === 'done' ? r.color : 'transparent' }]}>
              {r.task.status === 'done' && <Ionicons name="checkmark" size={13} color="#ffffff" />}
            </Pressable>
          ) : (
            <View style={[styles.mark, { backgroundColor: r.color }]} />
          )}
          <Text style={{ flex: 1, color: r.kind === 'block' ? c.muted : c.text, fontFamily: r.kind === 'block' ? FONT.semi : FONT.title, fontSize: 15, textDecorationLine: r.task?.status === 'done' ? 'line-through' : 'none' }}>{r.title}</Text>
        </View>
      ))}

      <TextInput
        accessibilityLabel={`Add something to ${label}`}
        value={text}
        onChangeText={setText}
        placeholder={`Add to ${label === 'Today' ? 'today' : 'this day'}, like "dentist 3pm"`}
        placeholderTextColor="#8a9590"
        onSubmitEditing={add}
        returnKeyType="done"
        style={{ color: c.text, backgroundColor: '#ffffff', borderRadius: 26, paddingHorizontal: 20, paddingVertical: 14, fontSize: 16, fontFamily: FONT.body, marginTop: 4 }}
      />
      {!!text.trim() && <Button title="Add" onPress={add} />}

      {ids.length === 0 && (
        <View style={[styles.connect, { backgroundColor: c.band }]}>
          <Text style={{ color: c.text, fontFamily: FONT.title, fontSize: 15 }}>See your phone calendar here too</Text>
          <Muted style={{ fontSize: 14 }}>Google, Samsung or Outlook events show here, only on your phone. When I plan your day, I only use the times you&apos;re busy.</Muted>
          <Button title="Connect my phone calendar" variant="secondary" onPress={connect} />
        </View>
      )}
      {!!note && <Muted>{note}</Muted>}
    </View>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', alignSelf: 'center', padding: 4, borderRadius: 22 },
  mode: { minHeight: 40, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 8, gap: 2, borderRadius: 14 },
  weekHead: { flexDirection: 'row', alignItems: 'center' },
  arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.75)' },
  week: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2, borderTopLeftRadius: 18, borderTopRightRadius: 14, borderBottomRightRadius: 18, borderBottomLeftRadius: 14 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  time: { width: 112, fontSize: 13, fontFamily: FONT.semi },
  mark: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 5 },
  pebble: { width: 20, height: 19, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 10, borderTopRightRadius: 9, borderBottomRightRadius: 11, borderBottomLeftRadius: 8 },
  connect: { borderRadius: 24, padding: 16, gap: 8, marginTop: 6 },
});
