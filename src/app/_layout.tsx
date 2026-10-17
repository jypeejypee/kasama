import { useEffect } from 'react';
import { AppState } from 'react-native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { rescheduleAll, setupNotifications } from '@/lib/notifications';
import { useColors } from '@/lib/theme';

// Tapping a reminder opens the screen it points to (for example the evening check-in)
function openFrom(response: Notifications.NotificationResponse | null) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string') router.push(url as never);
}

export default function RootLayout() {
  const c = useColors();
  useEffect(() => {
    // Ask for permission once, then refresh reminders every time the app comes to the front
    setupNotifications().then((ok) => { if (ok) rescheduleAll(); });
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') rescheduleAll(); });

    // The app may have been opened by tapping a notification while it was closed
    openFrom(Notifications.getLastNotificationResponse());
    Notifications.clearLastNotificationResponse();
    const tap = Notifications.addNotificationResponseReceivedListener(openFrom);
    return () => { sub.remove(); tap.remove(); };
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: c.card }, headerTintColor: c.text, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="check-in" options={{ title: 'Evening check-in', presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
