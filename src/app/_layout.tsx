import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Nunito_700Bold, Nunito_800ExtraBold, useFonts } from '@expo-google-fonts/nunito';
import { NunitoSans_400Regular, NunitoSans_600SemiBold, NunitoSans_700Bold } from '@expo-google-fonts/nunito-sans';
import { onReminderTap, rescheduleAll, setupNotifications } from '@/lib/notifications';
import { getSettings, saveSettings } from '@/lib/storage';
import { setPlace, useColors } from '@/lib/theme';
import { prefetchUpdate, updateIfAvailable } from '@/lib/updates';

// Keep the splash up until Kasama's fonts are ready, so text never jumps
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const c = useColors();
  const [loaded, error] = useFonts({ Nunito_700Bold, Nunito_800ExtraBold, NunitoSans_400Regular, NunitoSans_600SemiBold, NunitoSans_700Bold });
  // Check for a new version while the splash is up (a few seconds at most), so updates apply on this open
  const [checked, setChecked] = useState(false);
  useEffect(() => { updateIfAvailable().finally(() => setChecked(true)); }, []);

  useEffect(() => {
    if ((loaded || error) && checked) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error, checked]);

  useEffect(() => {
    getSettings().then((s) => setPlace(s.place));
    // Ask for permission once, then refresh reminders every time the app comes to the front
    setupNotifications().then((ok) => (ok ? rescheduleAll() : undefined));
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') { rescheduleAll(); prefetchUpdate(); } });
    const stopTaps = onReminderTap((url) => router.push(url as never));
    return () => { sub.remove(); stopTaps(); };
  }, []);

  // First open: say hi before anything else (after the screens are ready to navigate)
  const ready = (loaded || !!error) && checked;
  useEffect(() => {
    if (!ready) return;
    getSettings().then((s) => {
      if (!s.welcomed) router.replace('/welcome');
      else if (!s.welcomedAt) saveSettings({ ...s, welcomedAt: new Date().toISOString() }); // for phones welcomed before this was tracked
    });
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.sky } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}
