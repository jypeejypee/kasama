import { parseHHMM } from './time';
import type { ChatResult, DayPlan, DumpResult, Priority, ProposedTask, Repeat, Settings, Task } from './types';

// DEMO MODE: used when no backend URL is set in .env. These simple rules stand in for Claude
// so every screen can be tried without the Supabase function. Real answers replace them
// automatically once EXPO_PUBLIC_ASSISTANT_URL is set.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
// "sat", "saturday", "thurs"… but not the "mon" in "month"
const WEEKDAY = '(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?';
const FEELINGS = /\b(pagod|tired|stress|stressed|sad|lungkot|worried|anxious|feel|feeling|happy|excited|bored|inis)\b/i;
const IDEA = /^\s*(idea|maybe|someday|what if|sana|i wish)\b[:\s]*/i;

// "tomorrow 5pm", "sat", "before the 20th", "bukas" → a real date (or null)
export function parseWhen(text: string, now = new Date()): Date | null {
  const t = text.toLowerCase();
  let day: Date | null = null;
  const at = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  if (/\b(today|tonight|mamaya|ngayon)\b/.test(t)) day = at(0);
  else if (/\b(tomorrow|bukas)\b/.test(t)) day = at(1);
  else if (/\bnext week\b/.test(t)) day = at(7);
  else if (/\bthis week\b/.test(t)) day = at(Math.max(0, 5 - now.getDay())); // Friday
  else if (/\bend of (the )?month\b/.test(t)) day = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  else {
    const wd = t.match(new RegExp(`\\b${WEEKDAY}\\b`));
    const nth = t.match(/\b(?:the |on |before |by )?(\d{1,2})(st|nd|rd|th)\b/);
    if (wd) {
      const diff = (DAYS.indexOf(wd[1].slice(0, 3)) - now.getDay() + 7) % 7;
      day = at(diff);
    } else if (nth) {
      const n = Number(nth[1]);
      day = new Date(now.getFullYear(), now.getMonth(), n);
      if (day < at(0)) day = new Date(now.getFullYear(), now.getMonth() + 1, n);
    }
  }
  const time = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (!day && !time) return null;
  const d = day ?? at(0);
  if (time) {
    let h = Number(time[1]) % 12;
    if (time[3] === 'pm') h += 12;
    d.setHours(h, Number(time[2] ?? 0), 0, 0);
    if (!day && d < now) d.setDate(d.getDate() + 1); // "5pm" already passed → tomorrow
  } else {
    d.setHours(/\bbefore\b/.test(t) ? 12 : 17, 0, 0, 0);
  }
  return d;
}

function parseRepeat(t: string): Repeat | null {
  if (/\b(every ?day|daily|araw-araw)\b/i.test(t)) return 'daily';
  if (/\b(every month|monthly|buwan-buwan)\b/i.test(t)) return 'monthly';
  if (new RegExp(`\\b(every (week|${WEEKDAY})|weekly|linggo-linggo)\\b`, 'i').test(t)) return 'weekly';
  return null;
}

function parsePriority(t: string): Priority {
  if (/\b(urgent|asap|important|deadline|submit|pay|bayad|exam)\b/i.test(t)) return 'high';
  if (/\b(buy|bili|maybe|later|someday)\b/i.test(t)) return 'low';
  return 'medium';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Removes the date words so the title reads cleanly: "pay meralco before the 20th" → "Pay meralco"
function cleanTitle(t: string) {
  return cap(
    t
      .replace(/\b(remind me to|i need to|need to|kailangan ko(ng)?|i have to|please|add)\b/gi, '')
      .replace(/\b(today|tonight|tomorrow|bukas|mamaya|this week|next week|end of (the )?month|every ?(day|week|month)|daily|weekly|monthly)\b/gi, '')
      .replace(new RegExp(`\\b(every|on|by|before|at|this|next)?\\s*${WEEKDAY}\\b`, 'gi'), '')
      .replace(/\b(on|by|before|at)?\s*(the )?\d{1,2}(st|nd|rd|th)\b/gi, '')
      .replace(/\b(at )?\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .replace(/^(and|to)\s+/i, '')
      .replace(/[\s,.]+$/, ''),
  );
}

export function toTask(chunk: string, now = new Date()): ProposedTask {
  const due = parseWhen(chunk, now);
  return {
    title: cleanTitle(chunk) || cap(chunk.trim()),
    notes: null,
    due_at: due ? due.toISOString() : null,
    duration_min: /\b(buy|bili|call|tawag|pay|bayad|email|text)\b/i.test(chunk) ? 15 : /\b(study|review|project|activity|apply)\b/i.test(chunk) ? 60 : 30,
    priority: parsePriority(chunk),
    repeat: parseRepeat(chunk),
  };
}

// Fixed blocks for a given day as [start, end] times. Overnight blocks (like sleep) run to midnight.
function blocksOn(d: Date, settings: Settings) {
  return settings.fixedBlocks
    .filter((b) => b.days.includes(d.getDay()))
    .map((b) => {
      const s = parseHHMM(b.start);
      const e = parseHHMM(b.end);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), s.hour, s.minute);
      let end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), e.hour, e.minute);
      if (end <= start) end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59);
      return { label: b.label, start, end };
    });
}

