import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getSettings, getTasks } from './storage';
import { endOfDay, fmtTime, isToday, parseHHMM } from './time';
import type { Task } from './types';

// Reminders are scheduled ON THE PHONE (local notifications). They fire even with no
// internet and with the app closed. Every time your tasks change, we cancel everything
// and schedule again from scratch, which keeps it simple and always correct.

const CHANNEL = 'reminders';
const MAX_SCHEDULED = 60; // iPhone keeps at most 64 pending notifications per app

// Show notifications even when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: Notifications.AndroidImportance.HIGH });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  return asked.granted;
}

const at = (date: Date) => ({ type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL }) as const;

export async function rescheduleAll() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const [tasks, settings] = await Promise.all([getTasks(), getSettings()]);
  const open = tasks.filter((t) => t.status === 'todo');
  const now = Date.now();

  type Item = { when: Date; title: string; body: string; url?: string };
  const items: Item[] = [];
  for (const t of open) {
    if (t.scheduled_start && new Date(t.scheduled_start).getTime() > now) {
      items.push({ when: new Date(t.scheduled_start), title: `Now: ${t.title}`, body: t.scheduled_end ? `Until ${new Date(t.scheduled_end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : `${t.duration_min} min` });
    }
    if (t.due_at) {
      const hourBefore = new Date(new Date(t.due_at).getTime() - 60 * 60 * 1000);
      if (hourBefore.getTime() > now) items.push({ when: hourBefore, title: 'Due in 1 hour', body: t.title });
      // Nudge early enough to still do it, unless it is already planned for later
      const plannedLater = t.scheduled_start && new Date(t.scheduled_start).getTime() > now;
      const nudge = new Date(new Date(t.due_at).getTime() - (t.duration_min + 120) * 60 * 1000);
      if (!plannedLater && nudge.getTime() > now && nudge < hourBefore && awakeHours(nudge)) {
        items.push({ when: nudge, title: `Haven't started ${t.title}?`, body: `Due ${fmtTime(t.due_at)}. It takes about ${t.duration_min} min. Start now, or open Kasama to plan it.`, url: '/' });
      }
    }
    // Like a real assistant: if a planned slot ends and the task is still open, ask about it.
    // Ticking the task off before then cancels this, because everything is rescheduled.
    if (t.scheduled_end) {
      const followUp = new Date(new Date(t.scheduled_end).getTime() + 15 * 60 * 1000);
      if (followUp.getTime() > now) items.push({ when: followUp, title: `Did you finish ${t.title}?`, body: "If not, open Kasama and I'll fix the rest of your day.", url: '/' });
    }
  }
  items.sort((a, b) => a.when.getTime() - b.when.getTime());
  for (const it of items.slice(0, MAX_SCHEDULED - 2)) {
    await Notifications.scheduleNotificationAsync({ content: { title: it.title, body: it.body, data: it.url ? { url: it.url } : undefined }, trigger: at(it.when) });
  }

  // Daily morning plan and evening check-in. The text is refreshed each time you open the app.
  const top = topTasks(open);
  const morning = parseHHMM(settings.morningDigest);
  const evening = parseHHMM(settings.eveningReview);
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Good morning. Here is your focus', body: top || 'No tasks yet. Do a quick brain dump.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: morning.hour, minute: morning.minute, channelId: CHANNEL },
  });
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Evening check-in', body: checkInText(open), data: { url: '/check-in' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: evening.hour, minute: evening.minute, channelId: CHANNEL },
  });
}

// No nudges in the middle of the night
const awakeHours = (d: Date) => d.getHours() >= 7 && d.getHours() < 22;

function checkInText(open: Task[]) {
  const left = open.filter((t) => isToday(t.scheduled_start) || (t.due_at && new Date(t.due_at) <= endOfDay())).length;
  if (left === 0) return 'Quick look at today, then rest.';
  return `${left} task${left === 1 ? '' : 's'} still open today. Tap to tick off what you finished and move the rest to tomorrow.`;
}

const rank = { high: 0, medium: 1, low: 2 } as const;
function topTasks(open: Task[]) {
  return [...open]
    .sort((a, b) => rank[a.priority] - rank[b.priority] || (a.due_at ?? '9').localeCompare(b.due_at ?? '9'))
    .slice(0, 3)
    .map((t, i) => `${i + 1}. ${t.title}`)
    .join('  ');
}

export async function sendTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Kasama is working', body: 'Reminders will look like this.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
}
