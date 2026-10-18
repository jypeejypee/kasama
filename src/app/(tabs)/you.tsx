import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KEYBOARD_BEHAVIOR } from '@/lib/keyboard';
import { Button, Chip, DemoBadge, H, Muted, Title } from '@/components/ui';
import { FONT, setPlace, useColors } from '@/lib/theme';
import { DEFAULT_SETTINGS, getSettings, getTasks, newId, saveSettings, saveTasks } from '@/lib/storage';
import { rescheduleAll, sendTestNotification, setupNotifications } from '@/lib/notifications';
import { toHHMM } from '@/lib/time';
import { DEMO } from '@/lib/api';
import type { Encourage, Faith, FixedBlock, Person, Place, Reminders, Settings, Support } from '@/lib/types';
import { connectCalendars, type PhoneCalendar } from '@/lib/calendar';
import { sayHi } from '@/lib/people';
import { voiceReport } from '@/lib/voice';
import { TimeField } from '@/components/TimePicker';

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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [who, setWho] = useState({ name: '', how: 'sms' as Person['how'], handle: '' });
  const [cals, setCals] = useState<PhoneCalendar[] | null>(null);
  const [calMsg, setCalMsg] = useState('');
  const [micReport, setMicReport] = useState<string[]>([]);
  // Load the saved settings each time you open this screen (chat may have added to About me)
  useFocusEffect(useCallback(() => {
    getSettings().then((saved) => {
      setS(saved);
      // Already connected: show the calendar list again (no new permission prompt)
      if (saved.calendarIds?.length) connectCalendars().then((r) => { if (Array.isArray(r)) setCals(r); });
    });
  }, []));

  // People and calendar save right away, like your place
  async function persist(patch: Partial<Settings>) {
    setS((prev) => ({ ...prev, ...patch }));
    await saveSettings({ ...(await getSettings()), ...patch });
  }

  async function addPerson() {
    if (!who.name.trim() || !who.handle.trim()) return;
    await persist({ people: [...(s.people ?? []), { id: newId(), name: who.name.trim(), how: who.how, handle: who.handle.trim() }], peopleAsked: true });
    setWho({ name: '', how: who.how, handle: '' });
  }

  async function connect() {
    const r = await connectCalendars();
    if (r === 'denied') return setCalMsg('No problem. If you change your mind, allow Calendar for Kasama in your phone settings.');
    if (r === 'unavailable') return setCalMsg('The calendar works in the installed app, not in Expo Go.');
    setCals(r);
    setCalMsg('');
    // Start with every calendar except holidays and birthdays, which never block your time
    if (!s.calendarIds?.length) await persist({ calendarIds: r.filter((x) => !/holiday|birthday|pista/i.test(x.title)).map((x) => x.id) });
  }

  const toggleCal = (id: string) => {
    const ids = s.calendarIds ?? [];
    persist({ calendarIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  };

  const field = { color: c.text, backgroundColor: '#ffffff', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, fontFamily: FONT.body } as const;
  const setBlock = (id: string, patch: Partial<FixedBlock>) => setS({ ...s, fixedBlocks: s.fixedBlocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) });

  // Changing your place shows right away and is saved right away
  async function pickPlace(p: Place) {
    setS({ ...s, place: p });
    setPlace(p);
    await saveSettings({ ...(await getSettings()), place: p });
  }

  async function save() {
    // Accept times the way people type them ("7", "7pm", "7:30 PM") and tidy them to 07:00 style
    const bad: string[] = [];
    const fix = (value: string, label: string) => { const t = toHHMM(value); if (!t) bad.push(label); return t ?? value; };
    const next: Settings = {
      ...s,
      morningDigest: fix(s.morningDigest, 'Morning hello'),
      eveningReview: fix(s.eveningReview, 'Evening check-in'),
      fixedBlocks: s.fixedBlocks.map((b) => ({ ...b, start: fix(b.start, `${b.label} start`), end: fix(b.end, `${b.label} end`) })),
    };
    if (bad.length) {
      setSaved(false);
      return setMsg(`I couldn't read the time for ${bad.join(', ')}. Try something like 7:00 or 7pm.`);
    }
    setSaving(true);
    setMsg('');
    try {
      setS(next);
      await saveSettings(next);
      await rescheduleAll();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setMsg(`Couldn't save just now: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
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
          <TimeField label="Morning hello" value={s.morningDigest} onChange={(v) => setS({ ...s, morningDigest: v })} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Muted style={{ fontSize: 14 }}>Evening check-in</Muted>
          <TimeField label="Evening check-in" value={s.eveningReview} onChange={(v) => setS({ ...s, eveningReview: v })} />
        </View>
      </View>
      <Button title="Send a test notification" variant="link" onPress={test} />

      <H>What I know about you</H>
      <Muted>I read this every time I plan or answer. I add to it when you tell me things, and you can change anything here.</Muted>
      <TextInput accessibilityLabel="About me" value={s.aboutMe ?? ''} onChangeText={(v) => setS({ ...s, aboutMe: v })} multiline placeholder={"- No tasks after 10pm\n- I focus best in the morning\n- Mama's birthday is March 3"} placeholderTextColor="#8a9590" style={[field, { minHeight: 120, textAlignVertical: 'top' }]} />

      <H>Your fixed schedule</H>
      <Muted>Work, class and sleep. I never plan things on top of these. Tap a time to change it.</Muted>
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
            <View style={{ flex: 1 }}><TimeField label={`${b.label} starts`} value={b.start} onChange={(v) => setBlock(b.id, { start: v })} /></View>
            <Text style={{ color: c.muted, fontFamily: FONT.body }}>to</Text>
            <View style={{ flex: 1 }}><TimeField label={`${b.label} ends`} value={b.end} onChange={(v) => setBlock(b.id, { end: v })} /></View>
          </View>
        </View>
      ))}
      <Button title="+ Add a block" variant="link" onPress={() => setS({ ...s, fixedBlocks: [...s.fixedBlocks, { id: newId(), label: 'New block', days: [1, 2, 3, 4, 5], start: '19:00', end: '20:00' }] })} />

      <View style={{ height: 6 }} />
      {!!msg && <Text style={{ color: /^(I couldn't|Couldn't|Notifications are off|This phone)/.test(msg) ? c.high : c.accent, fontFamily: FONT.strong, fontSize: 15, textAlign: 'center' }}>{msg}</Text>}
      <Button title={saved ? 'Saved ✓' : 'Save'} onPress={save} busy={saving} />
      {saved && <Muted style={{ textAlign: 'center' }}>Your reminders follow these now.</Muted>}

      <H>Your people</H>
      <Muted>Someone you trust. Now and then I&apos;ll remind you to say hi. I only open your own messaging app; I never message anyone myself.</Muted>
      {(s.people ?? []).map((p) => (
        <View key={p.id} style={styles.block}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontFamily: FONT.title, fontSize: 16 }}>{p.name}</Text>
              <Muted style={{ fontSize: 14 }}>{p.how === 'sms' ? 'Text' : 'Messenger'} · {p.handle}</Muted>
            </View>
            <Button title="Say hi" variant="link" onPress={() => sayHi(p)} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} onPress={() => persist({ people: (s.people ?? []).filter((x) => x.id !== p.id) })} hitSlop={10} style={{ padding: 6 }}>
              <Ionicons name="close" size={20} color={c.muted} />
            </Pressable>
          </View>
        </View>
      ))}
      {(s.people ?? []).length < 5 && (
        <View style={styles.block}>
          <TextInput accessibilityLabel="Their name" value={who.name} onChangeText={(v) => setWho({ ...who, name: v })} placeholder="Their name, like Mama or Mia" placeholderTextColor="#8a9590" style={[field, { backgroundColor: c.sky }]} />
          <View style={styles.wrap}>
            <Chip label="Text message" active={who.how === 'sms'} onPress={() => setWho({ ...who, how: 'sms' })} />
            <Chip label="Messenger" active={who.how === 'messenger'} onPress={() => setWho({ ...who, how: 'messenger' })} />
          </View>
          <TextInput
            accessibilityLabel={who.how === 'sms' ? 'Their phone number' : 'Their Messenger username'}
            value={who.handle}
            onChangeText={(v) => setWho({ ...who, handle: v })}
            placeholder={who.how === 'sms' ? '0917 123 4567' : 'Messenger username (from m.me/…)'}
            placeholderTextColor="#8a9590"
            keyboardType={who.how === 'sms' ? 'phone-pad' : 'default'}
            autoCapitalize="none"
            style={[field, { backgroundColor: c.sky }]}
          />
          <Button title="Add" variant="secondary" onPress={addPerson} disabled={!who.name.trim() || !who.handle.trim()} />
        </View>
      )}
      <Muted style={{ fontSize: 13 }}>Their numbers stay on this phone. Only first names reach me, so I can say &quot;maybe message Mia?&quot;</Muted>

      <H>Voice</H>
      <Muted>What should I listen for? Filipino also catches English words, so it&apos;s best for Taglish. Talking never uses Claude credit; only what you send does.</Muted>
      <View style={styles.wrap}>
        <Chip label="Filipino (Taglish)" active={(s.voiceLang ?? 'fil-PH') === 'fil-PH'} onPress={() => persist({ voiceLang: 'fil-PH' })} />
        <Chip label="English" active={s.voiceLang === 'en-US'} onPress={() => persist({ voiceLang: 'en-US' })} />
      </View>
      <Muted>If the mic doesn&apos;t work, tap this and share a screenshot of what it says.</Muted>
      <Button title="Test my mic" variant="secondary" onPress={async () => setMicReport(await voiceReport())} />
      {micReport.map((l) => <Muted key={l} style={{ fontSize: 14 }}>· {l}</Muted>)}

      <H>Your calendar</H>
      <Muted>I can see when you&apos;re busy, not what you&apos;re doing. Event names never leave your phone. Plan my day then works around your meetings.</Muted>
      {cals ? (
        <>
          <View style={styles.wrap}>
            {cals.map((cal) => <Chip key={cal.id} label={cal.title} active={(s.calendarIds ?? []).includes(cal.id)} onPress={() => toggleCal(cal.id)} />)}
          </View>
          <Button title="Disconnect my calendar" variant="link" onPress={() => { setCals(null); persist({ calendarIds: [] }); }} />
        </>
      ) : (
        <Button title="Connect my calendar" variant="secondary" onPress={connect} />
      )}
      {!!calMsg && <Muted>{calMsg}</Muted>}

      <H>Behind the scenes</H>
      <DemoBadge />
      <Muted>{DEMO ? 'No backend connected yet, so I use simple on-phone rules. Add EXPO_PUBLIC_ASSISTANT_URL to .env to use Claude.' : 'Connected to your Kasama backend (Claude).'}</Muted>
      <Muted>{DEMO ? 'Everything stays on this phone.' : 'Your tasks and notes are saved on this phone. What you send me goes to the Kasama backend and Claude to get an answer.'}</Muted>
      <Button title="Clear finished tasks" variant="link" onPress={clearDone} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 24, backgroundColor: '#ffffff', borderWidth: 2 },
  block: { gap: 10, padding: 16, borderRadius: 24, backgroundColor: '#ffffff' },
});
