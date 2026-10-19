import { useState } from 'react';
import { View } from 'react-native';
import { Chip } from '@/components/ui';
import { TimeField } from '@/components/TimePicker';
import { DayPicker } from '@/components/DayPicker';
import { parseHHMM } from '@/lib/time';

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const pad = (n: number) => String(n).padStart(2, '0');
const hhmmOf = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const onDay = (day: Date, hhmm: string) => { const { hour, minute } = parseHHMM(hhmm); return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute).toISOString(); };

// When something is due: no date, today, tomorrow, the day it already has, or any day from a month; then the time.
// A new date starts at 5:00 PM until you pick a time.
export function WhenField({ value, onChange }: { value: string | null; onChange: (dueAt: string | null) => void }) {
  const [picking, setPicking] = useState(false);
  const today = midnight(new Date());
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const dueDay = value ? midnight(new Date(value)) : null;
  const days: [string, Date | null][] = [['No date', null], ['Today', today], ['Tomorrow', tomorrow]];
  if (dueDay && dueDay.getTime() !== today.getTime() && dueDay.getTime() !== tomorrow.getTime()) {
    days.push([dueDay.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), dueDay]);
  }
  const time = value ? hhmmOf(value) : '17:00';

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {days.map(([label, day]) => (
          <Chip key={label} label={label} active={(dueDay?.getTime() ?? null) === (day?.getTime() ?? null)} onPress={() => onChange(day ? onDay(day, time) : null)} />
        ))}
        <Chip label="Pick a day" active={false} onPress={() => setPicking(true)} />
      </View>
      <DayPicker open={picking} value={dueDay} onClose={() => setPicking(false)} onPick={(day) => { onChange(onDay(day, time)); setPicking(false); }} />
      {dueDay && <TimeField label="Time" value={time} onChange={(hhmm) => onChange(onDay(dueDay, hhmm))} />}
    </View>
  );
}
