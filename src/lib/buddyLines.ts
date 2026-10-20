// What the buddy on Home says. Each day gets its own handful, picked from these by the date,
// so today's lines are different from yesterday's, plus one for the time of day.

const ANYTIME = [
  "Kaya mo 'yan, isa-isa lang.",
  'Ang galing mo today, kahit maliit lang.',
  'Pahinga ka rin, ha?',
  'One small step is still a step.',
  "Proud ako sa'yo.",
  'Hindi mo kailangang tapusin lahat ngayon.',
  'Inom ka muna ng tubig.',
  'Dahan-dahan lang, nandito lang ako.',
  'You showed up today. That counts.',
  'Laban lang, pero huwag kalimutang huminga.',
  'Okay lang mapagod. Hindi ibig sabihin sumuko ka na.',
  'Isang bagay lang muna. Yung iba, mamaya na.',
  'Hindi ka nag-iisa dito.',
  'Small progress is still progress.',
  'Ang dami mong nadadala. Ingat ka sa sarili mo.',
  "You don't have to be perfect. Just keep going.",
  'Huminga ka muna. In, out. Ayan.',
  'Mas mabait ka sa iba kaysa sa sarili mo. Bawi ka naman.',
  'Ang layo na ng narating mo, alam mo ba yun?',
  'Hindi lahat ng araw ay productive, at okay lang yun.',
  'Stretch ka muna sandali.',
  "Kaya mo 'to. Nagawa mo na nga yung mas mahirap dati.",
  'Rest is part of the work.',
  'Kumain ka na ba?',
  'Ikaw lang ang kalaban mo, at ang galing mo na.',
  'Wag mong kalimutang ngumiti kahit konti.',
  'Hindi mo kailangang magmadali.',
  'Every task you finish is a small win.',
  'Ang importante, sinusubukan mo.',
  'Bawat araw, bagong simula.',
  "Your worth isn't your to-do list.",
  'Pwede kang magpahinga nang walang guilt.',
  "Unti-unti, matatapos din 'yan.",
  'Salamat at nandito ka pa rin.',
  "Ang lakas mo, kahit di mo ramdam ngayon.",
  'Tapos na yung kahapon. Ngayon lang muna.',
  'Mabuti kang tao. Tandaan mo yan.',
  'Galing mo mag-adjust. Hindi madali yun.',
  'Isipin mo yung susunod na maliit na hakbang lang.',
  'Hug from me, kahit virtual lang.',
];
const MORNING = [
  'Magandang umaga! Isang hakbang lang muna today.',
  'Bagong araw, bagong chance.',
  'Kape muna bago lahat.',
  "Good morning! Hindi mo kailangang gawin lahat ngayong umaga.",
  'Ang aga mo! Galing.',
];
const AFTERNOON = [
  'Kalahati na ng araw. Kumusta ka?',
  'Merienda break muna?',
  'Afternoon slump? Tubig at konting lakad.',
  'Kaya mo pa. Konting tiis na lang.',
];
const EVENING = [
  'Ang dami mong ginawa today. Pahinga na.',
  'Tapos na ang trabaho. Ikaw naman muna.',
  'Proud ako sa lahat ng nagawa mo ngayong araw.',
  'Kahit hindi natapos lahat, sapat na.',
];
const NIGHT = [
  "Gabi na. Bukas na lang ulit, ha?",
  'Matulog ka na, deserve mo ang pahinga.',
  'Ilagay mo muna ang phone. Bukas ulit tayo.',
  'Good night. Ang galing mo today.',
];

// One line just for the day itself: sweldo day, Lunes, Biyernes, the weekend
function special(d: Date) {
  const day = d.getDay();
  const date = d.getDate();
  if (date === 15 || date === 30) return 'Sweldo day! Treat mo sarili mo kahit konti.';
  if (day === 1) return "Lunes na naman. Kaya natin 'to, dahan-dahan.";
  if (day === 3) return 'Hump day! Kalahati na ng linggo.';
  if (day === 5) return 'Biyernes na! Konting push na lang.';
  if (day === 6) return 'Sabado! Pahinga ka rin, ha?';
  if (day === 0) return 'Linggo. Pahinga at saya muna.';
  return null;
}

// The same date always gives the same shuffle, so the lines change each day, not each tap
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function todaysLines(now = new Date()) {
  const h = now.getHours();
  const timely = h < 11 ? MORNING : h < 17 ? AFTERNOON : h < 21 ? EVENING : NIGHT;
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 864e5);
  const rand = seeded(now.getFullYear() * 1000 + dayOfYear);
  const pool = ANYTIME.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const today = [...pool.slice(0, 7), timely[Math.floor(rand() * timely.length)]];
  const s = special(now);
  return s ? [s, ...today] : today;
}
