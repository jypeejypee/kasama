import AsyncStorage from '@react-native-async-storage/async-storage';
import { dayKey } from './time';
import type { Alarm, ChatMessage, Idea, Mood, Note, Settings, Task } from './types';

// Everything is saved on your phone. Simple, private and works offline.
// (Later practice idea: sync to Supabase so it also shows on your laptop.)
const KEYS = { tasks: 'kasama.tasks', notes: 'kasama.notes', settings: 'kasama.settings', ideas: 'kasama.ideas', chat: 'kasama.chat', alarms: 'kasama.alarms', moods: 'kasama.moods' };

export const DEFAULT_SETTINGS: Settings = {
  morningDigest: '07:00',
  eveningReview: '21:30',
  fixedBlocks: [
    { id: 'work', label: 'Work or school', days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' },
    { id: 'sleep', label: 'Sleep', days: [0, 1, 2, 3, 4, 5, 6], start: '23:30', end: '07:00' },
  ],
};

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
const write = (key: string, value: unknown) => AsyncStorage.setItem(key, JSON.stringify(value));

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const getTasks = () => read<Task[]>(KEYS.tasks, []);
export const saveTasks = (tasks: Task[]) => write(KEYS.tasks, tasks);
export const getNotes = () => read<Note[]>(KEYS.notes, []);
export const saveNotes = (notes: Note[]) => write(KEYS.notes, notes);
export const getSettings = () => read<Settings>(KEYS.settings, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => write(KEYS.settings, s);
export const getIdeas = () => read<Idea[]>(KEYS.ideas, []);
export const saveIdeas = (ideas: Idea[]) => write(KEYS.ideas, ideas);
export const getChat = () => read<ChatMessage[]>(KEYS.chat, []);
export const saveChat = (messages: ChatMessage[]) => write(KEYS.chat, messages.slice(-60));
// Alarm reminders Kasama rings itself (iPhone, or alarms more than a day away). Past ones are dropped.
export const getAlarms = async () => (await read<Alarm[]>(KEYS.alarms, [])).filter((a) => Date.parse(a.at) > Date.now());
export const saveAlarms = (alarms: Alarm[]) => write(KEYS.alarms, alarms);

// How each evening felt, from the check-in. One per day; Journey shows them as dots.
export const getMoods = () => read<Mood[]>(KEYS.moods, []);
export async function saveMood(feeling: Mood['feeling']) {
  const date = dayKey();
  const moods = (await getMoods()).filter((m) => m.date !== date);
  await write(KEYS.moods, [...moods, { date, feeling }].slice(-60));
}

// Newest first. Skips ideas you already have.
export async function addIdeas(texts: string[], source: Idea['source']) {
  const ideas = await getIdeas();
  const known = new Set(ideas.map((i) => i.text.trim().toLowerCase()));
  const now = new Date().toISOString();
  const fresh = texts.map((t) => t.trim()).filter((t) => t && !known.has(t.toLowerCase())).map((text) => ({ id: newId(), text, source, created_at: now }));
  const next = [...fresh, ...ideas];
  await saveIdeas(next);
  return next;
}

// Kasama's memory about you is a simple list of lines in Settings → About me
export async function remember(facts: string[]) {
  if (!facts.length) return;
  const s = await getSettings();
  const lines = (s.aboutMe ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const known = new Set(lines.map((l) => l.replace(/^- /, '').toLowerCase()));
  const added = facts.map((f) => f.trim()).filter((f) => f && !known.has(f.toLowerCase())).map((f) => `- ${f}`);
  if (added.length) await saveSettings({ ...s, aboutMe: [...lines, ...added].join('\n') });
}

// Keeps only the newest line that starts with `prefix` (e.g. the last tired evening), so memory doesn't pile up
export async function rememberLatest(prefix: string, fact: string) {
  const s = await getSettings();
  const lines = (s.aboutMe ?? '').split('\n').map((l) => l.trim()).filter((l) => l && !l.replace(/^- /, '').startsWith(prefix));
  await saveSettings({ ...s, aboutMe: [...lines, `- ${fact}`].join('\n') });
}

export async function updateTask(id: string, patch: Partial<Task>) {
  const tasks = await getTasks();
  const next = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
  await saveTasks(next);
  return next;
}
