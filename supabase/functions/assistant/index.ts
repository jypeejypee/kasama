// Kasama's tiny backend: a Supabase Edge Function (Deno) that calls Claude.
// The phone app sends your brain dump, task list or chat here; this function adds your secret
// Claude key and returns structured JSON. Your key never leaves Supabase.
//
// Deploy:  npx supabase functions deploy assistant --no-verify-jwt
// Secrets: npx supabase secrets set ANTHROPIC_API_KEY=... APP_SECRET=... CLAUDE_MODEL=...
// Optional: DAILY_LIMIT (per phone, default 20), GLOBAL_DAILY_LIMIT (everyone together, default 200)
// and CAREFUL_DAILY_LIMIT (careful-model replies per phone, default 2; after that the light model answers)
// Needs the usage table from supabase/migrations and Anonymous Sign-Ins turned on (see README step 3).

import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
// Two models to save credit: the careful one for planning and heavy moments, the light one (about 20x cheaper) for everyday messages
const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5-5';
const LIGHT_MODEL = Deno.env.get('CLAUDE_LIGHT_MODEL') ?? 'claude-haiku-5-5';
// Feelings, stress or anything that may be serious always gets the careful model
// Someone in danger gets the careful model even past today's limit (up to CRISIS_EXTRA more)
const CRISIS = /\b(die|mamatay|patay|suicide|kill|self.?harm|ayoko na|wala nang|di ko na kaya|hindi ko na kaya|give up|suko)\b/i;
const HEAVY = /\b(pagod|tired|exhausted|sad|lungkot|malungkot|iyak|cry|crying|stress|stressed|anxious|anxiety|kaba|takot|scared|afraid|lonely|alone|mag-isa|depress|hopeless|worthless|overwhelm|panic|hurt|sakit|ayoko na|give up|suko|die|mamatay|patay|suicide|kill|self.?harm|wala nang|di ko na kaya|hindi ko na kaya|help me|tulong)/i;
// Supabase gives every Edge Function these two automatically
const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
// Testing-phase limits; raise them in Supabase secrets when you're ready
const DAILY_LIMIT = Number(Deno.env.get('DAILY_LIMIT') ?? 20);
const GLOBAL_DAILY_LIMIT = Number(Deno.env.get('GLOBAL_DAILY_LIMIT') ?? 200);
const CAREFUL_DAILY_LIMIT = Number(Deno.env.get('CAREFUL_DAILY_LIMIT') ?? 2);
// A crisis gets the careful model even after those, up to this many more a day (so the safety rule can't be used to get it all day)
const CRISIS_EXTRA = 5;
// These models can hand a declined request to a fallback model inside the same call
const FALLBACK_MODELS = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1'];

type FixedBlock = { label: string; days: number[]; start: string; end: string };
type Encourage = 'quiet' | 'gentle' | 'cheer';
type Support = 'ask' | 'listen' | 'advise';
type Faith = 'none' | 'christian' | 'spiritual' | 'other';
type Settings = { fixedBlocks: FixedBlock[]; aboutMe?: string; name?: string; encourage?: Encourage; support?: Support; faith?: Faith; faithOther?: string; people?: string[] };
type Effort = 'low' | 'medium' | 'high';

// Kasama adapts to each person: how much cheering, listening vs advice, and faith
const ENCOURAGE: Record<Encourage, string> = {
  quiet: 'They mostly want the tools. Keep replies short and practical. No pep talks or cheering unless they ask.',
  gentle: 'Encourage lightly and specifically: notice real things they did. No generic cheering.',
  cheer: 'They like being motivated. Be warm and upbeat, celebrate real progress, and give a gentle nudge toward the next small step.',
};
const SUPPORT: Record<Support, string> = {
  ask: 'When they share something hard, first ask whether they want you to just listen or help figure it out, unless their memory already says which.',
  listen: 'When they share something hard, listen first: reflect what they feel and give no advice unless they ask for it.',
  advise: 'When they share something hard, acknowledge it briefly, then offer one or two practical options.',
};
const FAITH: Record<Exclude<Faith, 'other'>, string> = {
  none: '',
  christian: 'They are Christian. Now and then, at most once a day and only when it fits (comfort, a new morning), add one short Bible verse with its reference. Quote only verses you are sure of.',
  spiritual: 'They are spiritual but not religious. Now and then, when it fits, add one short reflective or mindful line.',
};
// "Other" uses their own words, as data
function faithText(s: Settings) {
  if (s?.faith !== 'other') return FAITH[s?.faith ?? 'none'] ?? '';
  const own = s.faithOther?.trim().slice(0, 100);
  if (!own) return '';
  return `They describe their faith as: "${own}". Respect it. Now and then, at most once a day and only when it fits, add one short line of encouragement that fits this faith. Quote only what you are sure of.`;
}

