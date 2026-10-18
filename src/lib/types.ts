export type FixedBlock = { id: string; label: string; days: number[]; start: string; end: string };

// How Kasama talks to you: one size does not fit all
export type Encourage = 'quiet' | 'gentle' | 'cheer';
export type Support = 'ask' | 'listen' | 'advise';
export type Faith = 'none' | 'christian' | 'spiritual' | 'other';
export type Place = 'dagat' | 'bundok' | 'palayan';
// Filipino (fil-PH) also catches English words, so it's the best fit for Taglish
export type VoiceLang = 'fil-PH' | 'en-US';
// Someone you trust. Kasama only opens your own SMS or Messenger; it never messages them itself.
export type Person = { id: string; name: string; how: 'sms' | 'messenger'; handle: string };
// quiet: morning and night only · calm: plus task starts and deadlines at risk · all: every reminder
export type Reminders = 'quiet' | 'calm' | 'all';

export type Settings = {
  morningDigest: string; // "07:00"
  eveningReview: string; // "21:30"
  fixedBlocks: FixedBlock[];
  reminders?: Reminders; // default 'calm'
  bedtime?: boolean; // nudge at bedtime from your Sleep block, default on
  place?: Place; // the calm place Kasama lives in, default 'dagat'
  welcomed?: boolean; // set after the first-open Welcome
  welcomedAt?: string; // ISO; "your people" is offered only after a week
  calendarIds?: string[]; // phone calendars Kasama may check for busy times
  people?: Person[]; // people you trust; Kasama nudges you to say hi
  peopleAsked?: boolean; // the gentle "is there someone you trust?" question was answered
  nudgedAt?: string; // ISO; last time Kasama suggested saying hi
  voiceLang?: VoiceLang; // what the mic listens for, default Filipino
  aboutMe?: string; // what Kasama remembers about you, sent with every request
  name?: string;
  encourage?: Encourage;
  support?: Support;
  faith?: Faith;
  faithOther?: string; // their own words when faith is 'other'
};

export type Priority = 'high' | 'medium' | 'low';
export type Repeat = 'daily' | 'weekly' | 'monthly';

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  due_at: string | null; // ISO
  duration_min: number;
  priority: Priority;
  status: 'todo' | 'done' | 'dropped';
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string;
  done_at: string | null;
  repeat?: Repeat | null; // finishing it creates the next one
  from_id?: string | null; // the repeating task this one came from
  steps?: Step[]; // small steps you wrote in the task's sheet; they stay on the phone
};

export type Step = { id: string; text: string; done: boolean };

export type Note = { id: string; raw: string; summary: string; ideas: string[]; created_at: string };

export type ProposedTask = Pick<Task, 'title' | 'notes' | 'due_at' | 'duration_min' | 'priority' | 'repeat'>;

export type Idea = { id: string; text: string; source: 'dump' | 'chat' | 'manual'; created_at: string; notes?: string | null; steps?: Step[] };

export type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; changes?: string[]; created_at: string };

export type ChatAction = { type: 'add' | 'done' | 'drop' | 'move'; task_id: string | null; task: ProposedTask | null; due_at: string | null };
export type Mood = { date: string; feeling: 'Masaya' | 'Okay lang' | 'Pagod' }; // date: YYYY-MM-DD

export type AlarmRequest = { at: string; label: string }; // at: ISO with offset
export type Alarm = AlarmRequest & { id: string };
export type ChatResult = { reply: string; actions: ChatAction[]; ideas: string[]; remember: string[]; alarms: AlarmRequest[] };

export type DumpResult = { summary: string; tasks: ProposedTask[]; ideas: string[]; heads_up: string[] };

export type DayPlan = {
  message: string;
  blocks: { task_id: string | null; title: string; start: string; end: string }[];
  not_today: string[];
};
