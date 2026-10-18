import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H, Muted, Say, Title } from '@/components/ui';
import { Scene } from '@/components/Scene';
import { FONT, useColors } from '@/lib/theme';
import { useData } from '@/lib/useData';
import { dropTask, updateTaskSafely } from '@/lib/actions';
import { getIdeas, getMoods, getSettings, saveSettings } from '@/lib/storage';
import { shouldInvite } from '@/lib/people';
import { dayKey } from '@/lib/time';
import type { Mood, Task } from '@/lib/types';

const DAY = 24 * 60 * 60 * 1000;
const MOOD = { Masaya: '#9ec29a', 'Okay lang': '#e8c9a0', Pagod: '#b8a6cc' } as const;

// Proof that your week mattered: what you finished, how you felt, and what Kasama noticed
export default function Journey() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { tasks, settings, setTasks, reload } = useData();
  const [kindReply, setKindReply] = useState(false);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [ideaCount, setIdeaCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(useCallback(() => {
    getMoods().then(setMoods);
    getIdeas().then((i) => setIdeaCount(i.length));
    setNow(Date.now());
  }, []));

  const done = (since: number) => tasks.filter((t) => t.status === 'done' && t.done_at && now - Date.parse(t.done_at) < since);
  const week = done(7 * DAY).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));
  const month = done(30 * DAY);
  const name = settings.name?.trim();

  const letter = week.length === 0
    ? `A quiet week${name ? `, ${name}` : ''}. That's allowed. Rest is part of the journey too.`
    : `This week you finished ${week.length} thing${week.length === 1 ? '' : 's'}${week.length > 1 ? `, including ${week.slice(0, 2).map((t) => t.title).join(' and ')}` : `: ${week[0].title}`}. I'm proud of you${name ? `, ${name}` : ''}.`;

  // When do you get the most done? Only said once there's enough to be honest about it.
  const buckets = { morning: 0, afternoon: 0, evening: 0 };
  month.forEach((t) => { const h = new Date(t.done_at!).getHours(); buckets[h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'] += 1; });
  const best = (Object.entries(buckets) as [keyof typeof buckets, number][]).sort((a, b) => b[1] - a[1])[0];
  const pattern = month.length >= 5 ? `You get the most done in the ${best[0]}. I'll keep that in mind when I plan.` : '';

  // The last 7 days, oldest first, from the evening check-ins
  const days = Array.from({ length: 7 }, (_, i) => new Date(now - (6 - i) * DAY));
  const moodOf = (d: Date) => moods.find((m) => m.date === dayKey(d))?.feeling;

  // Things that have waited two weeks or more: still want them?
  const stale = tasks.filter((t) => t.status === 'todo' && now - Date.parse(t.created_at) > 14 * DAY).slice(0, 3);
  const keep = async (t: Task) => setTasks(await updateTaskSafely(t.id, { created_at: new Date().toISOString() }));
  const letGo = async (t: Task) => setTasks(await dropTask(t));

  const known = (settings.aboutMe ?? '').split('\n').map((l) => l.replace(/^- /, '').trim()).filter(Boolean);

  return (
    <ScrollView style={{ backgroundColor: c.ground }} contentContainerStyle={{ paddingBottom: 130 }}>
      <View>
        <Scene height={150 + insets.top} />
        <View style={[styles.over, { paddingTop: insets.top + 18 }]}>
          <Title size={24}>Journey</Title>
          <Muted style={{ fontSize: 14 }}>your week, gently</Muted>
        </View>
      </View>
      <View style={styles.body}>
        <View style={[styles.letter, { backgroundColor: '#ffffff' }]}>
          <Text style={{ color: c.accent, fontFamily: FONT.strong, fontSize: 13 }}>A NOTE FROM KASAMA</Text>
          <Say>{letter}</Say>
          {!!pattern && <Say style={{ color: c.muted }}>{pattern}</Say>}
        </View>

        {shouldInvite(settings, now) && (
          <View style={[styles.letter, { backgroundColor: c.band }]}>
            <Say>Can I ask you something? Is there someone you trust, a friend, family, anyone, that you&apos;d like me to remind you to check in with sometimes?</Say>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pressable accessibilityRole="button" onPress={() => router.navigate('/you')} style={[styles.small, { backgroundColor: c.accent }]}><Text style={{ color: '#ffffff', fontFamily: FONT.bold }}>Add someone</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={async () => { await saveSettings({ ...(await getSettings()), peopleAsked: true }); setKindReply(true); reload(); }} style={styles.small}><Text style={{ color: c.text, fontFamily: FONT.bold }}>No one right now</Text></Pressable>
            </View>
          </View>
        )}
        {kindReply && <Say style={{ color: c.muted }}>That&apos;s okay. I&apos;m here. And if you ever want someone to talk to, I can help you find people who listen.</Say>}

        <H>How your week felt</H>
        <View style={styles.moods}>
          {days.map((d) => {
            const m = moodOf(d);
            return (
              <View key={dayKey(d)} style={{ alignItems: 'center', gap: 6 }} accessible accessibilityLabel={`${d.toLocaleDateString('en-US', { weekday: 'long' })}: ${m ?? 'no check-in'}`}>
                <View style={[styles.dot, m ? { backgroundColor: MOOD[m] } : { borderWidth: 2, borderColor: '#d8d1c3' }]} />
                <Text style={{ color: c.muted, fontFamily: FONT.semi, fontSize: 12 }}>{d.toLocaleDateString('en-US', { weekday: 'narrow' })}</Text>
              </View>
            );
          })}
        </View>
        <Muted style={{ fontSize: 13 }}>
          {Object.entries(MOOD).map(([k]) => k).join(' · ')}. Tell me each night in the check-in.
        </Muted>

        {stale.length > 0 && (
          <>
            <H>Still want these?</H>
            <Muted>They&apos;ve been waiting two weeks. It&apos;s okay to let things go.</Muted>
            {stale.map((t) => (
              <View key={t.id} style={styles.stale}>
                <Text style={{ flex: 1, color: c.text, fontFamily: FONT.title, fontSize: 16 }}>{t.title}</Text>
                <Pressable accessibilityRole="button" onPress={() => keep(t)} style={styles.small}><Text style={{ color: c.text, fontFamily: FONT.bold }}>Keep</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => letGo(t)} style={[styles.small, { backgroundColor: c.accent }]}><Text style={{ color: '#ffffff', fontFamily: FONT.bold }}>Let go</Text></Pressable>
              </View>
            ))}
          </>
        )}

        <H>What I know about you</H>
        {known.length === 0 ? (
          <Muted>Nothing yet. As we talk, I&apos;ll remember what matters to you, and you can change it anytime.</Muted>
        ) : (
          known.slice(0, 5).map((k) => <Say key={k} style={{ fontSize: 16 }}>· {k}</Say>)
        )}
        <Pressable accessibilityRole="link" onPress={() => router.navigate('/you')} style={{ paddingVertical: 8 }}>
          <Text style={{ color: c.accent, fontFamily: FONT.strong, fontSize: 15 }}>{known.length > 5 ? `See all ${known.length} and edit` : 'Edit what I know'}</Text>
        </Pressable>

        {ideaCount > 0 && (
          <Pressable accessibilityRole="link" onPress={() => router.navigate('/things')} style={{ paddingVertical: 4 }}>
            <Muted>You&apos;ve collected {ideaCount} idea{ideaCount === 1 ? '' : 's'} so far. They&apos;re safe in Things.</Muted>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  over: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 24 },
  body: { paddingHorizontal: 24, gap: 8 },
  letter: { borderTopLeftRadius: 28, borderTopRightRadius: 24, borderBottomRightRadius: 30, borderBottomLeftRadius: 22, padding: 20, gap: 10, marginTop: 4, shadowColor: '#3b3430', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  moods: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  dot: { width: 30, height: 30, borderRadius: 15 },
  stale: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  small: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.85)' },
});
