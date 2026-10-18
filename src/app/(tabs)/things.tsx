import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Title } from '@/components/ui';
import { TodoList } from '@/components/TodoList';
import { IdeaList } from '@/components/IdeaList';
import { FONT, useColors } from '@/lib/theme';
import { useData } from '@/lib/useData';

// Everything on your mind lives here: things to do, and ideas for someday
export default function Things() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { tasks, setTasks } = useData();
  const [tab, setTab] = useState<'todo' | 'ideas'>('todo');
  const open = tasks.filter((t) => t.status === 'todo').length;

  return (
    <ScrollView style={{ backgroundColor: c.ground }} contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 24, paddingBottom: 130, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Title size={24}>Things</Title>
      <View style={[styles.switch, { backgroundColor: 'rgba(255,255,255,0.7)' }]} accessibilityRole="tablist">
        {([['todo', `To do${open ? ` · ${open}` : ''}`], ['ideas', 'Ideas']] as const).map(([key, label]) => {
          const on = tab === key;
          return (
            <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTab(key)} style={[styles.half, on && { backgroundColor: c.accent }]}>
              <Text style={{ color: on ? '#ffffff' : c.text, fontFamily: FONT.title, fontSize: 15 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {tab === 'todo' ? <TodoList tasks={tasks} setTasks={setTasks} /> : <IdeaList onTasks={setTasks} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: 'row', padding: 4, borderRadius: 26 },
  half: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
});
