import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Button } from '@/components/ui';
import { FONT, useColors } from '@/lib/theme';

const ITEM = 44;
const VISIBLE = 5; // the middle row is the chosen one
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const HALVES = ['AM', 'PM'];

// "19:30" → { hour: '7', minute: '30', half: 'PM' }; minutes snap to the nearest 5
function split(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const safeH = Number.isFinite(h) ? h : 7;
  const safeM = Number.isFinite(m) ? Math.min(55, Math.round(m / 5) * 5) : 0;
  return { hour: String(safeH % 12 || 12), minute: String(safeM).padStart(2, '0'), half: safeH >= 12 ? 'PM' : 'AM' };
}
const join = (hour: string, minute: string, half: string) => `${String((Number(hour) % 12) + (half === 'PM' ? 12 : 0)).padStart(2, '0')}:${minute}`;
export const prettyTime = (hhmm: string) => { const p = split(hhmm); return `${p.hour}:${p.minute} ${p.half}`; };

// One scrolling column that snaps to a value
function Wheel({ values, value, onChange, label }: { values: string[]; value: string; onChange: (v: string) => void; label: string }) {
  const c = useColors();
  const start = Math.max(0, values.indexOf(value));
  const list = useRef<ScrollView>(null);
  const pick = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(values.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
    onChange(values[i]);
  };
  return (
    <ScrollView
      ref={list}
      // Some Android versions ignore contentOffset, so also jump to the chosen value once shown
      onLayout={() => list.current?.scrollTo({ y: start * ITEM, animated: false })}
      accessibilityLabel={label}
      style={{ height: ITEM * VISIBLE, flex: 1 }}
      contentContainerStyle={{ paddingVertical: ITEM * ((VISIBLE - 1) / 2) }}
      contentOffset={{ x: 0, y: start * ITEM }}
      snapToInterval={ITEM}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      onMomentumScrollEnd={pick}
      onScrollEndDrag={pick}
    >
      {values.map((v) => (
        <Pressable key={v} accessibilityRole="button" accessibilityState={{ selected: v === value }} onPress={() => onChange(v)} style={{ height: ITEM, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: v === value ? FONT.title : FONT.body, fontSize: v === value ? 22 : 18, color: v === value ? c.text : c.muted }}>{v}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// A time you choose by scrolling, never by typing. Shows like "7:00 AM"; gives back "07:00".
export function TimeField({ value, onChange, label }: { value: string; onChange: (hhmm: string) => void; label: string }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => split(value));
  const set = (patch: Partial<ReturnType<typeof split>>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${prettyTime(value)}. Tap to change.`}
        onPress={() => { setDraft(split(value)); setOpen(true); }}
        style={[styles.field, { backgroundColor: '#ffffff' }]}
      >
        <Text style={{ color: c.text, fontFamily: FONT.title, fontSize: 16 }}>{prettyTime(value)}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.shade} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: c.ground }]}>
          <Text style={{ color: c.text, fontFamily: FONT.title, fontSize: 18, textAlign: 'center' }}>{label}</Text>
          <View style={styles.wheels}>
            <View pointerEvents="none" style={[styles.band, { backgroundColor: c.band }]} />
            <Wheel label="Hour" values={HOURS} value={draft.hour} onChange={(hour) => set({ hour })} />
            <Text style={{ color: c.text, fontFamily: FONT.title, fontSize: 22 }}>:</Text>
            <Wheel label="Minutes" values={MINUTES} value={draft.minute} onChange={(minute) => set({ minute })} />
            <Wheel label="AM or PM" values={HALVES} value={draft.half} onChange={(half) => set({ half })} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Button title="Cancel" variant="secondary" onPress={() => setOpen(false)} /></View>
            <View style={{ flex: 1 }}><Button title="Set" onPress={() => { onChange(join(draft.hour, draft.minute, draft.half)); setOpen(false); }} /></View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, minHeight: 48, justifyContent: 'center' },
  shade: { flex: 1, backgroundColor: 'rgba(20,30,25,0.35)' },
  sheet: { padding: 20, paddingBottom: 34, gap: 14, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  wheels: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  band: { position: 'absolute', left: 0, right: 0, top: ITEM * ((VISIBLE - 1) / 2), height: ITEM, borderRadius: 14 },
});
