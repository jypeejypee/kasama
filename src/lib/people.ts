import { Linking, Platform } from 'react-native';
import type { Person, Settings } from './types';

const DAY = 24 * 60 * 60 * 1000;

// Opens YOUR messaging app with them already picked. Kasama never sends anything itself.
export async function sayHi(p: Person) {
  const url = p.how === 'messenger'
    ? `https://m.me/${encodeURIComponent(p.handle.replace(/^@/, ''))}`
    : `sms:${p.handle.replace(/[^\d+]/g, '')}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent('Hi! Just thinking of you.')}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

// A gentle "say hi" at most every 5 days, rotating through your people
export function nudgeFor(s: Settings, now: number): Person | null {
  const people = s.people ?? [];
  if (!people.length) return null;
  if (s.nudgedAt && now - Date.parse(s.nudgedAt) < 5 * DAY) return null;
  return people[Math.floor(now / DAY) % people.length];
}

// The "is there someone you trust?" question: only after a week together, and only once
export const shouldInvite = (s: Settings, now: number) =>
  !s.peopleAsked && !(s.people ?? []).length && !!s.welcomedAt && now - Date.parse(s.welcomedAt) > 7 * DAY;
