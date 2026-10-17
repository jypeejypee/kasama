export type FixedBlock = { id: string; label: string; days: number[]; start: string; end: string };

export type Settings = {
  morningDigest: string; // "07:00"
  eveningReview: string; // "21:30"
  fixedBlocks: FixedBlock[];
  aboutMe?: string; // what Kasama remembers about you, sent with every request
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
};

export type Note = { id: string; raw: string; summary: string; ideas: string[]; created_at: string };

export type ProposedTask = Pick<Task, 'title' | 'notes' | 'due_at' | 'duration_min' | 'priority' | 'repeat'>;

export type Idea = { id: string; text: string; source: 'dump' | 'chat' | 'manual'; created_at: string };

export type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; changes?: string[]; created_at: string };

export type ChatAction = { type: 'add' | 'done' | 'drop' | 'move'; task_id: string | null; task: ProposedTask | null; due_at: string | null };
export type ChatResult = { reply: string; actions: ChatAction[]; ideas: string[]; remember: string[] };

export type DumpResult = { summary: string; tasks: ProposedTask[]; ideas: string[]; heads_up: string[] };

export type DayPlan = {
  message: string;
  blocks: { task_id: string | null; title: string; start: string; end: string }[];
  not_today: string[];
};
