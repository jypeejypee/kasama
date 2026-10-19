import { addIdeas, getTasks, newId, remember, saveTasks, updateTask } from './storage';
import { rescheduleAll } from './notifications';
import { setAlarms } from './alarm';
import { endOfDay, fmtDue, fmtTime } from './time';
import type { ChatResult, DayPlan, Idea, ProposedTask, Repeat, Step, Task } from './types';

// Every change to tasks goes through here, so reminders always match your list.
// Reminders are redone in the background: the screen never waits for them.

// One change to the list at a time. Each change reads the saved list, edits it and saves it,
// so two at once (quick taps on two tasks) would save over each other and bring a task back.
let line: Promise<unknown> = Promise.resolve();
function oneAtATime<A extends unknown[], R>(change: (...args: A) => Promise<R>) {
  return (...args: A): Promise<R> => {
    const run = line.then(() => change(...args));
    line = run.catch(() => {});
    return run;
  };
}

const toggling = new Set<string>();

export async function toggleTask(shown: Task) {
  if (toggling.has(shown.id)) return getTasks();
  toggling.add(shown.id);
  try {
    return await toggleNow(shown);
  } finally {
    toggling.delete(shown.id);
  }
}

// The screen's copy may be old (a quick double tap), so use the saved one
const toggleNow = oneAtATime(async (shown: Task) => toggleSaved((await getTasks()).find((x) => x.id === shown.id) ?? shown));

