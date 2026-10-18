import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, DemoBadge, H, Muted, Title } from '@/components/ui';
import { FONT, setPlace, useColors } from '@/lib/theme';
import { DEFAULT_SETTINGS, getSettings, getTasks, newId, saveSettings, saveTasks } from '@/lib/storage';
import { rescheduleAll, sendTestNotification, setupNotifications } from '@/lib/notifications';
import { validHHMM } from '@/lib/time';
import { DEMO } from '@/lib/api';
import type { Encourage, Faith, FixedBlock, Place, Reminders, Settings, Support } from '@/lib/types';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const PLACES: [Place, string, string][] = [
  ['dagat', 'Dagat', 'by the sea · thoughts sail as paraw'],
  ['bundok', 'Bundok', 'in the mountains · thoughts drift as clouds'],
  ['palayan', 'Palayan', 'over the rice fields · thoughts fly as kites'],
];
const ENCOURAGE: [Encourage, string][] = [['quiet', 'Just the tools'], ['gentle', 'A little'], ['cheer', 'Motivate me']];
const SUPPORT: [Support, string][] = [['ask', 'Ask me first'], ['listen', 'Just listen'], ['advise', 'Help me fix it']];
const REMINDERS: [Reminders, string, string][] = [
  ['quiet', 'Quiet', 'Just my morning hello and evening check-in.'],
  ['calm', 'Calm', 'Plus when a planned task starts, and if a deadline needs you.'],
  ['all', 'Remind me of everything', 'Also an hour before deadlines, and "Did you finish?" after each task.'],
];
const FAITH: [Faith, string][] = [['none', 'None'], ['christian', 'Christian'], ['spiritual', 'Spiritual'], ['other', 'Other']];

