import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Muted, Say, Title } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { Scene } from '@/components/Scene';
import { FONT, setPlace, useColors } from '@/lib/theme';
import { getSettings, saveSettings } from '@/lib/storage';
import type { Place } from '@/lib/types';

const PLACES: [Place, string, string][] = [
  ['dagat', 'Dagat', 'by the sea'],
  ['bundok', 'Bundok', 'in the mountains'],
  ['palayan', 'Palayan', 'over the rice fields'],
];

// First open: say hi, learn your name, pick where you feel calm. Nothing else is asked.
export default function Welcome() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [place, pick] = useState<Place>(c.place);

  function choose(p: Place) {
    pick(p);
    setPlace(p); // the whole screen changes right away
  }

  async function start() {
    const s = await getSettings();
    await saveSettings({ ...s, name: name.trim() || s.name, place, welcomed: true });
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.ground }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View>
          <Scene height={230 + insets.top} />
          <View style={[styles.logo, { top: insets.top + 40 }]}>
            <Logo width={150} />
          </View>
        </View>
        <View style={styles.body}>
          <Title size={30} style={{ textAlign: 'center' }}>Hi. I&apos;m Kasama.</Title>
          <Say style={{ textAlign: 'center' }}>I&apos;ll walk with you. Tell me what&apos;s on your mind, and I&apos;ll hold onto it so you don&apos;t have to.</Say>

          <Muted style={{ textAlign: 'center', marginTop: 14 }}>What do your friends call you?</Muted>
          <TextInput
            accessibilityLabel="Your name"
            value={name}
            onChangeText={setName}
            placeholder="Your name or nickname"
            placeholderTextColor="#8a9590"
            returnKeyType="done"
            style={[styles.name, { color: c.text, borderBottomColor: c.edge }]}
          />

          <Muted style={{ textAlign: 'center', marginTop: 18 }}>Where do you feel calm?</Muted>
          <View style={styles.places}>
            {PLACES.map(([p, label, line]) => {
              const on = place === p;
              return (
                <Pressable key={p} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => choose(p)} style={[styles.place, { backgroundColor: on ? c.accent : '#ffffff' }]}>
                  <Text style={{ color: on ? '#ffffff' : c.text, fontFamily: FONT.title, fontSize: 16 }}>{label}</Text>
                  <Text style={{ color: on ? '#ffffff' : c.muted, fontFamily: FONT.body, fontSize: 12, textAlign: 'center' }}>{line}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: 18 }} />
          <Button title="Let's go" onPress={start} />
          <Muted style={{ textAlign: 'center', fontSize: 13 }}>Everything stays on your phone. You can change all of this later in You.</Muted>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  logo: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  body: { paddingHorizontal: 28, gap: 10, marginTop: 8 },
  name: { fontFamily: FONT.title, fontSize: 22, textAlign: 'center', borderBottomWidth: 2, paddingVertical: 8 },
  places: { flexDirection: 'row', gap: 8 },
  place: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 6, borderTopLeftRadius: 22, borderTopRightRadius: 18, borderBottomRightRadius: 22, borderBottomLeftRadius: 18 },
});
