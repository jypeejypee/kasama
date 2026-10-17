import { addIdeas, getTasks, newId, remember, saveTasks, updateTask } from './storage';
import { rescheduleAll } from './notifications';
import { endOfDay, fmtDue, fmtTime } from './time';
import type { ChatResult, DayPlan, ProposedTask, Repeat, Task } from './types';

// Every change to tasks goes through here, so reminders always match your list.

export async function toggleTask(t: Task) {
  const done = t.status !== 'done';
  let next = await updateTask(t.id, { status: done ? 'done' : 'todo', done_at: done ? new Date().toISOString() : null });
  if (t.repeat && done) {
    // A repeating task comes back: finishing this one creates the next one
    next = [...next, { ...t, id: newId(), status: 'todo', due_at: nextDue(t.due_at, t.repeat), scheduled_start: null, scheduled_end: null, created_at: new Date().toISOString(), done_at: null, from_id: t.id }];
    await saveTasks(next);
  } else if (t.repeat && !done) {
    // Un-ticked by mistake: remove the next one it created
    next = next.filter((x) => !(x.from_id === t.id && x.status === 'todo'));
    await saveTasks(next);
  }
  await rescheduleAll();
  return next;
}

// The next date after now, keeping the same time of day
function nextDue(due: string | null, repeat: Repeat) {
  const d = due ? new Date(due) : new Date();
  do {
    if (repeat === 'daily') d.setDate(d.getDate() + 1);
    else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
  } while (d.getTime() < Date.now());
  return d.toISOString();
}

export async function dropTask(t: Task) {
  const next = await updateTask(t.id, { status: 'dropped' });
  await rescheduleAll();
  return next;
}

export async function addTasks(items: ProposedTask[]) {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const added: Task[] = items.map((p) => ({ ...p, repeat: p.repeat ?? null, id: newId(), status: 'todo', scheduled_start: null, scheduled_end: null, created_at: now, done_at: null }));
  const next = [...tasks, ...added];
  await saveTasks(next);
  await rescheduleAll();
  return next;
}

// A new plan replaces the old one: open tasks left out of it lose their old time slot,
// so a missed slot never lingers on the Today screen.
export async function applyPlan(plan: DayPlan) {
  const tasks = await getTasks();
  const slots = new Map(plan.blocks.filter((b) => b.task_id).map((b) => [b.task_id as string, b]));
  const next = tasks.map((t) => {
    const b = slots.get(t.id);
    if (b) return { ...t, scheduled_start: b.start, scheduled_end: b.end };
    return t.status === 'todo' ? { ...t, scheduled_start: null, scheduled_end: null } : t;
  });
  await saveTasks(next);
  await rescheduleAll();
  return next;
}

// Planned time slot is over but the task is not done
export const isMissed = (t: Task, now = Date.now()) => t.status === 'todo' && !!t.scheduled_end && new Date(t.scheduled_end).getTime() < now;

// "Moved Java review to 8:00 PM", comparing tasks before and after a re-plan
export function describeMoves(before: Task[], after: Task[]) {
  return before.flatMap((old) => {
    const t = after.find((a) => a.id === old.id);
    if (!t || t.status !== 'todo') return [];
    if (t.scheduled_start && t.scheduled_start !== old.scheduled_start) return [`Moved ${t.title} to ${fmtTime(t.scheduled_start)}`];
    if (!t.scheduled_start && old.scheduled_start) return [`${t.title} didn't fit today`];
    return [];
  });
}

// Clears the time slot, and pushes a deadline that is today or already past to tomorrow (same time of day)
export async function moveToTomorrow(ids: string[]) {
  const tasks = await getTasks();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const next = tasks.map((t) => {
    if (!ids.includes(t.id)) return t;
    let due_at = t.due_at;
    if (due_at && new Date(due_at) <= endOfDay()) {
      const d = new Date(due_at);
      due_at = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), d.getHours(), d.getMinutes()).toISOString();
    }
    return { ...t, due_at, scheduled_start: null, scheduled_end: null };
  });
  await saveTasks(next);
  await rescheduleAll();
  return next;
}

// Kasama changes your tasks when you ask in chat. Returns what it did, in plain words.
export async function applyChatResult(r: ChatResult) {
  let tasks = await getTasks();
  const changes: string[] = [];
  const find = (id: string | null) => tasks.find((t) => t.id === id && t.status === 'todo');
  const now = new Date().toISOString();

  for (const a of r.actions) {
    const t = find(a.task_id);
    if (a.type === 'add' && a.task?.title) {
      tasks = [...tasks, { ...a.task, repeat: a.task.repeat ?? null, id: newId(), status: 'todo', scheduled_start: null, scheduled_end: null, created_at: now, done_at: null }];
      changes.push(`Added ${a.task.title}${a.task.due_at ? ` (due ${fmtDue(a.task.due_at)})` : ''}`);
    } else if (a.type === 'done' && t) {
      tasks = toggleTaskIn(tasks, t);
      changes.push(`Marked ${t.title} done`);
    } else if (a.type === 'drop' && t) {
      tasks = tasks.map((x) => (x.id === t.id ? { ...x, status: 'dropped' } : x));
      changes.push(`Dropped ${t.title}`);
    } else if (a.type === 'move' && t && a.due_at && !isNaN(Date.parse(a.due_at))) {
      tasks = tasks.map((x) => (x.id === t.id ? { ...x, due_at: a.due_at, scheduled_start: null, scheduled_end: null } : x));
      changes.push(`Moved ${t.title} to ${fmtDue(a.due_at)}`);
    }
  }
  if (changes.length) {
    await saveTasks(tasks);
    await rescheduleAll();
  }
  if (r.ideas.length) {
    await addIdeas(r.ideas, 'chat');
    changes.push(`Saved ${r.ideas.length} idea${r.ideas.length === 1 ? '' : 's'}`);
  }
  if (r.remember.length) {
    await remember(r.remember);
    changes.push(`I'll remember: ${r.remember.join('; ')}`);
  }
  return { tasks, changes };
}

// Same as toggleTask, but on a list in memory (used while applying several chat actions)
function toggleTaskIn(tasks: Task[], t: Task) {
  const now = new Date().toISOString();
  let next = tasks.map((x) => (x.id === t.id ? { ...x, status: 'done' as const, done_at: now } : x));
  if (t.repeat) next = [...next, { ...t, id: newId(), status: 'todo', due_at: nextDue(t.due_at, t.repeat), scheduled_start: null, scheduled_end: null, created_at: now, done_at: null, from_id: t.id }];
  return next;
}

export async function makeTaskFromIdea(text: string) {
  return addTasks([{ title: text, notes: null, due_at: null, duration_min: 30, priority: 'medium', repeat: null }]);
}
