import type * as CalendarLib from 'expo-calendar';
import { endOfDay } from './time';
import type { FixedBlock } from './types';

// Kasama looks at your calendar only to see WHEN you're busy, never WHAT you're doing:
// event names stay on the phone and never go to the backend or Claude.
// Loaded carefully, like reminders: Expo Go may be missing the native part.
let Cal: typeof CalendarLib | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Cal = require('expo-calendar');
} catch {
  Cal = null;
}

export type PhoneCalendar = { id: string; title: string; color?: string; account: string };
export type Busy = { start: Date; end: Date };

export const calendarAvailable = () => !!Cal;

// Asks once, then lists the calendars on this phone (Google, Samsung, Outlook… whatever is synced)
export async function connectCalendars(): Promise<PhoneCalendar[] | 'denied' | 'unavailable'> {
  if (!Cal) return 'unavailable';
  try {
    const perm = await Cal.requestCalendarPermissions();
    if (!perm.granted) return 'denied';
    const list = await Cal.getCalendars(Cal.EntityTypes.EVENT);
    return list.map((c) => ({ id: c.id, title: c.title, color: c.color, account: c.source?.name ?? '' }));
  } catch {
    return 'unavailable';
  }
}

// Busy times between now and the end of today, merged so overlaps count once
export async function busyToday(calendarIds: string[]): Promise<Busy[]> {
  if (!Cal || calendarIds.length === 0) return [];
  try {
    if (!(await Cal.getCalendarPermissions()).granted) return [];
    const now = new Date();
    const events = await Cal.listEvents(calendarIds, now, endOfDay());
    const blocks = events
      .filter((e) => !e.allDay && e.availability !== Cal!.Availability.FREE) // holidays and "free" events don't block time
      .map((e) => ({ start: new Date(e.startDate), end: new Date(e.endDate) }))
      .filter((b) => b.end > now)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const merged: Busy[] = [];
    for (const b of blocks) {
      const last = merged[merged.length - 1];
      if (last && b.start <= last.end) last.end = new Date(Math.max(last.end.getTime(), b.end.getTime()));
      else merged.push({ ...b });
    }
    return merged;
  } catch {
    return [];
  }
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Today's busy times as fixed blocks, so "Plan my day" never puts a task on top of a meeting.
// Only times go out; the label is always just "Busy".
export const busyAsBlocks = (busy: Busy[]): FixedBlock[] =>
  busy.map((b, i) => ({ id: `cal-${i}`, label: 'Busy (calendar)', days: [b.start.getDay()], start: hhmm(b.start), end: b.end > endOfDay() ? '23:59' : hhmm(b.end) }));
