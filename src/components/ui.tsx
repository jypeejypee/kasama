import { ActivityIndicator, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { FONT, useColors } from '@/lib/theme';
import { DEMO } from '@/lib/api';

// Soft, borderless surface. Used sparingly: Kasama mostly talks in plain sentences.
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card }, style]}>{children}</View>;
}

export function Button({ title, onPress, busy, variant = 'primary', disabled }: { title: string; onPress: () => void; busy?: boolean; variant?: 'primary' | 'secondary' | 'link'; disabled?: boolean }) {
  const c = useColors();
  const primary = variant === 'primary';
  const link = variant === 'link';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(busy || disabled) }}
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [
        link ? styles.link : styles.button,
        !link && { backgroundColor: primary ? c.accent : 'rgba(255,255,255,0.85)' },
        primary && styles.lift,
        { opacity: pressed || disabled ? 0.6 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? c.accentText : c.text} />
      ) : (
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: primary ? c.accentText : c.text, fontFamily: FONT.title, fontSize: link ? 15 : 17 }}>{title}</Text>
      )}
    </Pressable>
  );
}

// A pebble you can pick. Slightly uneven corners so it feels hand-made, not like a form.
export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, { backgroundColor: active ? c.accent : 'rgba(255,255,255,0.85)' }]}>
      <Text style={{ color: active ? c.accentText : c.text, fontSize: 15, fontFamily: FONT.bold }}>{label}</Text>
    </Pressable>
  );
}

export function Title({ children, size = 26, style }: { children: React.ReactNode; size?: number; style?: TextStyle }) {
  const c = useColors();
  return <Text style={[{ color: c.text, fontSize: size, lineHeight: size * 1.25, fontFamily: FONT.title, letterSpacing: -0.2 }, style]}>{children}</Text>;
}

export function H({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <Text style={{ color: c.muted, fontSize: 15, fontFamily: FONT.title, marginTop: 14 }}>{children}</Text>;
}

// Kasama's voice: plain, roomy sentences
export function Say({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const c = useColors();
  return <Text style={[{ color: c.text, fontSize: 17, lineHeight: 26, fontFamily: FONT.body }, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const c = useColors();
  return <Text style={[{ color: c.muted, fontSize: 15, lineHeight: 22, fontFamily: FONT.body }, style]}>{children}</Text>;
}

// Shown while no backend is connected, so it's clear the answers are simulated
export function DemoBadge() {
  const c = useColors();
  if (!DEMO) return null;
  return (
    <View style={[styles.chip, { alignSelf: 'flex-start', minHeight: 32, backgroundColor: 'rgba(255,255,255,0.7)' }]}>
      <Text style={{ color: c.muted, fontSize: 13, fontFamily: FONT.semi }}>Demo mode · answers are simulated</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 26, padding: 18, gap: 10 },
  button: { borderRadius: 28, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', minHeight: 54, justifyContent: 'center' },
  link: { paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  lift: { shadowColor: '#22372b', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  chip: { borderTopLeftRadius: 22, borderTopRightRadius: 18, borderBottomRightRadius: 22, borderBottomLeftRadius: 18, paddingVertical: 10, paddingHorizontal: 16, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