export async function mockDump(raw: string, settings: Settings): Promise<DumpResult> {
  await wait(700);
  const chunks = raw.split(/[,;\n]+|\s+and\s+(?=[a-z])/i).map((c) => c.trim()).filter((c) => c.length > 2);
  const ideas: string[] = [];
  const tasks: ProposedTask[] = [];
  for (const c of chunks) {
    if (FEELINGS.test(c) || IDEA.test(c)) ideas.push(cap(c.replace(IDEA, '')));
    else tasks.push(toTask(c));
  }
  const heads_up = tasks.flatMap((t) => {
    if (!t.due_at) return [];
    const due = new Date(t.due_at);
    const clash = blocksOn(due, settings).find((b) => due > b.start && due < b.end);
    return clash ? [`${t.title} is due during ${clash.label}. Do it before then.`] : [];
  });
  const summary = tasks.length
    ? `You have ${tasks.length} thing${tasks.length === 1 ? '' : 's'} to do${ideas.length ? ` and ${ideas.length} thought${ideas.length === 1 ? '' : 's'} on your mind` : ''}. (Demo mode: sorted with simple rules, not Claude.)`
    : 'No clear tasks found, but your thoughts are saved. (Demo mode)';
  return { summary, tasks, ideas, heads_up };
}

const rank = { high: 0, medium: 1, low: 2 } as const;
const byUrgency = (a: Task, b: Task) => rank[a.priority] - rank[b.priority] || (a.due_at ?? '9').localeCompare(b.due_at ?? '9');

export async function mockPlan(tasks: Task[], settings: Settings): Promise<DayPlan> {
  await wait(700);
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 0);
  const busy = blocksOn(now, settings);
  // Start at the next quarter hour
  let cursor = new Date(Math.ceil(now.getTime() / (15 * 60 * 1000)) * 15 * 60 * 1000);
  const blocks: DayPlan['blocks'] = [];
  const not_today: string[] = [];

  for (const t of tasks.filter((x) => x.status === 'todo').sort(byUrgency)) {
    let slotEnd = new Date(cursor.getTime() + t.duration_min * 60 * 1000);
    // Jump past any fixed block (work, class, sleep) it would overlap
    for (const b of busy) {
      if (cursor < b.end && slotEnd > b.start) {
        cursor = new Date(b.end);
        slotEnd = new Date(cursor.getTime() + t.duration_min * 60 * 1000);
      }
    }
    if (slotEnd > end || busy.some((b) => cursor < b.end && slotEnd > b.start)) {
      not_today.push(t.title);
      continue;
    }
    blocks.push({ task_id: t.id, title: t.title, start: cursor.toISOString(), end: slotEnd.toISOString() });
    cursor = new Date(slotEnd.getTime() + 10 * 60 * 1000); // 10-minute break
  }
  const message = blocks.length
    ? `I fit ${blocks.length} task${blocks.length === 1 ? '' : 's'} into the rest of today, most urgent first. Kaya mo 'to! (Demo mode)`
    : 'There is no free time left today. Rest, and plan again tomorrow. (Demo mode)';
  return { message, blocks, not_today };
}

// Finds the open task the message is about, by shared words in the title
function findTask(text: string, tasks: Task[]) {
  const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  let best: Task | null = null;
  let score = 0;
  for (const t of tasks) {
    const s = words.filter((w) => t.title.toLowerCase().includes(w)).length;
    if (s > score) { best = t; score = s; }
  }
  return best;
}