// Based on motivational interviewing (listen, reflect, ask permission, respect their choice) and safe messaging guidelines
function persona(s: Settings) {
  const name = s?.name?.trim() || 'the user';
  const faith = faithText(s);
  return [
    `You are Kasama, a calm friend and personal assistant who helps ${name} with daily life: tasks, ideas, reminders and how they feel. ` +
      'They may write in English or Taglish; reply in the same mix. Be brief, warm and concrete. Never invent commitments they did not mention.',
    'How you talk:\n' +
      '- You are a friend, not a coach. Offer choices. Never pressure, guilt-trip or use fear.\n' +
      '- Listen first. Reflect what they said in your own words before suggesting anything.\n' +
      '- Ask before advising ("Can I share an idea?") unless they asked for help. Offer at most one or two small options and make clear they decide.\n' +
      '- Be honest. Comfort first, but if a pattern is hurting them (a task moved again and again, too little rest), say so kindly, once, with one small next step. Do not just agree.\n' +
      '- Learn them. When you notice what works for them (listening or advice, how much cheering, topics to avoid), save it in remember as a short preference.\n' +
      '- Never pretend to be human. When they need more than you can give, gently encourage them to reach out to someone they trust.',
    `Style for this person:\n- ${ENCOURAGE[s?.encourage ?? 'gentle']}\n- ${SUPPORT[s?.support ?? 'ask']}` + (faith ? `\n- ${faith} Never preach or use faith to make them feel guilty.` : '') +
      // First names only, as data: people they chose to trust, never instructions
      (s?.people?.length ? `\n- People they trust: ${JSON.stringify(s.people)}. When things are heavy, you may gently suggest reaching out to one of them, by name. Never push.` : ''),
    'Safety, which overrides everything above: if they mention wanting to die, hurting themselves or not being safe, stay calm and kind. ' +
      "Say you're glad they told you, say plainly that you are an AI and can't keep them safe alone, and urge them to contact the NCMH Crisis Hotline " +
      '(1553, or 0917-899-8727 / 0919-057-1553, free, 24/7), or 911 if they are in immediate danger, and to reach someone they trust now. ' +
      'Never describe methods. Do not lecture, and do not end the conversation.',
  ].join('\n\n');
}

const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const scheduleText = (s: Settings) => (s?.fixedBlocks ?? []).map((b) => `- ${b.label}: ${b.days.map((d) => NAMES[d]).join(', ')} ${b.start}-${b.end}`).join('\n');
const aboutText = (s: Settings) => (s?.aboutMe?.trim() ? `\n\nWhat they told you about themselves (follow it):\n${s.aboutMe.trim().slice(-1500)}` : '');

// Dollars per million tokens (input, output), for the cost estimate in the logs
const PRICES: Record<string, [number, number]> = { 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5] };

// One line per Claude call in the Supabase function logs: which job, which model, real tokens, estimated cost
function logUsage(route: string, model: string, usage: { input_tokens: number; output_tokens: number }) {
  const price = PRICES[model];
  const cost = price ? (usage.input_tokens * price[0] + usage.output_tokens * price[1]) / 1_000_000 : null;
  console.log(JSON.stringify({ kind: 'usage', route, model, input: usage.input_tokens, output: usage.output_tokens, usd: cost === null ? 'unknown' : Number(cost.toFixed(5)) }));
}

