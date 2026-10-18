import { parseHHMM } from './time';
import type { FixedBlock, Settings } from './types';

// Your sleep is the block in your fixed schedule called Sleep (or Tulog)
export const sleepBlock = (s: Settings): FixedBlock | undefined => s.fixedBlocks.find((b) => /sleep|tulog/i.test(b.label));

const minutesOf = (hhmm: string) => { const { hour, minute } = parseHHMM(hhmm); return hour * 60 + minute; };

// If it's past your bedtime right now, returns the evening that night started on, otherwise null.
// The last 90 minutes before you wake up don't count: up at 6 for an early start isn't "skipping sleep".
export function pastBedtime(s: Settings, now = new Date()): Date | null {
  const b = sleepBlock(s);
  if (!b) return null;
  const start = minutesOf(b.start);
  const end = minutesOf(b.end);
  const n = now.getHours() * 60 + now.getMinutes();
  const overnight = start > end;
  const inside = overnight ? n >= start || n < end - 90 : n >= start && n < end - 90;
  if (!inside) return null;
  const evening = new Date(now);
  if (overnight && n < start) evening.setDate(evening.getDate() - 1);
  return b.days.includes(evening.getDay()) ? evening : null;
}

// A kind "still up?", a little different depending on how late it is
export function stillUpText(when: Date) {
  const h = when.getHours();
  if (h >= 0 && h < 5) return { title: "It's really late", body: 'Whatever is left can wait for tomorrow. Put the phone down and rest. I will remember for you.' };
  return { title: 'Still up?', body: "It's past your bedtime. Tomorrow-you will thank you for sleeping now." };
}

const hhmm = (m: number) => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

// Is this a time you're normally asleep? Quiet hours follow your Sleep block (night shift included),
// or 10 pm to 7 am if you haven't set one.
export function asleepAt(s: Settings, d: Date) {
  const b = sleepBlock(s);
  const n = d.getHours() * 60 + d.getMinutes();
  if (!b) return n >= 22 * 60 || n < 7 * 60;
  const start = minutesOf(b.start);
  const end = minutesOf(b.end);
  return start > end ? n >= start || n < end : n >= start && n < end;
}

// Your hello when you wake up, and your check-in half an hour before you sleep
export function timesFromSleep(s: Settings) {
  const b = sleepBlock(s);
  return b ? { morningDigest: b.end, eveningReview: hhmm(minutesOf(b.start) - 30) } : null;
}
