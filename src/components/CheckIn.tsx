import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { FONT, NIGHT } from '@/lib/theme';
import { endOfDay, fmtDue, fmtTime, isToday } from '@/lib/time';
import { dropTask, moveToTomorrow, toggleTask } from '@/lib/actions';
import { rememberLatest, saveMood } from '@/lib/storage';
import type { Mood, Settings, Task } from '@/lib/types';

const FEELINGS: [Mood['feeling'], string][] = [
  ['Masaya', 'Love that. Hold onto this feeling tonight.'],
  ['Okay lang', 'Okay is enough. You showed up today.'],
  ['Pagod', "Then tomorrow stays soft. I'll plan a lighter day."],
];

// At night, Home becomes this: quiet sky, kind words, and closing the day together
export function CheckIn({ tasks, settings, setTasks, onSeeDay }: { tasks: Task[]; settings: Settings; setTasks: (t: Task[]) => void; onSeeDay: () => void }) {
  const insets = useSafeAreaInsets();
  const [handled, setHandled] = useState<Record<string, string>>({}); // task id -> what you chose
  const [feeling, setFeeling] = useState<number | null>(null);

  const todays = (t: Task) => isToday(t.scheduled_start) || (!!t.due_at && new Date(t.due_at) <= endOfDay());
  const list = tasks.filter((t) => todays(t) && (t.status === 'todo' || handled[t.id]));
  const left = list.filter((t) => !handled[t.id]);
  const doneToday = tasks.filter((t) => t.status === 'done' && isToday(t.done_at));
  const name = settings.name?.trim();

  const mark = (t: Task, label: string) => setHandled((h) => ({ ...h, [t.id]: label }));
  const done = async (t: Task) => { setTasks(await toggleTask(t)); mark(t, 'Done'); };
  const tomorrow = async (t: Task) => { setTasks(await moveToTomorrow([t.id])); mark(t, 'Moved to tomorrow'); };
  const drop = async (t: Task) => { setTasks(await dropTask(t)); mark(t, 'Let go'); };
  async function feel(i: number) {
    setFeeling(i);
    await saveMood(FEELINGS[i][0]);
    // Kasama learns how your days feel, so it can plan kinder ones
    if (FEELINGS[i][0] === 'Pagod') await rememberLatest('Felt tired on', `Felt tired on ${new Date().toDateString()}, keep the next day light`);
  }

  const praise = doneToday.length
    ? `You finished ${doneToday.slice(0, 2).map((t) => t.title).join(' and ')}${doneToday.length > 2 ? ` and ${doneToday.length - 2} more` : ''}. I'm proud of you.`
    : 'Some days are just for getting through. That counts too.';

  return (
    <View style={{ flex: 1, backgroundColor: NIGHT.bg }}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMin slice" style={StyleSheet.absoluteFill}>
        <Circle cx={40} cy={70} r={1.6} fill={NIGHT.moon} /><Circle cx={120} cy={44} r={1.2} fill={NIGHT.moon} /><Circle cx={210} cy={82} r={1.8} fill={NIGHT.moon} /><Circle cx={70} cy={128} r={1.1} fill={NIGHT.moon} /><Circle cx={370} cy={160} r={1.3} fill={NIGHT.moon} />
        <Circle cx={318} cy={98} r={30} fill={NIGHT.moon} />
        <Circle cx={318} cy={98} r={46} fill="none" stroke={NIGHT.moon} strokeWidth={12} opacity={0.08} />
        <Rect y={740} width={390} height={104} fill="#2b3350" />
        <Path d="M290 754 H346 M300 768 H336" stroke={NIGHT.moon} strokeWidth={3} strokeLinecap="round" opacity={0.35} />
      </Svg>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 100, paddingHorizontal: 28, paddingBottom: 140, gap: 14 }}>
        <Text accessibilityRole="header" style={styles.title}>Hey{name ? ` ${name}` : ''}. You made it through today.</Text>
        <Text style={styles.say}>{praise}</Text>
        {left.length > 0 && <Text style={styles.say}>A few things are still open. For each one, what should we do?</Text>}

        {list.map((t) => (
          <View key={t.id} style={styles.item}>
            <Text style={{ color: NIGHT.text, fontFamily: FONT.title, fontSize: 17 }}>{t.title}</Text>
            <Text style={{ color: NIGHT.muted, fontFamily: FONT.body, fontSize: 14 }}>{[t.scheduled_start && `planned ${fmtTime(t.scheduled_start)}`, t.due_at && `due ${fmtDue(t.due_at)}`].filter(Boolean).join(' · ')}</Text>
            {handled[t.id] ? (
              <Text style={{ color: NIGHT.moon, fontFamily: FONT.strong }}>✓ {handled[t.id]}</Text>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Pill label="Done" strong onPress={() => done(t)} />
                <Pill label="Tomorrow" onPress={() => tomorrow(t)} />
                <Pill label="Let go" onPress={() => drop(t)} />
              </View>
            )}
          </View>
        ))}

        <Text style={[styles.say, { fontFamily: FONT.title, color: NIGHT.text, marginTop: 8 }]}>How are you feeling?</Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {FEELINGS.map(([label], i) => <Pill key={label} label={label} strong={feeling === i} onPress={() => feel(i)} />)}
        </View>
        {feeling !== null && <Text style={styles.say}>{FEELINGS[feeling][1]}</Text>}

        <Text style={[styles.say, { marginTop: 10 }]}>Sleep well{name ? `, ${name}` : ''}. I&apos;ll be here in the morning.</Text>
        <Pressable accessibilityRole="button" onPress={onSeeDay} style={{ alignSelf: 'center', padding: 14 }}>
          <Text style={{ color: NIGHT.muted, fontFamily: FONT.bold, fontSize: 15 }}>See today&apos;s plan instead</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Pill({ label, strong, onPress }: { label: string; strong?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.pill, strong ? { backgroundColor: NIGHT.moon, borderColor: NIGHT.moon } : null]}>
      <Text style={{ color: strong ? NIGHT.bg : NIGHT.text, fontFamily: FONT.bold, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: NIGHT.text, fontFamily: FONT.title, fontSize: 27, lineHeight: 34 },
  say: { color: NIGHT.muted, fontFamily: FONT.body, fontSize: 17, lineHeight: 26 },
  item: { gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#353d5e' },
  pill: { minHeight: 46, paddingHorizontal: 18, justifyContent: 'center', borderWidth: 1, borderColor: NIGHT.line, borderTopLeftRadius: 24, borderTopRightRadius: 20, borderBottomRightRadius: 24, borderBottomLeftRadius: 20 },
});
