// The phone already runs on Manila time, so these use the device's local time.

// "Wednesday, October 14, 2026, 2:30 PM (UTC+08:00)" — tells Claude exactly what "now" is
export function describeNow(d = new Date()) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0');
  const mm = String(Math.abs(off) % 60).padStart(2, '0');
  const text = d.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return { text: `${text} (UTC${sign}${hh}:${mm})`, offset: `${sign}${hh}:${mm}` };
}

export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const endOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
export const isToday = (iso: string | null) => !!iso && new Date(iso) >= startOfDay() && new Date(iso) <= endOfDay();

export function fmtTime(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function fmtDue(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isToday(iso)) return `today ${fmtTime(iso)}`;
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const parseHHMM = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return { hour: h, minute: m };
};
export const validHHMM = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

// "2026-10-18" in the phone's own time zone (toISOString would use UTC and shift late nights)
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Friendly time typing: "7:00", "7", "7pm", "7:30 PM", "19:30" → "07:00" / "19:30" (null if it isn't a time)
export function toHHMM(input: string): string | null {
  const t = input.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!t) return null;
  let h = Number(t[1]);
  const m = Number(t[2] ?? 0);
  if (t[3]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (t[3] === 'pm' ? 12 : 0);
  }
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
