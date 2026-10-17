import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { Button, Card, Chip, DemoBadge, H, Muted } from '@/components/ui';
import { useColors } from '@/lib/theme';
import { DEFAULT_SETTINGS, getSettings, getTasks, newId, saveSettings, saveTasks } from '@/lib/storage';
import { rescheduleAll, sendTestNotification, setupNotifications } from '@/lib/notifications';
import { validHHMM } from '@/lib/time';
import { DEMO } from '@/lib/api';
import type { FixedBlock, Settings } from '@/lib/types';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function SettingsScreen() {
  const c = useColors();
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [msg, setMsg] = useState('');
  // Load the saved settings each time you open this screen (chat may have added to About me)
  useFocusEffect(useCallback(() => { getSettings().then(setS); }, []));

  const input = { color: c.text, borderColor: c.line, backgroundColor: c.bg, borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 16 } as const;
  const setBlock = (id: string, patch: Partial<FixedBlock>) => setS({ ...s, fixedBlocks: s.fixedBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  async function save() {
    const times = [s.morningDigest, s.eveningReview, ...s.fixedBlocks.flatMap((b) => [b.start, b.end])];
    if (!times.every(validHHMM)) return setMsg('Use 24-hour times like 07:00 or 21:30.');
    await saveSettings(s);
    await rescheduleAll();
    setMsg('Saved. Reminders updated.');
  }

  async function test() {
    const ok = await setupNotifications();
    if (!ok) return setMsg('Notifications are off. Turn them on for Kasama in your phone settings.');
    await sendTestNotification();
    setMsg('A test notification will appear in 5 seconds. You can lock your phone.');
  }

  async function clearDone() {
    const tasks = await getTasks();
    await saveTasks(tasks.filter((t) => t.status === 'todo'));
    setMsg('Cleared finished and dropped tasks.');
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
      <Card>
        <H>Reminders</H>
        <Button title="Send a test notification" variant="secondary" onPress={test} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Muted>Morning focus</Muted>
            <TextInput accessibilityLabel="Morning notification time" value={s.morningDigest} onChangeText={(v) => setS({ ...s, morningDigest: v })} style={input} placeholder="07:00" placeholderTextColor={c.muted} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Muted>Evening check-in</Muted>
            <TextInput accessibilityLabel="Evening notification time" value={s.eveningReview} onChangeText={(v) => setS({ ...s, eveningReview: v })} style={input} placeholder="21:30" placeholderTextColor={c.muted} />
          </View>
        </View>
      </Card>

      <Card>
        <H>About me</H>
        <Muted>Kasama reads this every time it plans or answers. Write your routines, likes and rules, one per line. Kasama also adds things here when you tell it in chat.</Muted>
        <TextInput
          accessibilityLabel="About me"
          value={s.aboutMe ?? ''}
          onChangeText={(v) => setS({ ...s, aboutMe: v })}
          multiline
          placeholder={"- No tasks after 10pm\n- I focus best in the morning\n- Mama's birthday is March 3"}
          placeholderTextColor={c.muted}
          style={[input, { minHeight: 110, textAlignVertical: 'top' }]}
        />
      </Card>

      <H>Fixed schedule</H>
      <Muted>Work, class and sleep. &quot;Plan my day&quot; never puts tasks here. Use 24-hour times.</Muted>
      {s.fixedBlocks.map((b) => (
        <Card key={b.id}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput accessibilityLabel="Block name" value={b.label} onChangeText={(v) => setBlock(b.id, { label: v })} style={[input, { flex: 1 }]} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${b.label}`} onPress={() => setS({ ...s, fixedBlocks: s.fixedBlocks.filter((x) => x.id !== b.id) })} hitSlop={10}>
              <Ionicons name="trash-outline" size={22} color={c.muted} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {DAYS.map((d, i) => (
              <Chip key={i} label={d} active={b.days.includes(i)} onPress={() => setBlock(b.id, { days: b.days.includes(i) ? b.days.filter((x) => x !== i) : [...b.days, i].sort() })} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TextInput accessibilityLabel="Start time" value={b.start} onChangeText={(v) => setBlock(b.id, { start: v })} style={[input, { flex: 1 }]} />
            <Text style={{ color: c.muted }}>to</Text>
            <TextInput accessibilityLabel="End time" value={b.end} onChangeText={(v) => setBlock(b.id, { end: v })} style={[input, { flex: 1 }]} />
          </View>
        </Card>
      ))}
      <Button title="Add a block" variant="secondary" onPress={() => setS({ ...s, fixedBlocks: [...s.fixedBlocks, { id: newId(), label: 'New block', days: [1, 2, 3, 4, 5], start: '19:00', end: '20:00' }] })} />
      <Button title="Save settings" onPress={save} />
      {!!msg && <Muted>{msg}</Muted>}

      <H>Assistant</H>
      <DemoBadge />
      <Muted>{DEMO ? 'No backend connected yet. Brain dump, Plan my day and Chat use simple on-phone rules. Add EXPO_PUBLIC_ASSISTANT_URL to .env to use Claude.' : 'Connected to your Kasama backend (Claude).'}</Muted>

      <H>Data</H>
      <Muted>Your tasks and notes are stored only on this phone.</Muted>
      <Button title="Clear finished and dropped tasks" variant="secondary" onPress={clearDone} />
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
