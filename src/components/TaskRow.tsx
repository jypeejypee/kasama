import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FONT, useColors } from '@/lib/theme';
import { fmtDue, fmtTime } from '@/lib/time';
import type { Task } from '@/lib/types';

const PEBBLE = { high: '#e2a77e', medium: '#9ec29a', low: '#b8b0a2' } as const;

// One thing to do. Tap the pebble when it's done. Dates read like a person would say them.
export function TaskRow({ task, onToggle, onDrop, showSlot }: { task: Task; onToggle: () => void; onDrop?: () => void; showSlot?: boolean }) {
  const c = useColors();
  const done = task.status === 'done';
  const color = PEBBLE[task.priority];
  const when = showSlot && task.scheduled_start
    ? `${fmtTime(task.scheduled_start)} – ${fmtTime(task.scheduled_end)}`
    : [task.due_at && `by ${fmtDue(task.due_at)}`, task.repeat && `every ${task.repeat === 'daily' ? 'day' : task.repeat.replace('ly', '')}`].filter(Boolean).join(' · ');
  return (
    <View style={[styles.row, { opacity: done ? 0.55 : 1 }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`Done: ${task.title}`}
        onPress={onToggle}
        hitSlop={10}
        style={[styles.pebble, { borderColor: color, backgroundColor: done ? color : 'transparent' }]}
      >
        {done && <Ionicons name="checkmark" size={16} color="#ffffff" />}
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.text, fontSize: 16, fontFamily: FONT.title, textDecorationLine: done ? 'line-through' : 'none' }}>{task.title}</Text>
        {!!when && <Text style={{ color: c.muted, fontSize: 14, fontFamily: FONT.body }}>{when}</Text>}
      </View>
      {onDrop && !done && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Let go of ${task.title}`} onPress={onDrop} hitSlop={12} style={{ padding: 6 }}>
          <Ionicons name="close" size={18} color={c.muted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingVertical: 6 },
  pebble: { width: 32, height: 30, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 14, borderBottomRightRadius: 17, borderBottomLeftRadius: 13 },
});
