import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KEYBOARD_BEHAVIOR } from '@/lib/keyboard';
import { Title } from '@/components/ui';
import { TodoList } from '@/components/TodoList';
import { IdeaList } from '@/components/IdeaList';
import { CalendarView } from '@/components/CalendarView';
import { FONT, useColors } from '@/lib/theme';
import { useData } from '@/lib/useData';

type View3 = 'todo' | 'calendar' | 'ideas';

// Everything on your mind lives here: things to do, your calendar, and ideas for someday
export default function Things() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { tasks, settings, setTasks } = useData();
  const params = useLocalSearchParams<{ view?: string; at?: string }>();
  // Home's calendar button opens straight to the calendar (each tap sends a new 'at');
  // after that, whatever part you tap here wins
  const [pick, setPick] = useState<{ at?: string; tab: View3 }>({ tab: 'todo' });
  const asked = params.view === 'calendar' || params.view === 'ideas' || params.view === 'todo' ? params.view : null;
  const tab: View3 = asked && pick.at !== params.at ? asked : pick.tab;
  const setTab = (t: View3) => setPick({ at: params.at, tab: t });
  const open = tasks.filter((t) => t.status === 'todo').length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={KEYBOARD_BEHAVIOR}>
    <ScrollView style={{ backgroundColor: c.ground }} contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: 24, paddingBottom: 130, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Title size={24}>Things</Title>
      <View style={[styles.switch, { backgroundColor: 'rgba(255,255,255,0.7)' }]} accessibilityRole="tablist">
        {([['todo', `To do${open ? ` · ${open}` : ''}`], ['calendar', 'Calendar'], ['ideas', 'Ideas']] as const).map(([key, label]) => {
          const on = tab === key;
          return (
            <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTab(key)} style={[styles.part, on && { backgroundColor: c.accent }]}>
              <Text style={{ color: on ? '#ffffff' : c.text, fontFamily: FONT.title, fontSize: 15 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {tab === 'todo' && <TodoList tasks={tasks} setTasks={setTasks} />}
      {tab === 'calendar' && <CalendarView tasks={tasks} setTasks={setTasks} settings={settings} />}
      {tab === 'ideas' && <IdeaList onTasks={setTasks} />}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: 'row', padding: 4, borderRadius: 26 },
  part: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
});