async function toggleSaved(t: Task) {
  const done = t.status !== 'done';
  let next = await updateTask(t.id, { status: done ? 'done' : 'todo', done_at: done ? new Date().toISOString() : null });
  if (t.repeat && done) {
    // A repeating task comes back: finishing this one creates the next one
    next = [...next, { ...t, id: newId(), status: 'todo', due_at: nextDue(t.due_at, t.repeat), scheduled_start: null, scheduled_end: null, created_at: new Date().toISOString(), done_at: null, from_id: t.id, steps: t.steps?.map((s) => ({ ...s, done: false })) }];
    await saveTasks(next);
  } else if (t.repeat && !done) {
    // Un-ticked by mistake: remove the next one it created
    next = next.filter((x) => !(x.from_id === t.id && x.status === 'todo'));
    await saveTasks(next);
  }
  void rescheduleAll();
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

async function dropTaskNow(t: Task) {
  const next = await updateTask(t.id, { status: 'dropped' });
  void rescheduleAll();
  return next;
}

// "sweep", "mop" from Kasama → steps you can tick off (blank ones dropped)
const toSteps = (texts: string[] | undefined): Step[] => (texts ?? []).map((t) => t.trim()).filter(Boolean).map((text) => ({ id: newId(), text, done: false }));

// A task Kasama suggested, ready to save
function fromProposed({ steps, ...p }: ProposedTask, now: string): Task {
  const s = toSteps(steps);
  return { ...p, repeat: p.repeat ?? null, id: newId(), status: 'todo', scheduled_start: null, scheduled_end: null, created_at: now, done_at: null, ...(s.length ? { steps: s } : {}) };
}

async function addTasksNow(items: ProposedTask[]) {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const added = items.map((p) => fromProposed(p, now));
  const next = [...tasks, ...added];
  await saveTasks(next);
  void rescheduleAll();
  return next;
}

// A new plan replaces the old one: open tasks left out of it lose their old time slot,
// so a missed slot never lingers on the Today screen.
async function applyPlanNow(plan: DayPlan) {
  const tasks = await getTasks();
  const slots = new Map(plan.blocks.filter((b) => b.task_id).map((b) => [b.task_id as string, b]));
  const next = tasks.map((t) => {
    const b = slots.get(t.id);
    if (b) return { ...t, scheduled_start: b.start, scheduled_end: b.end };
    return t.status === 'todo' ? { ...t, scheduled_start: null, scheduled_end: null } : t;
  });
  await saveTasks(next);
  void rescheduleAll();
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
async function moveToTomorrowNow(ids: string[]) {
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
  void rescheduleAll();
  return next;
}

// ", with 3 steps" after "Added Clean house", so the steps aren't a surprise
export const stepsNote = (steps: string[] | undefined) => { const n = toSteps(steps).length; return n ? `, with ${n} step${n === 1 ? '' : 's'}` : ''; };

// Kasama changes your tasks when you ask in chat. Returns what it did, in plain words.
async function applyChatResultNow(r: ChatResult) {
  let tasks = await getTasks();
  const changes: string[] = [];
  const find = (id: string | null) => tasks.find((t) => t.id === id && t.status === 'todo');
  const now = new Date().toISOString();

  for (const a of r.actions) {
    const t = find(a.task_id);
    if (a.type === 'add' && a.task?.title) {
      tasks = [...tasks, fromProposed(a.task, now)];
      changes.push(`Added ${a.task.title}${a.task.due_at ? ` (due ${fmtDue(a.task.due_at)})` : ''}${stepsNote(a.task.steps)}`);
    } else if (a.type === 'done' && t) {
      tasks = toggleTaskIn(tasks, t);
      changes.push(`Marked ${t.title} done`);
    } else if (a.type === 'drop' && t) {
      tasks = tasks.map((x) => (x.id === t.id ? { ...x, status: 'dropped' } : x));
      changes.push(`Dropped ${t.title}`);
    } else if (a.type === 'move' && t && a.due_at && !isNaN(Date.parse(a.due_at))) {
      tasks = tasks.map((x) => (x.id === t.id ? { ...x, due_at: a.due_at, scheduled_start: null, scheduled_end: null } : x));
      changes.push(`Moved ${t.title} to ${fmtDue(a.due_at)}`);
    } else if (a.type === 'steps' && t && toSteps(a.steps).length) {
      const added = toSteps(a.steps);
      tasks = tasks.map((x) => (x.id === t.id ? { ...x, steps: [...(x.steps ?? []), ...added] } : x));
      changes.push(`Added ${added.length} step${added.length === 1 ? '' : 's'} to ${t.title}`);
    }
  }
  if (changes.length) {
    await saveTasks(tasks);
    void rescheduleAll();
  }
  if (r.ideas.length) {
    await addIdeas(r.ideas, 'chat');
    changes.push(`Saved ${r.ideas.length} idea${r.ideas.length === 1 ? '' : 's'}`);
  }
  if (r.remember.length) {
    await remember(r.remember);
    changes.push(`I'll remember: ${r.remember.join('; ')}`);
  }
  if (r.alarms?.length) changes.push(...(await setAlarms(r.alarms)));
  return { tasks, changes };
}

// Same as toggleTask, but on a list in memory (used while applying several chat actions)
function toggleTaskIn(tasks: Task[], t: Task) {
  const now = new Date().toISOString();
  let next = tasks.map((x) => (x.id === t.id ? { ...x, status: 'done' as const, done_at: now } : x));
  if (t.repeat) next = [...next, { ...t, id: newId(), status: 'todo', due_at: nextDue(t.due_at, t.repeat), scheduled_start: null, scheduled_end: null, created_at: now, done_at: null, from_id: t.id }];
  return next;
}

// The idea's notes and steps come along, so nothing you wrote is lost
export async function makeTaskFromIdea(idea: Idea) {
  const tasks = await addTasks([{ title: idea.text, notes: idea.notes ?? null, due_at: null, duration_min: 30, priority: 'medium', repeat: null }]);
  if (!idea.steps?.length) return tasks;
  return updateTaskSafely(tasks[tasks.length - 1].id, { steps: idea.steps }); // addTasks puts the new one last
}

// Change one task and keep reminders in step with it
async function updateTaskSafelyNow(id: string, patch: Partial<Task>) {
  const next = await updateTask(id, patch);
  void rescheduleAll();
  return next;
}

export const dropTask = oneAtATime(dropTaskNow);
export const addTasks = oneAtATime(addTasksNow);
export const applyPlan = oneAtATime(applyPlanNow);
export const moveToTomorrow = oneAtATime(moveToTomorrowNow);
export const applyChatResult = oneAtATime(applyChatResultNow);
export const updateTaskSafely = oneAtATime(updateTaskSafelyNow);
