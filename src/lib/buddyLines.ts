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

// Faith, for those who chose it in You. Kasama is a resting place: these are calm invitations and comfort,
// never guilt or pressure. Verses are quoted exactly (NKJV) with their reference.
// Only Christian and Spiritual get faith lines; Other and None keep the everyday words.
type FaithKind = 'christian' | 'spiritual';
const FAITH_LINES: Record<FaithKind, { lines: string[]; morning: string; night: string; tired: string }> = {
  christian: {
    lines: [
      'Pray tayo saglit? Kahit isang minuto lang.',
      "Ipagdasal natin 'tong araw mo.",
      'Hindi ka nag-iisa. Kasama mo Siya.',
      'Salamat, Lord, sa bagong araw.',
      'Ipahinga mo muna kay Lord ang bigat.',
      'Kahit pagod, may biyaya pa rin ngayong araw.',
      '"Be still, and know that I am God." (Psalm 46:10)',
      '"I can do all things through Christ who strengthens me." (Philippians 4:13)',
      '"Casting all your care upon Him, for He cares for you." (1 Peter 5:7)',
      '"The Lord is my shepherd; I shall not want." (Psalm 23:1)',
      '"This is the day the Lord has made; we will rejoice and be glad in it." (Psalm 118:24)',
    ],
    morning: 'Devotion muna tayo bago magsimula?',
    night: 'Ipagdasal natin ang bukas. Pahinga ka na.',
    tired: '"Come to Me, all you who labor and are heavy laden, and I will give you rest." (Matthew 11:28)',
  },
  spiritual: {
    lines: [
      'Huminga muna. Ano ang ipinagpapasalamat mo ngayon?',
      'Sandaling katahimikan bago ang lahat.',
      'Isang malalim na hininga. Nandito ka, sapat na yun.',
      'Pansinin mo ang isang magandang bagay ngayon.',
      'Dahan-dahan. Hindi kailangang magmadali ang puso.',
    ],
    morning: 'Magandang umaga. Isang sandali ng pasasalamat muna?',
    night: "Bitawan na natin ang araw na 'to. Pahinga na.",
    tired: 'Pagod ka kahapon. Dahan-dahan lang tayo ngayon.',
  },
};

// What shapes today's words: the faith they chose, how much of it ("a little" is about 1 in 3, "more" is half),
// and whether last night's check-in said "Pagod"
export type LineContext = { faith?: string; amount?: 'little' | 'more'; tiredYesterday?: boolean };

export function todaysLines(now = new Date(), ctx: LineContext = {}) {
  const h = now.getHours();
  const timely = h < 11 ? MORNING : h < 17 ? AFTERNOON : h < 21 ? EVENING : NIGHT;
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 864e5);
  const rand = seeded(now.getFullYear() * 1000 + dayOfYear);
  const shuffle = (list: string[]) => {
    const pool = list.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  };
  const today = [...shuffle(ANYTIME).slice(0, 7), timely[Math.floor(rand() * timely.length)]];
  const faith = ctx.faith && ctx.faith in FAITH_LINES ? FAITH_LINES[ctx.faith as FaithKind] : null;
  const sunday = now.getDay() === 0 && ctx.faith === 'christian';
  const s = sunday ? 'Linggo. Simba o pahinga kasama Siya?' : special(now);
  if (!faith) return s ? [s, ...today] : today;

  // Faith woven in: every 3rd line (a little) or every 2nd (more), from today's own shuffle
  const everyday = ctx.amount === 'more' ? 1 : 2; // everyday lines before each faith line
  const quiet = shuffle(faith.lines);
  const mixed: string[] = [];
  today.forEach((line, i) => {
    mixed.push(line);
    if ((i + 1) % everyday === 0 && quiet.length) mixed.push(quiet.shift()!);
  });
  // The first words of the day: comfort after a tiring yesterday, an invitation in the morning, rest at night
  const opener = ctx.tiredYesterday && h < 11 ? faith.tired : h < 11 ? faith.morning : h >= 21 ? faith.night : null;
  return [...(opener ? [opener] : []), ...(s ? [s] : []), ...mixed];
}
