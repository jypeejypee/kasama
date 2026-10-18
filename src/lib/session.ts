import AsyncStorage from '@react-native-async-storage/async-storage';

// Each phone signs in to Supabase anonymously (no email, no password), once.
// The backend uses that sign-in to give every phone its own daily limit, so nobody can drain the Claude credit.
const KEY = 'kasama.session';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
// "https://x.supabase.co/functions/v1/assistant" → "https://x.supabase.co"
const BASE = (process.env.EXPO_PUBLIC_ASSISTANT_URL ?? '').replace(/\/functions\/v1\/.*$/, '');

type Session = { access_token: string; refresh_token: string; expires_at: number };

async function authCall(path: string, body: Record<string, unknown>): Promise<Session> {
  const res = await fetch(`${BASE}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(data.msg ?? data.error_description ?? `Sign-in failed (${res.status})`);
  const session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 };
  await AsyncStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

async function load(): Promise<Session | null> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null');
  } catch {
    return null;
  }
}

async function fresh(): Promise<string> {
  if (!ANON_KEY) throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is missing in .env');
  const saved = await load();
  if (saved && saved.expires_at - 60_000 > Date.now()) return saved.access_token;
  if (saved?.refresh_token) {
    try {
      return (await authCall('token?grant_type=refresh_token', { refresh_token: saved.refresh_token })).access_token;
    } catch {
      // Refresh token no longer valid: sign in again below
    }
  }
  return (await authCall('signup', {})).access_token;
}

// Several screens may ask at once; they all share one sign-in
let pending: Promise<string> | null = null;
export function accessToken() {
  pending ??= fresh().finally(() => { pending = null; });
  return pending;
}

export const forgetSession = () => AsyncStorage.removeItem(KEY);
export const hasSession = async () => !!(await load());
