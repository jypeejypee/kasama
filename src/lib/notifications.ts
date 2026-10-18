import { Platform } from 'react-native';
import type * as NotificationsLib from 'expo-notifications';
import { getAlarms, getSettings, getTasks } from './storage';
import { endOfDay, fmtTime, isToday, parseHHMM } from './time';
import type { Task } from './types';

// Reminders are scheduled ON THE PHONE (local notifications). They fire even with no
// internet and with the app closed. Every time your tasks change, we cancel everything
// and schedule again from scratch, which keeps it simple and always correct.

const CHANNEL = 'reminders';
const MAX_SCHEDULED = 60; // iPhone keeps at most 64 pending notifications per app

// Load the notifications library carefully: if this app version (for example Expo Go) is missing
// its native parts, Kasama still opens and simply runs without reminders.
let Notifications: typeof NotificationsLib | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications');
} catch (e) {
  console.warn('Reminders are not available in this app version:', (e as Error).message);
}
const lib = () => {
  if (!Notifications) throw new Error('Reminders are not available in this app version');
  return Notifications;
};

// Show notifications even when the app is open
Notifications?.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function setupNotifications(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await lib().setNotificationChannelAsync(CHANNEL, { name: 'Reminders', importance: lib().AndroidImportance.HIGH });
    }
    const current = await lib().getPermissionsAsync();
    if (current.granted) return true;
    const asked = await lib().requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
    return asked.granted;
  } catch (e) {
    console.warn('Kasama could not set up notifications:', (e as Error).message);
    return false;
  }
}

const at = (date: Date) => ({ type: lib().SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL }) as const;

// Reminders must never crash the app (Expo Go and some phones limit notifications), so failures only warn
export async function rescheduleAll() {
  try {
    await scheduleEverything();
  } catch (e) {
    console.warn('Kasama could not schedule reminders:', (e as Error).message);
  }
}

async function scheduleEverything() {
  await lib().cancelAllScheduledNotificationsAsync();
  const [tasks, settings] = await Promise.all([getTasks(), getSettings()]);
  const open = tasks.filter((t) => t.status === 'todo');
  const now = Date.now();
  // Each person picks how much Kasama interrupts them (Settings → Reminders)
  const level = settings.reminders ?? 'calm';
  const all = level === 'all';

  type Item = { when: Date; title: string; body: string; url?: string };
  const items: Item[] = [];
  for (const t of level === 'quiet' ? [] : open) {
    if (t.scheduled_start && new Date(t.scheduled_start).getTime() > now) {
      items.push({ when: new Date(t.scheduled_start), title: `Now: ${t.title}`, body: t.scheduled_end ? `Until ${new Date(t.scheduled_end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : `${t.duration_min} min` });
    }
    if (t.due_at) {
      const hourBefore = new Date(new Date(t.due_at).getTime() - 60 * 60 * 1000);
      if (all && hourBefore.getTime() > now) items.push({ when: hourBefore, title: 'Due in 1 hour', body: t.title });
      // Nudge early enough to still do it, unless it is already planned for later
      const plannedLater = t.scheduled_start && new Date(t.scheduled_start).getTime() > now;
      const nudge = new Date(new Date(t.due_at).getTime() - (t.duration_min + 120) * 60 * 1000);
      if (!plannedLater && nudge.getTime() > now && nudge < hourBefore && awakeHours(nudge)) {
        // A deadline at risk: the one daytime nudge even calm mode keeps
        items.push({ when: nudge, title: `Haven't started ${t.title}?`, body: `Due ${fmtTime(t.due_at)}. It takes about ${t.duration_min} min. Start now, or open Kasama to plan it.`, url: '/' });
      }
    }
    // Like a real assistant: if a planned slot ends and the task is still open, ask about it.
    // Ticking the task off before then cancels this, because everything is rescheduled.
    if (all && t.scheduled_end) {
      const followUp = new Date(new Date(t.scheduled_end).getTime() + 15 * 60 * 1000);
      if (followUp.getTime() > now) items.push({ when: followUp, title: `Did you finish ${t.title}?`, body: "If not, open Kasama and I'll fix the rest of your day.", url: '/' });
    }
  }
  // Alarms you asked for always ring, whatever the reminder level, and come first
  const alarms = (await getAlarms()).slice(0, 10);
  for (const a of alarms) {
    await lib().scheduleNotificationAsync({ content: { title: 'Alarm', body: a.label }, trigger: at(new Date(a.at)) });
  }
  items.sort((a, b) => a.when.getTime() - b.when.getTime());
  for (const it of items.slice(0, MAX_SCHEDULED - 2 - alarms.length)) {
    await lib().scheduleNotificationAsync({ content: { title: it.title, body: it.body, data: it.url ? { url: it.url } : undefined }, trigger: at(it.when) });
  }

  // Daily morning plan and evening check-in. The text is refreshed each time you open the app.
  const top = topTasks(open);
  const morning = parseHHMM(settings.morningDigest);
  const evening = parseHHMM(settings.eveningReview);
  await lib().scheduleNotificationAsync({
    content: { title: 'Good morning. Here is your focus', body: top || 'No tasks yet. Do a quick brain dump.' },
    trigger: { type: lib().SchedulableTriggerInputTypes.DAILY, hour: morning.hour, minute: morning.minute, channelId: CHANNEL },
  });
  await lib().scheduleNotificationAsync({
    content: { title: 'Evening check-in', body: checkInText(open), data: { url: '/' } },
    trigger: { type: lib().SchedulableTriggerInputTypes.DAILY, hour: evening.hour, minute: evening.minute, channelId: CHANNEL },
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
  await lib().scheduleNotificationAsync({
    content: { title: 'Kasama is working', body: 'Reminders will look like this.' },
    trigger: { type: lib().SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
}

// Tapping a reminder opens the screen it points to (for example the evening check-in),
// including when the tap is what opened the app. Returns a function that stops listening.
export function onReminderTap(open: (url: string) => void): () => void {
  if (!Notifications) return () => {};
  const n = Notifications;
  const handle = (response: NotificationsLib.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url;
    // Only open screens inside Kasama ("/", "/things" …), never anything else
    if (typeof url === 'string' && /^\/[a-z-]*$/.test(url)) open(url);
  };
  try {
    handle(n.getLastNotificationResponse());
    n.clearLastNotificationResponse();
    const sub = n.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  } catch (e) {
    console.warn('Reminder taps are not available here:', (e as Error).message);
    return () => {};
  }
}