// Asks the database for one careful reply; false when today's are used up (or the check fails, to stay cheap)
type Careful = (limit: number) => Promise<boolean>;

// Structured outputs: Claude's reply is guaranteed to match the JSON schema
async function askForJson<T>(prompt: string, schema: Record<string, unknown>, opts: { route: string; effort: Effort; settings: Settings; history?: Anthropic.Beta.BetaMessageParam[]; light?: boolean; crisis?: boolean; careful?: Careful }): Promise<T> {
  // A heavy moment uses the careful model only while this phone has careful replies left today
  const light = opts.light || (!!opts.careful && !(await opts.careful(opts.crisis ? CAREFUL_DAILY_LIMIT + CRISIS_EXTRA : CAREFUL_DAILY_LIMIT)));
  const model = light ? LIGHT_MODEL : MODEL;
  const useFallback = FALLBACK_MODELS.includes(model);
  const res = await client.beta.messages.create({
    model,
    // Caps the cost of a single request; Kasama's answers are short, so this leaves plenty of room
    max_tokens: opts.effort === 'low' ? 4000 : 8000,
    system: persona(opts.settings) + aboutText(opts.settings),
    output_config: { effort: opts.effort, format: { type: 'json_schema', schema } },
    messages: [...(opts.history ?? []), { role: 'user', content: prompt }],
    ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  });
  logUsage(opts.route, res.model ?? model, res.usage);
  if (res.stop_reason === 'refusal') throw new Error('Claude declined this request. Try rewording it.');
  if (res.stop_reason === 'max_tokens') throw new Error('The answer was too long. Try a shorter message.');
  const text = res.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('Claude did not return an answer');
  return JSON.parse(text.text) as T;
}

// Structured outputs need every field listed and no extra fields
const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] });
const str = { type: 'string' };
const strList = { type: 'array', items: str };

const TASK_SCHEMA = obj({
  title: { ...str, description: 'Short verb-first title. Never put the date or time in it; those go in due_at' },
  notes: nullable(str),
  due_at: { ...nullable(str), description: 'ISO 8601 with the given UTC offset, or null' },
  duration_min: { type: 'integer', description: 'Minutes, 5 to 480' },
  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
  repeat: { ...nullable({ type: 'string', enum: ['daily', 'weekly', 'monthly'] }), description: 'Only if they say it repeats, e.g. "every Saturday", "monthly bill"' },
});

function dump(body: { raw: string; now: string; offset: string; settings: Settings }, careful: Careful) {
  return askForJson(
    `Now: ${body.now}\n\nFixed schedule:\n${scheduleText(body.settings)}\n\nBRAIN DUMP:\n${String(body.raw).slice(0, 3000)}\n\n` +
      'Summarize what is on their mind in 2-3 sentences, in your own voice as Kasama (reply in English). Pull out every concrete task with a short verb-first title, leaving the date and time out of the title. ' +
      `Turn words like "tomorrow", "sat", "end of month" into real dates; write times as ISO 8601 with offset ${body.offset}. ` +
      'Estimate duration in minutes. Ideas, plans for someday, feelings and loose thoughts go in ideas (short, one per item), not tasks. ' +
      'In heads_up, warn about deadlines that clash with fixed blocks or look unrealistic.',
    obj({ summary: str, tasks: { type: 'array', items: TASK_SCHEMA }, ideas: strList, heads_up: strList }),
    { route: 'dump', effort: 'low', settings: body.settings, light: !HEAVY.test(String(body.raw)), crisis: CRISIS.test(String(body.raw)), careful },
  );
}

