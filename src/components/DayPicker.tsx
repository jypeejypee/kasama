import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '@/components/ui';
import { FONT, useColors } from '@/lib/theme';

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Pick any day from a month, like the Calendar tab. Days before today can't be picked.
export function DayPicker({ open, value, onPick, onClose }: { open: boolean; value: Date | null; onPick: (day: Date) => void; onClose: () => void }) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      {open && <Month value={value} onPick={onPick} onClose={onClose} />}
    </Modal>
  );
}

function Month({ value, onPick, onClose }: { value: Date | null; onPick: (day: Date) => void; onClose: () => void }) {
  const c = useColors();
  const today = midnight(new Date());
  const [first, setFirst] = useState(() => { const d = value ?? today; return new Date(d.getFullYear(), d.getMonth(), 1); });
  const lastOfMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const cells = Array.from({ length: Math.ceil((first.getDay() + lastOfMonth.getDate()) / 7) * 7 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i - first.getDay() + 1));
  const move = (n: number) => setFirst(new Date(first.getFullYear(), first.getMonth() + n, 1));
  const thisMonth = first.getTime() === new Date(today.getFullYear(), today.getMonth(), 1).getTime();

  return (
    <>
      <Pressable style={styles.shade} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.ground }]}>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={thisMonth} onPress={() => move(-1)} hitSlop={10} style={[styles.arrow, thisMonth && { opacity: 0.3 }]}>
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </Pressable>
          <Text style={{ flex: 1, textAlign: 'center', color: c.text, fontFamily: FONT.title, fontSize: 17 }}>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => move(1)} hitSlop={10} style={styles.arrow}>
            <Ionicons name="chevron-forward" size={20} color={c.text} />
          </Pressable>
        </View>
        <View style={styles.row}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: c.muted, fontFamily: FONT.semi, fontSize: 12 }}>{w}</Text>)}
        </View>
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {cells.map((d) => {
            const outside = d.getMonth() !== first.getMonth();
            const past = d < today;
            const on = !!value && d.getTime() === value.getTime();
            return (
              <Pressable
                key={d.getTime()}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: past }}
                accessibilityLabel={d.toDateString()}
                disabled={past || outside}
                onPress={() => onPick(d)}
                style={[styles.cell, on && { backgroundColor: c.accent }, (outside || past) && { opacity: outside ? 0 : 0.3 }]}
              >
                <Text style={{ color: on ? '#ffffff' : c.text, fontFamily: FONT.title, fontSize: 16, textDecorationLine: d.getTime() === today.getTime() && !on ? 'underline' : 'none' }}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
        </View>
        <Button title="Cancel" variant="secondary" onPress={onClose} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  shade: { flex: 1, backgroundColor: 'rgba(20,30,26,0.35)' },
  sheet: { padding: 20, paddingBottom: 34, gap: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  head: { flexDirection: 'row', alignItems: 'center' },
  arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.75)' },
  row: { flexDirection: 'row' },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
});
