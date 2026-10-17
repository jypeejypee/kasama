import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '@/lib/theme';
import { fmtDue, fmtTime } from '@/lib/time';
import type { Task } from '@/lib/types';

export function TaskRow({ task, onToggle, onDrop, showSlot }: { task: Task; onToggle: () => void; onDrop?: () => void; showSlot?: boolean }) {
  const c = useColors();
  const done = task.status === 'done';
  const meta = [task.due_at && `Due ${fmtDue(task.due_at)}`, `${task.duration_min} min`, task.repeat && `Repeats ${task.repeat}`].filter(Boolean).join(' · ');
  return (
    <View style={[styles.row, { backgroundColor: c.card, borderColor: c.line, borderLeftColor: c[task.priority] }]}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={`Done: ${task.title}`} onPress={onToggle} hitSlop={10}>
        <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={done ? c.accent : c.muted} />
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        {showSlot && task.scheduled_start && <Text style={{ color: c.accent, fontSize: 13, fontWeight: '700' }}>{fmtTime(task.scheduled_start)} – {fmtTime(task.scheduled_end)}</Text>}
        <Text style={{ color: done ? c.muted : c.text, fontSize: 16, fontWeight: '600', textDecorationLine: done ? 'line-through' : 'none' }}>{task.title}</Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>{meta}</Text>
      </View>
      {onDrop && !done && (
        <Pressable accessibilityRole="button" accessibilityLabel={`Drop ${task.title}`} onPress={onDrop} hitSlop={10}>
          <Ionicons name="close" size={20} color={c.muted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderLeftWidth: 4, borderRadius: 12, padding: 12 },
});