export async function mockChat(message: string, tasks: Task[]): Promise<ChatResult> {
  await wait(600);
  const t = message.trim();
  const open = tasks.filter((x) => x.status === 'todo');
  const none: ChatResult = { reply: '', actions: [], ideas: [], remember: [], alarms: [] };

  if (/\b(alarm|wake me|gisingin)\b/i.test(t)) {
    const when = parseWhen(t);
    if (!when) return { ...none, reply: 'Sure. What time should I set the alarm for?' };
    if (when.getTime() <= Date.now()) when.setDate(when.getDate() + 1); // "5am" said at night means tomorrow
    return { ...none, reply: 'Okay, setting your alarm.', alarms: [{ at: when.toISOString(), label: 'Alarm from Kasama' }] };
  }
  const target = findTask(t, open);

  if (IDEA.test(t)) return { ...none, reply: 'Nice one. I saved it to your Ideas.', ideas: [cap(t.replace(IDEA, ''))] };

  if (/\b(remember|i (like|love|hate|prefer|don'?t like)|ayoko|gusto ko)\b/i.test(t)) {
    return { ...none, reply: "Got it, I'll remember that when I plan for you.", remember: [cap(t.replace(/^(please )?remember( that)?\s*/i, ''))] };
  }

  if (/\b(done|finished|tapos na|natapos)\b/i.test(t)) {
    if (target) return { ...none, reply: `Ayos! ${target.title} is done.`, actions: [{ type: 'done', task_id: target.id, task: null, due_at: null }] };
    return { ...none, reply: 'Which task did you finish? Say part of its name.' };
  }

  if (/\b(drop|cancel|delete|remove|wag na|huwag na)\b/i.test(t)) {
    if (target) return { ...none, reply: `Okay, I dropped ${target.title}.`, actions: [{ type: 'drop', task_id: target.id, task: null, due_at: null }] };
    return { ...none, reply: 'Which task should I drop? Say part of its name.' };
  }

  if (/\b(move|reschedule|ilipat|postpone)\b/i.test(t)) {
    const when = parseWhen(t);
    if (target && when) return { ...none, reply: `Done, I moved ${target.title}.`, actions: [{ type: 'move', task_id: target.id, task: null, due_at: when.toISOString() }] };
    return { ...none, reply: 'Tell me which task and when, like "move Java activity to Sunday 3pm".' };
  }

  if (/\b(skip|pagod|tired|overwhelmed|too much)\b/i.test(t)) {
    const low = open.filter((x) => x.priority === 'low').map((x) => x.title);
    return { ...none, reply: low.length ? `Rest is important too. You can skip these for today: ${low.slice(0, 3).join(', ')}. Focus on just one important thing.` : 'Rest first. Pick only your most urgent task today, the rest can wait.' };
  }

  if (/\b(what('s| is) next|ano (na|next)|what should i do|my focus|my tasks)\b/i.test(t)) {
    const top = [...open].sort(byUrgency).slice(0, 3).map((x, i) => `${i + 1}. ${x.title}`);
    return { ...none, reply: top.length ? `Here's your focus:\n${top.join('\n')}` : "You're all clear. Want to add something?" };
  }

  if (/\b(remind me|add|need to|have to|kailangan|every)\b/i.test(t) || parseWhen(t)) {
    const task = toTask(t);
    return { ...none, reply: `Okay, I added ${task.title}.`, actions: [{ type: 'add', task_id: null, task, due_at: null }] };
  }

  return { ...none, reply: "I'm in demo mode, so I only understand simple things for now: add or remind, done, drop, move, ideas, \"remember …\" and \"what's next\". Once my backend is connected I'll understand everything." };
}

// Clear, short commands don't need AI at all, so they cost nothing and never leave the phone.
// Only used when the on-phone rules are sure; everything else goes to Claude.
export async function localCommand(message: string, tasks: Task[]): Promise<ChatResult | null> {
  const t = message.trim();
  const short = t.split(/\s+/).length <= 8;
  const sure =
    /^\s*idea\s*:/i.test(t) ||
    (/\b(alarm|wake me|gisingin)\b/i.test(t) && /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/i.test(t)) ||
    (short && /\b(done|finished|tapos na|natapos|drop|cancel|wag na|huwag na)\b/i.test(t));
  if (!sure) return null;
  const r = await mockChat(t, tasks);
  return r.actions.length || r.ideas.length || r.alarms.length ? r : null;
}
