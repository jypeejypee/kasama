import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT, useColors } from '@/lib/theme';
import { toggleListening, useVoice } from '@/lib/voice';
import { useKeyboardOpen } from '@/lib/keyboard';

// The props Expo Router gives a custom tab bar
type BarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

// Outline icons for the other tabs, filled for the one you're on
type Icon = keyof typeof Ionicons.glyphMap;
const ICONS: Record<string, { label: string; icon: Icon; active: Icon }> = {
  index: { label: 'Home', icon: 'home-outline', active: 'home' },
  things: { label: 'Things', icon: 'list-outline', active: 'list' },
  journey: { label: 'Journey', icon: 'leaf-outline', active: 'leaf' },
  you: { label: 'You', icon: 'person-circle-outline', active: 'person-circle' },
};

// A floating bar, with a raised button in the middle so letting something out is always one tap away
function FloatingBar({ state, navigation }: BarProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const typing = useKeyboardOpen();
  const { listening } = useVoice();
  const go = (name: string, key: string, focused: boolean) => {
    const e = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (!focused && !e.defaultPrevented) navigation.navigate(name);
  };
  if (typing) return null;
  return (
    <View style={[styles.bar, { bottom: Math.max(insets.bottom, 12) + 6 }]}>
      {state.routes.map((r, i) => {
        const focused = state.index === i;
        if (r.name === 'kasama') {
          return (
            <Pressable
              key={r.key}
              accessibilityRole="button"
              accessibilityLabel={listening ? 'Stop listening' : 'Talk to Kasama'}
              onPress={() => {
                if (focused) return toggleListening();
                go(r.name, r.key, focused);
                setTimeout(toggleListening, 350); // let the Kasama screen open first
              }}
              style={[styles.center, { backgroundColor: listening ? '#c4664a' : c.accent, borderWidth: listening ? 6 : 0, borderColor: 'rgba(196,102,74,0.25)' }]}
            >
              <Ionicons name={listening ? 'stop' : 'mic'} size={28} color="#ffffff" />
            </Pressable>
          );
        }
        const meta = ICONS[r.name];
        if (!meta) return null;
        // Where you are, at a glance: your place's color, a filled icon on a soft pebble, a bold label
        const color = focused ? c.accent : '#646f6a';
        return (
          <Pressable key={r.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={meta.label} onPress={() => go(r.name, r.key, focused)} style={styles.tab}>
            <View style={[styles.pebble, focused && { backgroundColor: c.band }]}>
              <Ionicons name={focused ? meta.active : meta.icon} size={22} color={color} />
            </View>
            <Text style={{ color, fontSize: 12, fontFamily: focused ? FONT.title : FONT.semi }}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const c = useColors();
  return (
    <Tabs tabBar={(p) => <FloatingBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.sky } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="things" />
      <Tabs.Screen name="kasama" />
      <Tabs.Screen name="journey" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 16, right: 16, height: 66, borderRadius: 33, backgroundColor: 'rgba(255,255,255,0.95)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', shadowColor: '#28463c', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 56 },
  pebble: { width: 52, height: 30, alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 13, borderBottomRightRadius: 16, borderBottomLeftRadius: 13 },
  center: { width: 60, height: 60, borderRadius: 30, marginTop: -30, alignItems: 'center', justifyContent: 'center', shadowColor: '#22372b', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
});
