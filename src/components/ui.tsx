import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useColors } from '@/lib/theme';
import { DEMO } from '@/lib/api';

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }, style]}>{children}</View>;
}

export function Button({ title, onPress, busy, variant = 'primary', disabled }: { title: string; onPress: () => void; busy?: boolean; variant?: 'primary' | 'secondary'; disabled?: boolean }) {
  const c = useColors();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [styles.button, { backgroundColor: primary ? c.accent : 'transparent', borderColor: primary ? c.accent : c.line, opacity: pressed || disabled ? 0.6 : 1 }]}
    >
      {busy ? <ActivityIndicator color={primary ? c.accentText : c.text} /> : <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: primary ? c.accentText : c.text, fontWeight: '600', fontSize: 15 }}>{title}</Text>}
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, { borderColor: active ? c.accent : c.line, backgroundColor: active ? c.accent : 'transparent' }]}>
      <Text style={{ color: active ? c.accentText : c.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function H({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', marginTop: 8 }}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  const c = useColors();
  return <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>{children}</Text>;
}

// Shown while no backend is connected, so it's clear the answers are simulated
export function DemoBadge() {
  const c = useColors();
  if (!DEMO) return null;
  return (
    <View style={[styles.chip, { alignSelf: 'flex-start', borderColor: c.medium }]}>
      <Text style={{ color: c.medium, fontSize: 12, fontWeight: '700' }}>Demo mode · answers are simulated</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  button: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', minHeight: 46, justifyContent: 'center' },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, minWidth: 36, alignItems: 'center' },
});
