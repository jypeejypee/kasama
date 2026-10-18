import { describeNow } from './time';
import { mockChat, mockDump, mockPlan } from './mock';
import { accessToken, forgetSession } from './session';
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

export const sortThoughts = (raw: string, settings: Settings) => (DEMO ? mockDump(raw, settings) : call<DumpResult>('dump', { raw, settings }));

export function planDay(tasks: Task[], settings: Settings) {
  if (DEMO) return mockPlan(tasks, settings);
  return call<DayPlan>('plan', { tasks: openTasks(tasks), settings });
}

const openTasks = (tasks: Task[]) => tasks.filter((t) => t.status === 'todo').map((t) => ({ id: t.id, title: t.title, due_at: t.due_at, minutes: t.duration_min, priority: t.priority, repeat: t.repeat ?? null, planned: t.scheduled_start }));

export function chat(message: string, history: ChatMessage[], tasks: Task[], settings: Settings) {
  if (DEMO) return mockChat(message, tasks);
  return call<ChatResult>('chat', { message, history: history.slice(-12).map((m) => ({ role: m.role, text: m.text })), tasks: openTasks(tasks), settings });
}