export default function You() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [msg, setMsg] = useState('');
  // Load the saved settings each time you open this screen (chat may have added to About me)
  useFocusEffect(useCallback(() => { getSettings().then(setS); }, []));

  const field = { color: c.text, backgroundColor: '#ffffff', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, fontFamily: FONT.body } as const;
  const setBlock = (id: string, patch: Partial<FixedBlock>) => setS({ ...s, fixedBlocks: s.fixedBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  // Changing your place shows right away and is saved right away
  async function pickPlace(p: Place) {
    setS({ ...s, place: p });
    setPlace(p);
    await saveSettings({ ...(await getSettings()), place: p });
  }

  async function save() {
    const times = [s.morningDigest, s.eveningReview, ...s.fixedBlocks.flatMap((b) => [b.start, b.end])];
    if (!times.every(validHHMM)) return setMsg('Use 24-hour times like 07:00 or 21:30.');
    await saveSettings(s);
    await rescheduleAll();
    setMsg('Saved. Your reminders follow these now.');
  }

  async function test() {
    const ok = await setupNotifications();
    if (!ok) return setMsg('Notifications are off. Turn them on for Kasama in your phone settings.');
    try {
      await sendTestNotification();
      setMsg('A test notification will appear in 5 seconds. You can lock your phone.');
    } catch {
      setMsg("This phone or Expo Go couldn't send a test notification. A development build fixes this.");
    }
  }

  async function clearDone() {
    const tasks = await getTasks();
    await saveTasks(tasks.filter((t) => t.status === 'todo'));
    setMsg('Cleared finished and let-go tasks.');
  }

  return (
    <ScrollView style={{ backgroundColor: c.sky }} contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 24, paddingBottom: 130, gap: 10 }} keyboardShouldPersistTaps="handled">
      <Title size={24}>You</Title>
      <Muted>Make me yours. Change anything, anytime. I&apos;ll learn the rest as we talk.</Muted>

      <H>Where do you feel calm?</H>
      {PLACES.map(([p, name, line]) => {
        const on = (s.place ?? 'dagat') === p;
        return (
          <Pressable key={p} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => pickPlace(p)} style={[styles.place, { borderColor: on ? c.accent : 'transparent' }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontFamily: FONT.title, fontSize: 17 }}>{name}</Text>
              <Muted style={{ fontSize: 14 }}>{line}</Muted>
            </View>
            {on && <Ionicons name="checkmark" size={22} color={c.accent} />}
          </Pressable>
        );
      })}

      <H>What should I call you?</H>
      <TextInput accessibilityLabel="Your name" value={s.name ?? ''} onChangeText={(v) => setS({ ...s, name: v })} style={field} placeholder="Your name or nickname" placeholderTextColor="#8a9590" />

      <H>How much should I cheer you on?</H>
      <View style={styles.wrap}>{ENCOURAGE.map(([v, label]) => <Chip key={v} label={label} active={(s.encourage ?? 'gentle') === v} onPress={() => setS({ ...s, encourage: v })} />)}</View>

      <H>When things are hard, I should…</H>
      <View style={styles.wrap}>{SUPPORT.map(([v, label]) => <Chip key={v} label={label} active={(s.support ?? 'ask') === v} onPress={() => setS({ ...s, support: v })} />)}</View>

      <H>Faith (only if you want)</H>
      <View style={styles.wrap}>{FAITH.map(([v, label]) => <Chip key={v} label={label} active={(s.faith ?? 'none') === v} onPress={() => setS({ ...s, faith: v })} />)}</View>
      {s.faith === 'other' && <TextInput accessibilityLabel="Your faith" value={s.faithOther ?? ''} onChangeText={(v) => setS({ ...s, faithOther: v })} style={field} placeholder="Write your faith in your own words" placeholderTextColor="#8a9590" />}

      <H>How often should I tap your shoulder?</H>
      <View style={styles.wrap}>{REMINDERS.map(([v, label]) => <Chip key={v} label={label} active={(s.reminders ?? 'calm') === v} onPress={() => setS({ ...s, reminders: v })} />)}</View>
      <Muted>{REMINDERS.find(([v]) => v === (s.reminders ?? 'calm'))?.[2]} I never send anything between 10 pm and 7 am.</Muted>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Muted style={{ fontSize: 14 }}>Morning hello</Muted>
          <TextInput accessibilityLabel="Morning notification time" value={s.morningDigest} onChangeText={(v) => setS({ ...s, morningDigest: v })} style={field} placeholder="07:00" placeholderTextColor="#8a9590" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Muted style={{ fontSize: 14 }}>Evening check-in</Muted>
          <TextInput accessibilityLabel="Evening notification time" value={s.eveningReview} onChangeText={(v) => setS({ ...s, eveningReview: v })} style={field} placeholder="21:30" placeholderTextColor="#8a9590" />
        </View>
      </View>
      <Button title="Send a test notification" variant="link" onPress={test} />

      <H>What I know about you</H>
      <Muted>I read this every time I plan or answer. I add to it when you tell me things, and you can change anything here.</Muted>
      <TextInput accessibilityLabel="About me" value={s.aboutMe ?? ''} onChangeText={(v) => setS({ ...s, aboutMe: v })} multiline placeholder={"- No tasks after 10pm\n- I focus best in the morning\n- Mama's birthday is March 3"} placeholderTextColor="#8a9590" style={[field, { minHeight: 120, textAlignVertical: 'top' }]} />

      <H>Your fixed schedule</H>
      <Muted>Work, class and sleep. I never plan things on top of these. Use 24-hour times.</Muted>
      {s.fixedBlocks.map((b) => (
        <View key={b.id} style={styles.block}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput accessibilityLabel="Block name" value={b.label} onChangeText={(v) => setBlock(b.id, { label: v })} style={[field, { flex: 1, backgroundColor: c.sky }]} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${b.label}`} onPress={() => setS({ ...s, fixedBlocks: s.fixedBlocks.filter((x) => x.id !== b.id) })} hitSlop={10} style={{ padding: 6 }}>
              <Ionicons name="close" size={20} color={c.muted} />
            </Pressable>
          </View>
          <View style={styles.wrap}>
            {DAYS.map((d, i) => <Chip key={i} label={d} active={b.days.includes(i)} onPress={() => setBlock(b.id, { days: b.days.includes(i) ? b.days.filter((x) => x !== i) : [...b.days, i].sort() })} />)}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TextInput accessibilityLabel="Start time" value={b.start} onChangeText={(v) => setBlock(b.id, { start: v })} style={[field, { flex: 1, backgroundColor: c.sky }]} />
            <Text style={{ color: c.muted, fontFamily: FONT.body }}>to</Text>
            <TextInput accessibilityLabel="End time" value={b.end} onChangeText={(v) => setBlock(b.id, { end: v })} style={[field, { flex: 1, backgroundColor: c.sky }]} />
          </View>
        </View>
      ))}
      <Button title="+ Add a block" variant="link" onPress={() => setS({ ...s, fixedBlocks: [...s.fixedBlocks, { id: newId(), label: 'New block', days: [1, 2, 3, 4, 5], start: '19:00', end: '20:00' }] })} />

      <View style={{ height: 6 }} />
      <Button title="Save" onPress={save} />
      {!!msg && <Text style={{ color: c.accent, fontFamily: FONT.strong, fontSize: 15, textAlign: 'center' }}>{msg}</Text>}

      <H>Behind the scenes</H>
      <DemoBadge />
      <Muted>{DEMO ? 'No backend connected yet, so I use simple on-phone rules. Add EXPO_PUBLIC_ASSISTANT_URL to .env to use Claude.' : 'Connected to your Kasama backend (Claude).'}</Muted>
      <Muted>Your tasks and notes stay only on this phone.</Muted>
      <Button title="Clear finished tasks" variant="link" onPress={clearDone} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 24, backgroundColor: '#ffffff', borderWidth: 2 },
  block: { gap: 10, padding: 16, borderRadius: 24, backgroundColor: '#ffffff' },
});
