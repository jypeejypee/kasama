import { Platform } from 'react-native';
import { startActivityAsync } from 'expo-intent-launcher';
import { getAlarms, newId, saveAlarms } from './storage';
import { rescheduleAll } from './notifications';
import { fmtDue } from './time';
import type { AlarmRequest } from './types';

const DAY = 24 * 60 * 60 * 1000;

// Android: open the phone's Clock app with the alarm filled in, so it rings like a real alarm (even on silent).
// The Clock app sets the next time that hour comes around, so only use it for alarms within a day.
async function openClockApp(at: Date, label: string) {
  if (Platform.OS !== 'android' || at.getTime() - Date.now() > DAY) return false;
  try {
    await startActivityAsync('android.intent.action.SET_ALARM', {
      extra: {
        'android.intent.extra.alarm.HOUR': at.getHours(),
        'android.intent.extra.alarm.MINUTES': at.getMinutes(),
        'android.intent.extra.alarm.MESSAGE': label,
        'android.intent.extra.alarm.SKIP_UI': false, // you see it and tap Save
      },
    });
    return true;
  } catch {
    return false;
  }
}

// Sets each alarm the best way this phone allows. Returns what it did, in plain words.
export async function setAlarms(requests: AlarmRequest[]) {
  const changes: string[] = [];
  const later = await getAlarms();
  for (const r of requests) {
    const at = new Date(r.at);
    if (isNaN(at.getTime()) || at.getTime() <= Date.now()) continue;
    if (await openClockApp(at, r.label)) {
      changes.push(`Opened your Clock app for a ${fmtDue(r.at)} alarm`);
    } else {
      // iPhone apps can't create alarms, so Kasama rings a reminder instead
      later.push({ ...r, id: newId() });
      changes.push(`I'll ring you at ${fmtDue(r.at)}: ${r.label}`);
    }
  }
  if (later.length) {
    await saveAlarms(later);
    await rescheduleAll();
  }
  return changes;
}
