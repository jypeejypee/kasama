import { describeNow } from './time';
import { localCommand, mockChat, mockDump, mockPlan } from './mock';
import { accessToken, forgetSession } from './session';
import { busyAsBlocks, busyToday } from './calendar';
import type { ChatMessage, ChatResult, DayPlan, DumpResult, Settings, Task } from './types';

// The Claude API key never goes inside the app (anyone could pull it out of the APK).
// Instead the app calls your Supabase Edge Function, which holds the key and calls Claude.
const URL = process.env.EXPO_PUBLIC_ASSISTANT_URL;
const SECRET = process.env.EXPO_PUBLIC_APP_SECRET;

// No backend URL yet → demo mode: simple on-phone rules answer instead of Claude (see mock.ts)
export const DEMO = !URL;

async function call<T>(action: 'dump' | 'plan' | 'chat', payload: Record<string, unknown>): Promise<T> {
  if (!URL) throw new Error('EXPO_PUBLIC_ASSISTANT_URL is missing in .env');
  // The app secret travels in a header, so never send it over plain http
  if (!URL.startsWith('https://')) throw new Error('EXPO_PUBLIC_ASSISTANT_URL must start with https://');
  const now = describeNow();
  const send = async () => fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-app-secret': SECRET ?? '', Authorization: `Bearer ${await accessToken()}` },
    body: JSON.stringify({ action, now: now.text, offset: now.offset, ...payload }),
  });
  let res = await send();
  let body = await res.json().catch(() => ({}));
  // Sign-in expired or was removed: sign in again once and retry
  if (res.status === 401 && body.code === 'auth') {
    await forgetSession();
    res = await send();
    body = await res.json().catch(() => ({}));
  }
  if (!res.ok) throw new Error(body.error ?? `Assistant error ${res.status}`);
  return body as T;
}

// Only what Claude needs leaves the phone: first names of your people (never their numbers), no calendar ids,
// and only the newest part of "What I know about you" (it's resent with every message, so it adds up)
const ABOUT_ME_CHARS = 1500;
const forCloud = ({ people, calendarIds: _ids, bedtime: _bed, aboutMe, ...s }: Settings) => ({
  ...s,
  aboutMe: aboutMe ? aboutMe.slice(-ABOUT_ME_CHARS) : aboutMe,
  people: (people ?? []).map((p) => p.name),
});

// Longest message Kasama sends to Claude in one go; longer ones are kindly split by the Kasama screen
export const MAX_CHAT_CHARS = 1000;
export const MAX_DUMP_CHARS = 3000;

export const sortThoughts = (raw: string, settings: Settings) => (DEMO ? mockDump(raw, settings) : call<DumpResult>('dump', { raw, settings: forCloud(settings) }));

// Your calendar's busy times join your fixed schedule for today, so tasks never land on a meeting
export async function planDay(tasks: Task[], settings: Settings) {
  const busy = busyAsBlocks(await busyToday(settings.calendarIds ?? []));
  const withBusy = { ...settings, fixedBlocks: [...settings.fixedBlocks, ...busy] };
  if (DEMO) return mockPlan(tasks, withBusy);
  return call<DayPlan>('plan', { tasks: openTasks(tasks), settings: forCloud(withBusy) });
}

// Your task list rides along with every message, so send only the 30 that matter most right now:
// planned today first, then the soonest deadlines, then by priority. Titles are trimmed.
const MAX_TASKS = 30;
const rank = { high: 0, medium: 1, low: 2 } as const;
const openTasks = (tasks: Task[]) => {
  const today = new Date().toDateString();
  const plannedToday = (t: Task) => (t.scheduled_start && new Date(t.scheduled_start).toDateString() === today ? 0 : 1);
  return tasks
    .filter((t) => t.status === 'todo')
    .sort((a, b) => plannedToday(a) - plannedToday(b) || (a.due_at ?? '9').localeCompare(b.due_at ?? '9') || rank[a.priority] - rank[b.priority])
    .slice(0, MAX_TASKS)
    .map((t) => ({ id: t.id, title: t.title.slice(0, 80), due_at: t.due_at, minutes: t.duration_min, priority: t.priority, repeat: t.repeat ?? null, planned: t.scheduled_start }));
};

export async function chat(message: string, history: ChatMessage[], tasks: Task[], settings: Settings) {
  if (DEMO) return mockChat(message, tasks);
  const local = await localCommand(message, tasks);
  if (local) return local;
  return call<ChatResult>('chat', { message, history: history.slice(-6).map((m) => ({ role: m.role, text: m.text })), tasks: openTasks(tasks), settings: forCloud(settings) });
}
