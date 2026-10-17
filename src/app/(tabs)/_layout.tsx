import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable } from 'react-native';
import { router, Tabs } from 'expo-router';
import { useColors } from '@/lib/theme';

export default function TabLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line },
        headerStyle: { backgroundColor: c.card },
        headerTintColor: c.text,
        sceneStyle: { backgroundColor: c.bg },
        tabBarHideOnKeyboard: true, // more room for typing in chat and brain dump
        headerRight: () => (
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} hitSlop={10} style={{ marginRight: 16 }}>
            <Ionicons name="settings-outline" size={22} color={c.text} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="chat" options={{ title: 'Kasama', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="dump" options={{ title: 'Brain dump', tabBarIcon: ({ color, size }) => <Ionicons name="create-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="ideas" options={{ title: 'Ideas', tabBarIcon: ({ color, size }) => <Ionicons name="bulb-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