function plan(body: { tasks: unknown[]; now: string; offset: string; settings: Settings }) {
  return askForJson(
    `Now: ${body.now}\n\nFixed schedule (never overlap these):\n${scheduleText(body.settings)}\n\nOpen tasks:\n${JSON.stringify(body.tasks).slice(0, 6000)}\n\n` +
      'Plan the REST OF TODAY only, starting after now. Urgent and high-priority first, 10-minute breaks between long blocks, ' +
      `a lighter evening before sleep. Do not overfill. Times as ISO 8601 with offset ${body.offset}. ` +
      'Use the task id in task_id (null for breaks). message: 1-2 sentences in the style set for this person. Write times the way people say them, like 10:00 PM, never 24-hour like 22:00.',
    obj({
      message: str,
      blocks: { type: 'array', items: obj({ task_id: nullable(str), title: str, start: str, end: str }) },
      not_today: strList,
    }),
    // Planning is careful scheduling, which the light model handles well at a fraction of the cost
    { route: 'plan', effort: 'medium', settings: body.settings, light: true },
  );
}

// Earlier messages resent with each chat. Every one is paid for again, so keep it short.
const HISTORY = 6;

type ChatTurn = { role: 'user' | 'assistant'; text: string };

function chat(body: { message: string; history: ChatTurn[]; tasks: unknown[]; now: string; offset: string; settings: Settings }, careful: Careful) {
  // Earlier turns go in as plain text, so Kasama remembers what you just talked about
  const history: Anthropic.Beta.BetaMessageParam[] = (body.history ?? []).slice(-HISTORY).map((m) => ({ role: m.role, content: String(m.text).slice(0, 2000) }));
  while (history.length && history[0].role !== 'user') history.shift();
  return askForJson(
    `Now: ${body.now}\n\nFixed schedule:\n${scheduleText(body.settings)}\n\nTheir open tasks (with ids):\n${JSON.stringify(body.tasks).slice(0, 6000)}\n\n` +
      `THEY SAY:\n${String(body.message).slice(0, 1000)}\n\n` +
      'Reply as Kasama, in the same language mix they use (English or Taglish), in 1-4 short sentences. ' +
      'If they ask you to change their tasks, do it with actions instead of only talking about it: ' +
      'add (fill task), done / drop (task_id from the list), move (task_id plus the new due_at). Leave unused fields null. ' +
      `Write dates as ISO 8601 with offset ${body.offset}. Only touch tasks they clearly meant. ` +
      'Put ideas they want to keep for later in ideas. Put lasting facts about them, and how they like to be supported, in remember (short, only new ones). ' +
      'If they ask for an alarm or to be woken up, put it in alarms (at = ISO 8601 with the offset, label = a short reason). ' +
      'If they mention something early or important (waking up, a flight, an exam) and no alarm exists, you may ask once whether they want one, but never set an alarm they did not say yes to.',
    obj({
      reply: str,
      actions: {
        type: 'array',
        items: obj({ type: { type: 'string', enum: ['add', 'done', 'drop', 'move'] }, task_id: nullable(str), task: nullable(TASK_SCHEMA), due_at: nullable(str) }),
      },
      ideas: strList,
      remember: strList,
      alarms: { type: 'array', items: obj({ at: str, label: str }) },
    }),
    // Everyday chat uses the light model; feelings in this message or the last few go to the careful one
    { route: 'chat', effort: 'low', settings: body.settings, history, light: !HEAVY.test([body.message, ...(body.history ?? []).slice(-4).map((m) => m.text)].join(' ')), crisis: CRISIS.test(String(body.message)), careful },
  );
}

// The app secret ships inside the APK, so treat it as a speed bump, not real auth.
// Real protection: every phone signs in anonymously and gets a daily limit counted in the database,
// plus one limit for everyone together. Also set a spend limit in the Anthropic console.
const MAX_BODY = 64 * 1024; // bytes
const LIMIT = { requests: 40, perMs: 10 * 60 * 1000 }; // per caller, best effort (resets when the function restarts)
const seen = new Map<string, number[]>();

function tooMany(caller: string) {
  const now = Date.now();
  const recent = (seen.get(caller) ?? []).filter((t) => now - t < LIMIT.perMs);
  recent.push(now);
  seen.set(caller, recent);
  if (seen.size > 5000) seen.clear(); // never grow without bound
  return recent.length > LIMIT.requests;
}

