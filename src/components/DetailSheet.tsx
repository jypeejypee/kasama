import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '@/components/ui';
import { FONT, useColors } from '@/lib/theme';
import { KEYBOARD_BEHAVIOR } from '@/lib/keyboard';
import { newId } from '@/lib/storage';
import type { Step } from '@/lib/types';

export type Details = { title: string; notes: string | null; steps: Step[] };

// "3 of 5 steps" or "has notes", for the line under a task or idea
export function detailHint(d: { notes?: string | null; steps?: Step[] }) {
  const steps = d.steps ?? [];
  if (steps.length) return `${steps.filter((s) => s.done).length} of ${steps.length} steps`;
  return d.notes?.trim() ? 'has notes' : '';
}

// Tap a task or an idea to open it: rename it, write notes, and break it into small steps.
// Everything is kept when you close the sheet, so there is no Save button to forget.
export function DetailSheet({ item, kind, onClose, onSave }: { item: Details | null; kind: 'task' | 'idea'; onClose: () => void; onSave: (d: Details) => void }) {
  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      {item && <Sheet key={item.title} item={item} kind={kind} onClose={onClose} onSave={onSave} />}
    </Modal>
  );
}

function Sheet({ item, kind, onClose, onSave }: { item: Details; kind: 'task' | 'idea'; onClose: () => void; onSave: (d: Details) => void }) {
  const c = useColors();
  const [d, setD] = useState<Details>(item);
  const [step, setStep] = useState('');
  const field = { color: c.text, backgroundColor: '#ffffff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, fontFamily: FONT.body } as const;

  const close = () => {
    const pending = step.trim() ? [...d.steps, { id: newId(), text: step.trim(), done: false }] : d.steps;
    onSave({ title: d.title.trim() || item.title, notes: d.notes?.trim() ? d.notes : null, steps: pending.filter((s) => s.text.trim()) });
    onClose();
  };
  const addStep = () => {
    if (!step.trim()) return;
    setD({ ...d, steps: [...d.steps, { id: newId(), text: step.trim(), done: false }] });
    setStep('');
  };
  const setSteps = (steps: Step[]) => setD({ ...d, steps });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
      <Pressable style={styles.shade} onPress={close} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.ground }]}>
        <View style={[styles.grip, { backgroundColor: c.edge }]} />
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
          <TextInput accessibilityLabel={kind === 'task' ? 'Task name' : 'Idea'} value={d.title} onChangeText={(title) => setD({ ...d, title })} multiline style={{ color: c.text, fontFamily: FONT.title, fontSize: 20, paddingVertical: 4 }} />

          <Text style={[styles.label, { color: c.accent }]}>NOTES</Text>
          <TextInput
            accessibilityLabel="Notes"
            value={d.notes ?? ''}
            onChangeText={(notes) => setD({ ...d, notes })}
            multiline
            placeholder={kind === 'task' ? 'Anything to remember for this…' : 'Write more about this idea…'}
            placeholderTextColor="#8a9590"
            style={[field, { minHeight: 90, textAlignVertical: 'top' }]}
          />

          <Text style={[styles.label, { color: c.accent }]}>SMALL STEPS</Text>
          {d.steps.map((s) => (
            <View key={s.id} style={styles.step}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: s.done }} accessibilityLabel={`Step done: ${s.text}`} hitSlop={10} onPress={() => setSteps(d.steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} style={[styles.dot, { borderColor: c.accent, backgroundColor: s.done ? c.accent : 'transparent' }]}>
                {s.done && <Ionicons name="checkmark" size={13} color="#ffffff" />}
              </Pressable>
              <TextInput accessibilityLabel="Step" value={s.text} onChangeText={(text) => setSteps(d.steps.map((x) => (x.id === s.id ? { ...x, text } : x)))} style={{ flex: 1, color: c.text, fontFamily: FONT.body, fontSize: 16, textDecorationLine: s.done ? 'line-through' : 'none', opacity: s.done ? 0.6 : 1 }} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove step: ${s.text}`} hitSlop={10} onPress={() => setSteps(d.steps.filter((x) => x.id !== s.id))} style={{ padding: 4 }}>
                <Ionicons name="close" size={18} color={c.muted} />
              </Pressable>
            </View>
          ))}
          <TextInput accessibilityLabel="Add a step" value={step} onChangeText={setStep} placeholder="+ Add a small step" placeholderTextColor="#8a9590" onSubmitEditing={addStep} submitBehavior="submit" returnKeyType="done" style={field} />
        </ScrollView>
        <Button title="Done" onPress={close} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shade: { flex: 1, backgroundColor: 'rgba(20,30,26,0.35)' },
  sheet: { maxHeight: '85%', paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28, gap: 10, borderTopLeftRadius: 30, borderTopRightRadius: 26 },
  grip: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: 6 },
  label: { fontFamily: FONT.strong, fontSize: 12, letterSpacing: 0.8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
