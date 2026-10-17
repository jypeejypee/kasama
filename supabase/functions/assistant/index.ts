// Kasama's tiny backend: a Supabase Edge Function (Deno) that calls Claude.
// The phone app sends your brain dump, task list or chat here; this function adds your secret
// Claude key and returns structured JSON. Your key never leaves Supabase.
//
// Deploy:  npx supabase functions deploy assistant --no-verify-jwt
// Secrets: npx supabase secrets set ANTHROPIC_API_KEY=... APP_SECRET=... CLAUDE_MODEL=...

import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0';

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-5-5';
// These models can hand a declined request to a fallback model inside the same call
const FALLBACK_MODELS = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1'];

type FixedBlock = { label: string; days: number[]; start: string; end: string };
type Settings = { fixedBlocks: FixedBlock[]; aboutMe?: string };
type Effort = 'low' | 'medium' | 'high';

const PERSONA =
  'You are Kasama, a calm, practical personal assistant and companion for Jaypee, who works full time in customer support, ' +
  'studies Java on Saturdays and is job hunting as a junior developer. He may write in English or Taglish. ' +
  'Be brief, warm and concrete. Never invent commitments he did not mention.';

const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const scheduleText = (s: Settings) => (s?.fixedBlocks ?? []).map((b) => `- ${b.label}: ${b.days.map((d) => NAMES[d]).join(', ')} ${b.start}-${b.end}`).join('\n');
const aboutText = (s: Settings) => (s?.aboutMe?.trim() ? `\n\nWhat he told you about himself (follow it):\n${s.aboutMe.trim().slice(0, 4000)}` : '');

// Structured outputs: Claude's reply is guaranteed to match the JSON schema
async function askForJson<T>(prompt: string, schema: Record<string, unknown>, opts: { effort: Effort; settings: Settings; history?: Anthropic.Beta.BetaMessageParam[] }): Promise<T> {
  const useFallback = FALLBACK_MODELS.includes(MODEL);
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: PERSONA + aboutText(opts.settings),
    output_config: { effort: opts.effort, format: { type: 'json_schema', schema } },
    messages: [...(opts.history ?? []), { role: 'user', content: prompt }],
    ...(useFallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
  });
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
  title: str,
  notes: nullable(str),
  due_at: { ...nullable(str), description: 'ISO 8601 with the given UTC offset, or null' },
  duration_min: { type: 'integer', description: 'Minutes, 5 to 480' },
  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
  repeat: { ...nullable({ type: 'string', enum: ['daily', 'weekly', 'monthly'] }), description: 'Only if he says it repeats, e.g. "every Saturday", "monthly bill"' },
});

function dump(body: { raw: string; now: string; offset: string; settings: Settings }) {
  return askForJson(
    `Now: ${body.now}\n\nFixed schedule:\n${scheduleText(body.settings)}\n\nBRAIN DUMP:\n${String(body.raw).slice(0, 8000)}\n\n` +
      'Summarize what is on his mind in 2-3 sentences (reply in English). Pull out every concrete task with a short verb-first title. ' +
      `Turn words like "tomorrow", "sat", "end of month" into real dates; write times as ISO 8601 with offset ${body.offset}. ` +
      'Estimate duration in minutes. Ideas, plans for someday, feelings and loose thoughts go in ideas (short, one per item), not tasks. ' +
      'In heads_up, warn about deadlines that clash with fixed blocks or look unrealistic.',
    obj({ summary: str, tasks: { type: 'array', items: TASK_SCHEMA }, ideas: strList, heads_up: strList }),
    { effort: 'medium', settings: body.settings },
  );
}

function plan(body: { tasks: unknown[]; now: string; offset: string; settings: Settings }) {
  return askForJson(
    `Now: ${body.now}\n\nFixed schedule (never overlap these):\n${scheduleText(body.settings)}\n\nOpen tasks:\n${JSON.stringify(body.tasks).slice(0, 12000)}\n\n` +
      'Plan the REST OF TODAY only, starting after now. Urgent and high-priority first, 10-minute breaks between long blocks, ' +
      `a lighter evening before sleep. Do not overfill. Times as ISO 8601 with offset ${body.offset}. ` +
      'Use the task id in task_id (null for breaks). message: 1-2 encouraging sentences.',
    obj({
      message: str,
      blocks: { type: 'array', items: obj({ task_id: nullable(str), title: str, start: str, end: str }) },
      not_today: strList,
    }),
    { effort: 'medium', settings: body.settings },
  );
}

type ChatTurn = { role: 'user' | 'assistant'; text: string };

function chat(body: { message: string; history: ChatTurn[]; tasks: unknown[]; now: string; offset: string; settings: Settings }) {
  // Earlier turns go in as plain text, so Kasama remembers what you just talked about
  const history: Anthropic.Beta.BetaMessageParam[] = (body.history ?? []).slice(-12).map((m) => ({ role: m.role, content: String(m.text).slice(0, 2000) }));
  while (history.length && history[0].role !== 'user') history.shift();
  return askForJson(
    `Now: ${body.now}\n\nFixed schedule:\n${scheduleText(body.settings)}\n\nHis open tasks (with ids):\n${JSON.stringify(body.tasks).slice(0, 12000)}\n\n` +
      `HE SAYS:\n${String(body.message).slice(0, 4000)}\n\n` +
      'Reply like a caring personal assistant, in the same language mix he uses (English or Taglish), in 1-4 short sentences. ' +
      'If he asks you to change his tasks, do it with actions instead of only talking about it: ' +
      'add (fill task), done / drop (task_id from the list), move (task_id plus the new due_at). Leave unused fields null. ' +
      `Write dates as ISO 8601 with offset ${body.offset}. Only touch tasks he clearly meant. ` +
      'Put ideas he wants to keep for later in ideas. Put lasting facts or preferences about himself in remember (short, only new ones).',
    obj({
      reply: str,
      actions: {
        type: 'array',
        items: obj({ type: { type: 'string', enum: ['add', 'done', 'drop', 'move'] }, task_id: nullable(str), task: nullable(TASK_SCHEMA), due_at: nullable(str) }),
      },
      ideas: strList,
      remember: strList,
    }),
    { effort: 'low', settings: body.settings, history },
  );
}

Deno.serve(async (req) => {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (req.headers.get('x-app-secret') !== Deno.env.get('APP_SECRET')) return json({ error: 'Wrong app secret' }, 401);

  try {
    const body = await req.json();
    if (body.action === 'dump') return json(await dump(body));
    if (body.action === 'plan') return json(await plan(body));
    if (body.action === 'chat') return json(await chat(body));
    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    if (e instanceof Anthropic.APIError) return json({ error: `Claude error ${e.status}: ${e.message}` }, 502);
    return json({ error: (e as Error).message }, 500);
  }
});