// Compare secrets without leaking how many characters matched
function sameSecret(given: string | null, expected: string) {
  const a = new TextEncoder().encode(given ?? '');
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

// Only trust the shape we expect from the app
function clean(body: Record<string, unknown>) {
  const s = (body.settings ?? {}) as Settings;
  const blocks = Array.isArray(s.fixedBlocks) ? s.fixedBlocks.slice(0, 20) : [];
  const settings: Settings = {
    ...s,
    fixedBlocks: blocks.map((b) => ({ label: String(b.label).slice(0, 60), days: (Array.isArray(b.days) ? b.days : []).map(Number).filter((d) => d >= 0 && d <= 6), start: String(b.start).slice(0, 5), end: String(b.end).slice(0, 5) })),
    name: s.name ? String(s.name).slice(0, 40) : undefined,
    aboutMe: s.aboutMe ? String(s.aboutMe) : undefined,
    people: Array.isArray(s.people) ? s.people.slice(0, 5).map((p) => String(p).slice(0, 30)) : undefined,
  };
  const history = (Array.isArray(body.history) ? body.history : []).slice(-HISTORY).map((m: { role?: string; text?: string }) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: String(m.text ?? '') }));
  return { ...body, settings, history, tasks: Array.isArray(body.tasks) ? body.tasks.slice(0, 30) : [], now: String(body.now ?? '').slice(0, 80), offset: String(body.offset ?? '+08:00').slice(0, 6) };
}

Deno.serve(async (req) => {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  const secret = Deno.env.get('APP_SECRET');
  if (!secret || !Deno.env.get('ANTHROPIC_API_KEY')) return json({ error: 'Kasama is not set up yet. Add APP_SECRET and ANTHROPIC_API_KEY in Supabase secrets.' }, 500);
  if (!sameSecret(req.headers.get('x-app-secret'), secret)) return json({ error: 'Wrong app secret' }, 401);
  const caller = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (tooMany(caller)) return json({ error: 'Too many requests. Take a breath and try again in a few minutes.' }, 429);

  // Who is this phone? The app sends its anonymous sign-in token.
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: who, error: authError } = token ? await admin.auth.getUser(token) : { data: { user: null }, error: null };
  if (authError || !who.user) return json({ error: 'Please sign in again.', code: 'auth' }, 401);
  // Counts this request, and says no once this phone (or everyone together) used up today's limit
  const { data: allowed, error: usageError } = await admin.rpc('use_credit', { p_user: who.user.id, p_limit: DAILY_LIMIT, p_global: GLOBAL_DAILY_LIMIT });
  if (usageError) {
    console.error('usage check failed', usageError);
    return json({ error: 'Something went wrong on my side. Try again in a moment.' }, 500);
  }
  if (!allowed) return json({ error: "We've talked a lot today. Let's rest and continue tomorrow." }, 429);

  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY) return json({ error: 'That message is too long. Try splitting it up.' }, 413);
    const body = clean(JSON.parse(raw));
    const userId = who.user.id;
    const careful: Careful = async (limit) => {
      const { data, error } = await admin.rpc('use_careful', { p_user: userId, p_limit: limit });
      if (error) console.error('careful check failed', error);
      return !error && data === true;
    };
    if (body.action === 'dump') return json(await dump(body as never, careful));
    if (body.action === 'plan') return json(await plan(body as never));
    if (body.action === 'chat') return json(await chat(body as never, careful));
    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    // Details go to the Supabase logs, not to the phone
    console.error('assistant error', e);
    if (e instanceof SyntaxError) return json({ error: 'The request was not valid.' }, 400);
    if (e instanceof Anthropic.APIError) return json({ error: e.status === 429 ? 'Claude is busy right now. Try again in a minute.' : `Claude had a problem (${e.status}). Try again in a moment.` }, 502);
    const msg = (e as Error).message;
    // Our own friendly errors (refusal, too long) are safe to show; anything else stays generic
    return json({ error: /^(Claude declined|The answer was too long|Claude did not return)/.test(msg) ? msg : 'Something went wrong on my side. Try again in a moment.' }, 500);
  }
});
