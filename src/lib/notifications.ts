import { Platform } from 'react-native';
import type * as NotificationsLib from 'expo-notifications';
import { addLateNight, getAlarms, getSettings, getTasks } from './storage';
import { dayKey, endOfDay, fmtTime, isToday, parseHHMM } from './time';
import { asleepAt, pastBedtime, sleepBlock, stillUpText } from './sleep';
import { eventsBetween } from './calendar';
import type { Settings, Task } from './types';

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

// One run at a time: scheduling is dozens of native calls, and two runs at once would cancel each other's work.
// Quick changes (ticking off five tasks) share the next run, which reads the latest saved list anyway.
let queue: Promise<void> = Promise.resolve();
let waiting = false;

// Reminders must never crash the app (Expo Go and some phones limit notifications), so failures only warn
export function rescheduleAll(): Promise<void> {
  if (waiting) return queue;
  waiting = true;
  queue = queue.then(async () => {
    waiting = false;
    try {
      await scheduleEverything();
    } catch (e) {
      console.warn('Kasama could not schedule reminders:', (e as Error).message);
    }
  });
  return queue;
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
      if (!plannedLater && nudge.getTime() > now && nudge < hourBefore && !asleepAt(settings, nudge)) {
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
  // The evening before a day with something on it: one gentle heads-up about tomorrow
  if (level !== 'quiet') items.push(...(await headsUps(open, settings)).filter((h) => h.when.getTime() > now));
  // Alarms you asked for always ring, whatever the reminder level, and come first
  const alarms = (await getAlarms()).slice(0, 10);
  for (const a of alarms) {
    await lib().scheduleNotificationAsync({ content: { title: 'Alarm', body: a.label }, trigger: at(new Date(a.at)) });
  }
  const bedtimes = await scheduleBedtime(settings);
  items.sort((a, b) => a.when.getTime() - b.when.getTime());
  for (const it of items.slice(0, MAX_SCHEDULED - 2 - alarms.length - bedtimes)) {
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

// Bedtime, from your Sleep block. Two parts:
// 1. A wind-down nudge 30 minutes before, on the nights you sleep (weekly, so it works even if you don't open Kasama).
// 2. The dynamic part: if you open Kasama after bedtime, you're clearly still up, so I check on you again in 30 minutes.
//    Opening it again pushes that back. It never fires for someone already asleep, because only being on the phone starts it.
// Kasama can't see other apps, so scrolling TikTok without opening Kasama only gets the wind-down nudge.
async function scheduleBedtime(settings: Awaited<ReturnType<typeof getSettings>>): Promise<number> {
  const b = sleepBlock(settings);
  if (!b || settings.bedtime === false) return 0;
  let count = 0;
  const { hour, minute } = parseHHMM(b.start);
  const windDown = hour * 60 + minute - 30;
  const wd = (windDown + 24 * 60) % (24 * 60);
  for (const day of b.days) {
    // If winding down starts before midnight, it's still the same evening; otherwise it's the next morning's weekday
    const weekday = (windDown < 0 ? (day + 6) % 7 : day) + 1; // expo counts Sunday as 1
    await lib().scheduleNotificationAsync({
      content: { title: 'Time to wind down', body: `Bedtime is at ${fmtTime(new Date(2000, 0, 1, hour, minute).toISOString())}. Start putting things down. Tomorrow can wait.` },
      trigger: { type: lib().SchedulableTriggerInputTypes.WEEKLY, weekday, hour: Math.floor(wd / 60), minute: wd % 60, channelId: CHANNEL },
    });
    count += 1;
  }
  const evening = pastBedtime(settings);
  if (evening) {
    await addLateNight(dayKey(evening));
    const when = new Date(Date.now() + 30 * 60 * 1000);
    await lib().scheduleNotificationAsync({ content: stillUpText(when), trigger: at(when) });
    count += 1;
  }
  return count;
}


// "Bukas": the evening before, what's coming tomorrow, so nothing catches you by surprise.
// To-dos due that day, plus your phone calendar's events if you connected it (their names stay on the phone).
// Daily repeats are left out; they would be the same note every night.
const HEADS_UP_HOUR = 19; // 7:00 PM the day before
const HEADS_UP_DAYS = 14; // looks this far ahead
type HeadsUp = { day: string; when: Date; title: string; body: string };

async function headsUps(open: Task[], settings: Settings): Promise<HeadsUp[]> {
  const now = new Date();
  const until = new Date(now.getFullYear(), now.getMonth(), now.getDate() + HEADS_UP_DAYS + 1);
  const byDay = new Map<string, { at: Date; label: string }[]>();
  const add = (at: Date, label: string) => byDay.set(dayKey(at), [...(byDay.get(dayKey(at)) ?? []), { at, label }]);
  for (const t of open) {
    if (!t.due_at || t.repeat === 'daily') continue;
    const due = new Date(t.due_at);
    if (due > now && due < until) add(due, `${t.title} by ${fmtTime(t.due_at)}`);
  }
  for (const e of await eventsBetween(settings.calendarIds ?? [], now, until)) {
    add(e.start, e.allDay ? e.title : `${e.title} at ${fmtTime(e.start.toISOString())}`);
  }
  return [...byDay.entries()].map(([day, list]) => {
    list.sort((a, b) => a.at.getTime() - b.at.getTime());
    const d = list[0].at;
    let when = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, HEADS_UP_HOUR);
    if (asleepAt(settings, when)) when = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12); // night shift: noon instead
    const more = list.length > 3 ? ` · and ${list.length - 3} more` : '';
    return list.length === 1
      ? { day, when, title: `Bukas: ${list[0].label}`, body: 'Just a heads-up, para ready ka. Open Kasama to plan it.' }
      : { day, when, title: `Bukas: ${list.length} things coming`, body: list.slice(0, 3).map((x) => x.label).join(' · ') + more };
  });
}

// Testers: see tomorrow's heads-up now (in 5 seconds) instead of waiting for the evening.
// With nothing due tomorrow, a sample shows what it looks like.
export async function previewHeadsUp(): Promise<'tomorrow' | 'sample'> {
  const [tasks, settings] = await Promise.all([getTasks(), getSettings()]);
  const d = new Date();
  const tomorrow = dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
  const real = (await headsUps(tasks.filter((t) => t.status === 'todo'), settings)).find((h) => h.day === tomorrow);
  const note = real ?? { title: 'Bukas: Haircut by 5:00 PM', body: 'Just a heads-up, para ready ka. Open Kasama to plan it.' };
  await lib().scheduleNotificationAsync({
    content: { title: note.title, body: note.body, data: { url: '/' } },
    trigger: { type: lib().SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
  });
  return real ? 'tomorrow' : 'sample';
}

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

// "Delete my data": no reminder should fire about things that are gone
export async function cancelAllReminders() {
  try {
    await lib().cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.warn('Kasama could not cancel reminders:', (e as Error).message);
  }
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
