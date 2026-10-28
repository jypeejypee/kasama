import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H } from '@/components/ui';
import { useReduceMotion } from '@/components/Motion';
import { FONT, useColors } from '@/lib/theme';
import { getBuddy, getMoods, getSettings, saveBuddy } from '@/lib/storage';
import { todaysLines, type LineContext } from '@/lib/buddyLines';
import { dayKey } from '@/lib/time';
import type { BuddyPick, BuddyState, Settings } from '@/lib/types';

// A little friend on Home: Kape (a mug of coffee) or Puto (a rice cake). He hops in the corner and says something kind when you tap him.
// Drag him anywhere; drop him on Hide and he rests until you pick a buddy again in You.

type Face = 'look' | 'blink' | 'happy' | 'wink' | 'love' | 'squish' | 'cool' | 'sparkle' | 'shy' | 'curious' | 'whoa' | 'cry' | 'dizzy' | 'sleep';
const CUTE: Face[] = ['happy', 'wink', 'love', 'squish', 'cool', 'sparkle', 'shy', 'curious'];

const W = 80; // the touch area, easy to hit with a thumb
const H_BOX = 76;
const ART = 72; // drawing width
const ART_H = (ART * 100) / 112;
const SLEEP_AFTER = 20000;
const INK = '#2b1d22';
const LIP = '#3a242c';


function FaceArt({ face }: { face: Face }) {
  const w = { fill: 'none', stroke: INK, strokeWidth: 2.6, strokeLinecap: 'round' } as const;
  const m = { fill: 'none', stroke: LIP, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  const smile = <Path d="M44 59 q3 3.4 6 0 q3 3.4 6 0" {...m} />;
  const heart = (x: number, y: number) => `M${x} ${y} c-7 -4.5 -7 -11 -3 -11 c1.8 0 3 1.4 3 2.6 c0 -1.2 1.2 -2.6 3 -2.6 c4 0 4 6.5 -3 11 z`;
  const star = (x: number, y: number, r: number) => `M${x} ${y - r} l${r * 0.3} ${r * 0.7} l${r * 0.7} ${r * 0.3} l${-r * 0.7} ${r * 0.3} l${-r * 0.3} ${r * 0.7} l${-r * 0.3} ${-r * 0.7} l${-r * 0.7} ${-r * 0.3} l${r * 0.7} ${-r * 0.3} z`;
  const eyes = (
    <>
      <Ellipse cx={37} cy={51} rx={4.6} ry={5.8} fill={INK} />
      <Ellipse cx={63} cy={51} rx={4.6} ry={5.8} fill={INK} />
      <Circle cx={35.6} cy={48.6} r={1.8} fill="#ffffff" />
      <Circle cx={61.6} cy={48.6} r={1.8} fill="#ffffff" />
    </>
  );
  switch (face) {
    case 'look':
      return <G>{eyes}<Circle cx={38.6} cy={54} r={0.8} fill="#ffffff" /><Circle cx={64.6} cy={54} r={0.8} fill="#ffffff" />{smile}</G>;
    case 'blink':
      return <G><Path d="M32 52 h10 M58 52 h10" {...w} />{smile}</G>;
    case 'happy':
      return <G><Path d="M32 52 q5 -7 10 0 M58 52 q5 -7 10 0" {...w} /><Path d="M44 57 q6 8 12 0 z" fill="#c9416b" stroke={LIP} strokeWidth={1.5} /></G>;
    case 'wink':
      return (
        <G>
          <Ellipse cx={37} cy={51} rx={4.6} ry={5.8} fill={INK} /><Circle cx={35.6} cy={48.6} r={1.8} fill="#ffffff" />
          <Path d="M58 51 q5 -5 10 0" {...w} />
          <Path d="M43 58 q7 6 14 0" {...m} />
          <Path d="M51 61 q2.5 5 5 0" fill="#ff8fae" stroke={LIP} strokeWidth={1.2} />
        </G>
      );
    case 'love':
      return <G><Path d={heart(37, 56)} fill="#e8336b" /><Path d={heart(63, 56)} fill="#e8336b" /><Path d="M44 59 q6 6 12 0" {...m} /><Path d={heart(14, 14)} fill="#e8336b" /></G>;
    case 'squish':
      return <G><Path d="M32 47 l8 4 l-8 4 M68 47 l-8 4 l8 4" {...w} strokeLinejoin="round" />{smile}</G>;
    case 'cool':
      return (
        <G>
          <Path d="M27 45 h18 v6 q-9 6 -18 0 z M55 45 h18 v6 q-9 6 -18 0 z" fill="#1d1a1c" />
          <Path d="M45 46.5 h10" stroke="#1d1a1c" strokeWidth={2} />
          <Path d="M30 47 h4 M58 47 h4" stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
          <Path d="M45 60 q6 3 11 -2" {...m} />
        </G>
      );
    case 'sparkle':
      return (
        <G>
          <Ellipse cx={37} cy={51} rx={5.4} ry={6.4} fill={INK} /><Ellipse cx={63} cy={51} rx={5.4} ry={6.4} fill={INK} />
          <Path d={`${star(36, 50, 4)} ${star(62, 50, 4)}`} fill="#ffffff" />
          <Path d="M44 58 q6 7 12 0 z" fill="#c9416b" stroke={LIP} strokeWidth={1.5} />
          <Path d={`${star(16, 25, 5)} ${star(84, 26, 4)}`} fill="#f6c443" />
        </G>
      );
    case 'shy':
      return (
        <G>
          <Path d="M32 50 q5 4 10 0 M58 50 q5 4 10 0" {...w} strokeWidth={2.4} />
          <Path d="M17 56 l3 -4 M21 57 l3 -4 M25 58 l3 -4 M73 56 l3 -4 M77 57 l3 -4 M81 58 l3 -4" stroke="#d8476f" strokeWidth={1.4} strokeLinecap="round" />
          <Path d="M47 60 q3 2 6 0" {...m} />
        </G>
      );
    case 'curious':
      return (
        <G>
          <Ellipse cx={37} cy={52} rx={4.6} ry={5.8} fill={INK} /><Circle cx={35.6} cy={49.6} r={1.8} fill="#ffffff" />
          <Ellipse cx={63} cy={50} rx={4.2} ry={5.2} fill={INK} /><Circle cx={61.6} cy={47.8} r={1.6} fill="#ffffff" />
          <Path d="M46 61 q4 -2 8 0" {...m} />
          <SvgText x={80} y={20} fontSize={16} fontWeight="800" fill="#5f6b65">?</SvgText>
        </G>
      );
    case 'whoa':
      return (
        <G>
          <Circle cx={37} cy={50} r={5.6} fill={INK} /><Circle cx={63} cy={50} r={5.6} fill={INK} />
          <Circle cx={35.2} cy={47.6} r={2} fill="#ffffff" /><Circle cx={61.2} cy={47.6} r={2} fill="#ffffff" />
          <Ellipse cx={50} cy={61} rx={3} ry={3.6} fill="#c9416b" stroke={LIP} strokeWidth={1.4} />
          <Path d="M40 4 l2 6 M50 1 v7 M60 4 l-2 6" stroke="#5f6b65" strokeWidth={2} strokeLinecap="round" />
        </G>
      );
    case 'cry':
      return (
        <G>
          <Path d="M32 49 q5 5 10 0 M58 49 q5 5 10 0" {...w} strokeWidth={2.4} />
          <Path d="M34 54 q-1.6 5 0 8 q1.6 -3 0 -8 z M66 54 q-1.6 5 0 8 q1.6 -3 0 -8 z" fill="#7cc7ef" />
          <Path d="M43 63 q2 -3 4 0 q2 -3 3 0 q2 -3 3 0 q2 -3 4 0" {...m} strokeWidth={1.6} />
        </G>
      );
    case 'dizzy':
      return <G><Path d="M33 47 l8 8 M41 47 l-8 8 M59 47 l8 8 M67 47 l-8 8" {...w} strokeWidth={2.4} /><Path d="M43 61 q3.5 -3 7 0 q3.5 3 7 0" {...m} /></G>;
    case 'sleep':
      return (
        <G>
          <Path d="M32 52 q5 3 10 0 M58 52 q5 3 10 0" {...w} strokeWidth={2.4} />
          <Ellipse cx={50} cy={61} rx={2.4} ry={2} fill="#c9416b" />
          <SvgText x={70} y={14} fontSize={9} fontWeight="800" fill="#6d7872">z</SvgText>
          <SvgText x={78} y={8} fontSize={10} fontWeight="800" fill="#6d7872">z</SvgText>
          <SvgText x={86} y={2} fontSize={12} fontWeight="800" fill="#6d7872">Z</SvgText>
        </G>
      );
  }
}

function KapeBody() {
  return (
    <G>
      <Path d="M38 22 C34 16 42 12 38 6 M50 20 C46 13 54 9 50 2 M62 22 C58 16 66 12 62 6" fill="none" stroke="#c9b8a6" strokeWidth={2.2} strokeLinecap="round" opacity={0.75} />
      <Ellipse cx={50} cy={80} rx={44} ry={5.5} fill="#ffffff" stroke="#d6e0e6" strokeWidth={1.2} />
      <Path d="M84 40 C99 39 100 64 82 63" fill="none" stroke="#d9bf9c" strokeWidth={7.5} strokeLinecap="round" />
      <Path d="M84 40 C99 39 100 64 82 63" fill="none" stroke="#f7ebdc" strokeWidth={4} strokeLinecap="round" />
      <Path d="M13 33 C13 27 87 27 87 33 L83 70 C82 80 18 80 17 70 Z" fill="url(#mug)" stroke="#d9bf9c" strokeWidth={1.6} strokeLinejoin="round" />
      <Ellipse cx={50} cy={32} rx={35} ry={6} fill="#6b3f22" />
      <Ellipse cx={50} cy={31.5} rx={31} ry={4.4} fill="#8a5432" />
      <Path d="M50 35 c-4.5 -2.6 -4.5 -6.2 -1.8 -6.2 c1.1 0 1.8 0.8 1.8 1.5 c0 -0.7 0.7 -1.5 1.8 -1.5 c2.7 0 2.7 3.6 -1.8 6.2 z" fill="#e8c39a" />
      <Path d="M21 42 L23 64" stroke="#ffffff" strokeWidth={2.6} strokeLinecap="round" opacity={0.85} />
      <Path d="M16 46 Q50 51 84 46" fill="none" stroke="#c98d5a" strokeWidth={2} opacity={0.5} />
      <Ellipse cx={25} cy={59} rx={7} ry={4.2} fill="#ff8fa3" opacity={0.4} />
      <Ellipse cx={75} cy={59} rx={7} ry={4.2} fill="#ff8fa3" opacity={0.4} />
    </G>
  );
}

// Kape asleep: someone keeps pouring and he overflows, a little more every moment (stage 1 to 4)
function KapeOverflow({ stage }: { stage: number }) {
  const spill = { fill: 'none', stroke: '#7a4527', strokeLinecap: 'round' } as const;
  return (
    <G>
      {stage >= 4 && <Ellipse cx={50} cy={80.5} rx={38} ry={3.6} fill="#7a4527" opacity={0.85} />}
      {stage >= 1 && <Path d="M15 32 C15 25 85 25 85 32 C85 34 15 34 15 32 Z" fill="#7a4527" />}
      {stage >= 2 && <Path d="M17 32 C14 40 18 48 16 58" {...spill} strokeWidth={3.4} />}
      {stage >= 3 && <Path d="M83 32 C86 41 82 49 84 60" {...spill} strokeWidth={3.4} />}
      {stage >= 4 && <Path d="M34 33 C33 37 35 40 34 44 M70 33 C71 38 69 41 70 46" {...spill} strokeWidth={3} />}
      {stage >= 4 && <><Circle cx={16} cy={62} r={1.8} fill="#7a4527" /><Circle cx={84} cy={64} r={1.8} fill="#7a4527" /></>}
    </G>
  );
}

// The little coffee pot that floats in and keeps pouring while Kape sleeps
function CoffeePot() {
  return (
    <Svg width={62} height={96} viewBox="0 0 62 96">
      <Path d="M43 31 C46 44 47 70 48 92" fill="none" stroke="#7a4527" strokeWidth={3} strokeLinecap="round" strokeDasharray="5 4" />
      <Path d="M8 18 C0 18 0 32 9 32" fill="none" stroke="#3f7fb0" strokeWidth={3} strokeLinecap="round" />
      <Path d="M9 12 C9 6 33 6 33 12 L35 32 C35 37 7 37 7 32 Z" fill="#fff8ee" stroke="#3f7fb0" strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M8 15 H34" stroke="#3f7fb0" strokeWidth={2} />
      <Path d="M14 7 C14 3 28 3 28 7 Z" fill="#fff8ee" stroke="#3f7fb0" strokeWidth={1.4} />
      <Circle cx={21} cy={3} r={2} fill="#3f7fb0" />
      <Path d="M33 22 L44 27 L45 30.5 L34 29 Z" fill="#fff8ee" stroke="#3f7fb0" strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M14 20 V30" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PutoBody() {
  return (
    <G>
      <Path d="M13 47 C13 23 29 13 50 13 C71 13 87 23 87 47 C91 53 93 61 91 69 C89 77 73 80 50 80 C27 80 11 77 9 69 C7 61 9 53 13 47 Z" fill="url(#puto)" stroke="#dcc6a5" strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M11 61 Q50 70 89 61" fill="none" stroke="#e6d3b5" strokeWidth={1.4} />
      <Path d="M20 66 Q19 72 21 77 M32 68 Q31 74 32 79 M44 69 Q43 75 44 80 M56 69 Q57 75 56 80 M68 68 Q69 74 68 79 M80 66 Q81 72 79 77" fill="none" stroke="#ead9bd" strokeWidth={1.3} strokeLinecap="round" />
      <Ellipse cx={28} cy={31} rx={9} ry={4.5} fill="#ffffff" opacity={0.9} transform="rotate(-25 28 31)" />
      <Path d="M37 13 L61 8 L65 20 C61 21 59 25 58 22 C57 20 54 22 41 25 Z" fill="#ffd55a" stroke="#e9b73a" strokeWidth={1.2} strokeLinejoin="round" />
      <Path d="M44 15 L56 12.5" stroke="#fff1b8" strokeWidth={1.6} strokeLinecap="round" />
      <Ellipse cx={22} cy={58} rx={8} ry={5} fill="#ff8fa3" opacity={0.4} />
      <Ellipse cx={78} cy={58} rx={8} ry={5} fill="#ff8fa3" opacity={0.4} />
    </G>
  );
}

// Puto asleep: his cheese slowly melts down his head (stage 1 to 3)
function PutoMelt({ stage }: { stage: number }) {
  if (stage < 1) return null;
  return (
    <G>
      <Path d="M36 12.5 L61 7.5 L66 19.5 C65 23 63 29 61 29 C59 29 59.5 23.5 57.5 23.5 C55.5 23.5 55 33 51.5 33 C48 33 49.5 25.5 46.5 25.5 C44 25.5 43.5 29 41.5 29 C39.5 29 40.5 25 40.5 24 Z" fill="#ffd55a" stroke="#e9b73a" strokeWidth={1.2} strokeLinejoin="round" />
      {stage >= 2 && <Path d="M51.5 33 V42" stroke="#ffd55a" strokeWidth={3} strokeLinecap="round" />}
      {stage >= 3 && <Path d="M61 29 V36" stroke="#ffd55a" strokeWidth={2.6} strokeLinecap="round" />}
    </G>
  );
}

// The drawing alone: also used, smaller, for the choices in You. rest: how far into his nap (0 when awake).
export function BuddyArt({ who, face = 'look', size = ART, rest = 0 }: { who: Exclude<BuddyPick, 'none'>; face?: Face; size?: number; rest?: number }) {
  return (
    <Svg width={size} height={(size * 100) / 112} viewBox="-6 -18 112 100">
      <Defs>
        <RadialGradient id="mug" cx="0.4" cy="0.4" r="0.75">
          <Stop offset="0" stopColor="#fffaf3" />
          <Stop offset="0.7" stopColor="#f7ebdc" />
          <Stop offset="1" stopColor="#e9d6bd" />
        </RadialGradient>
        <RadialGradient id="puto" cx="0.42" cy="0.38" r="0.75">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.65" stopColor="#fbf4e8" />
          <Stop offset="1" stopColor="#eedfc6" />
        </RadialGradient>
      </Defs>
      {who === 'kape' ? <KapeBody /> : <PutoBody />}
      {who === 'kape' ? <KapeOverflow stage={rest} /> : <PutoMelt stage={rest} />}
      {/* The faces are drawn for a round face; on Kape's mug they sit a touch lower, below the coffee */}
      <G transform={who === 'kape' ? 'translate(0,2)' : undefined}><FaceArt face={face} /></G>
    </Svg>
  );
}

// Never chosen yet: Kape, unless they asked for "just the tools". Earlier test buddies (Poring, the Dino kid) become Kape.
export function pickFor(b: BuddyState | null, s: Settings): BuddyPick {
  if (!b) return s.encourage === 'quiet' ? 'none' : 'kape';
  return b.pick === 'puto' || b.pick === 'none' ? b.pick : 'kape';
}

// How each one dozes off and wakes up
const SLEEP_LINES = { kape: 'Zzz... isa pa pong kape...', puto: 'Zzz... natutunaw na yung keso ko...' };
const WAKE_LINES = { kape: "Hala, umapaw! Gising na 'ko!", puto: 'Ay, yung keso ko!' };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function Buddy() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [saved, setSaved] = useState<BuddyState | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [face, setFace] = useState<Face>('look');
  const [blink, setBlink] = useState(false);
  const [line, setLine] = useState('');
  const [held, setHeld] = useState(false);
  const [over, setOver] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const [resting, setResting] = useState(false);
  const [visit, setVisit] = useState(0); // goes up each time Home comes back into view
  const [restStage, setRestStage] = useState(0); // how far into his nap: Kape overflows, Puto's cheese melts
  const [partner, setPartner] = useState(false); // at merienda the other one peeks in

  // Where he stands (the drag moves this) and how he hops (scale and tilt for squash, stretch and wiggle)
  const [pos] = useState(() => new Animated.ValueXY());
  const [hopY] = useState(() => new Animated.Value(0));
  const [sx] = useState(() => new Animated.Value(1));
  const [sy] = useState(() => new Animated.Value(1));
  const [tilt] = useState(() => new Animated.Value(0));
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const timers = useRef<{ face?: ReturnType<typeof setTimeout>; line?: ReturnType<typeof setTimeout>; sleep?: ReturnType<typeof setTimeout>; rest?: ReturnType<typeof setTimeout>; partner?: ReturnType<typeof setTimeout> }>({});
  const lines = useRef({ list: todaysLines(), i: 0 });
  const context = useRef<LineContext>({}); // your faith choice and last night's check-in, read each time Home opens
  const taps = useRef<number[]>([]);
  const merienda = useRef(''); // the day the merienda moment last happened, so it's once a day
  const drag = useRef({ on: false, over: false, x: 0, y: 0, px: 0, py: 0 }); // px, py: where the finger went down

  // The floating tab bar sits at the bottom; he starts just above it, on the right
  const barTop = box.h - (Math.max(insets.bottom, 12) + 6 + 66);
  const trash = { x: box.w / 2, y: barTop - 52 };
  const home = { x: box.w - W - 14, y: barTop - H_BOX - 8 };
  const placeOf = (b: BuddyState | null) => ({
    x: clamp(b?.x ?? home.x, 0, Math.max(0, box.w - W)),
    y: clamp(b?.y ?? home.y, 0, Math.max(0, barTop - H_BOX)),
  });
  const spot = placeOf(saved);
  const who: 'kape' | 'puto' = saved?.pick === 'puto' ? 'puto' : 'kape';

  const to = (v: Animated.Value, value: number, ms: number) => Animated.timing(v, { toValue: value, duration: ms, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
  const step = (y: number, x: number, s: number, ms: number, r = 0) => Animated.parallel([to(hopY, y, ms), to(sx, x, ms), to(sy, s, ms), to(tilt, r, ms)]);
  const play = (a: Animated.CompositeAnimation, then?: () => void) => {
    anim.current?.stop();
    anim.current = a;
    a.start(({ finished }) => { if (finished && then) then(); });
  };
  const still = () => play(step(0, 1, 1, 150));
  const idle = () => {
    if (reduce) return still();
    play(Animated.loop(Animated.sequence([Animated.delay(2400), step(0, 1.12, 0.86, 200), step(-26, 0.94, 1.08, 300), step(-30, 1, 1, 140), step(0, 1.1, 0.88, 260), step(0, 0.97, 1.03, 140), step(0, 1, 1, 160)])));
  };
  const boing = () => {
    if (reduce) return;
    play(Animated.sequence([step(0, 1.2, 0.78, 120), step(-52, 0.9, 1.12, 220, -8), step(-56, 1, 1, 160, 8), step(0, 1.18, 0.8, 180), step(-14, 0.96, 1.05, 140), step(0, 1.08, 0.92, 120), step(0, 1, 1, 120)]), idle);
  };
  const breathe = () => {
    if (reduce) return still();
    play(Animated.loop(Animated.sequence([step(0, 1.04, 0.96, 1600), step(0, 1, 1, 1600)])));
  };
  const wobble = () => {
    if (reduce) return;
    play(Animated.sequence([step(0, 1, 1, 120, -10), step(0, 1, 1, 240, 10), step(0, 1, 1, 240, -10), step(0, 1, 1, 240, 10), step(0, 1, 1, 120)]), idle);
  };

  const showFace = (f: Face, ms?: number) => {
    setFace(f);
    clearTimeout(timers.current.face);
    if (ms) timers.current.face = setTimeout(() => setFace('look'), ms);
  };
  const speak = (text?: string) => {
    if (!text) {
      // Today's lines in order, the day's special one first; a new day brings a new set
      const fresh = todaysLines(new Date(), context.current);
      if (fresh.join() !== lines.current.list.join()) lines.current = { list: fresh, i: 0 };
      text = lines.current.list[lines.current.i % lines.current.list.length];
      lines.current.i += 1;
    }
    setLine(text);
    clearTimeout(timers.current.line);
    timers.current.line = setTimeout(() => setLine(''), 4000);
  };
  // Left alone for a while, he dozes off; any touch wakes him
  const awake = () => {
    clearTimeout(timers.current.sleep);
    timers.current.sleep = setTimeout(() => {
      setAsleep(true);
      showFace('sleep');
      speak(SLEEP_LINES[who]);
      breathe();
    }, SLEEP_AFTER);
  };

  const tap = () => {
    if (asleep) {
      setAsleep(false);
      setRestStage(0);
      showFace('whoa', 1200);
      speak(WAKE_LINES[who]);
      idle();
      return awake();
    }
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      showFace('dizzy', 2200);
      speak("Hilo na 'ko, hehe. Dahan-dahan lang!");
      wobble();
      return awake();
    }
    let f: Face;
    do { f = CUTE[Math.floor(Math.random() * CUTE.length)]; } while (f === face);
    showFace(f, 1800);
    speak();
    boing();
    awake();
  };

  const rest = async () => {
    clearTimeout(timers.current.sleep);
    await saveBuddy({ pick: 'none' });
    setSaved({ pick: 'none' });
    setResting(true);
    clearTimeout(timers.current.rest);
    timers.current.rest = setTimeout(() => setResting(false), 3000);
  };

  // Dragging: pick him up, move him (crying over Hide), and put him down
  const start = () => {
    drag.current = { ...drag.current, on: true, over: false, x: spot.x, y: spot.y };
    setHeld(true);
    setAsleep(false);
    setRestStage(0);
    setLine('');
    showFace('whoa');
    clearTimeout(timers.current.sleep);
    play(step(-10, 1.08, 1.08, 150));
  };
  const move = (dx: number, dy: number) => {
    const x = clamp(spot.x + dx, 0, box.w - W);
    const y = clamp(spot.y + dy, 0, barTop - H_BOX);
    pos.setValue({ x, y });
    drag.current.x = x;
    drag.current.y = y;
    const near = Math.hypot(x + W / 2 - trash.x, y + H_BOX / 2 - trash.y) < 56;
    if (near !== drag.current.over) {
      drag.current.over = near;
      setOver(near);
      setFace(near ? 'cry' : 'whoa');
    }
  };
  const drop = () => {
    const { x, y, over: onTrash } = drag.current;
    drag.current.on = false;
    setHeld(false);
    setOver(false);
    if (onTrash) return void rest();
    const next: BuddyState = { pick: saved?.pick ?? 'kape', x, y };
    setSaved(next);
    void saveBuddy(next);
    showFace('happy', 1000);
    idle();
    awake();
  };

  // Touch: a small movement is still a tap; past 8 points it becomes a drag
  const touch = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      drag.current.px = e.nativeEvent.pageX;
      drag.current.py = e.nativeEvent.pageY;
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const dx = e.nativeEvent.pageX - drag.current.px;
      const dy = e.nativeEvent.pageY - drag.current.py;
      if (!drag.current.on && Math.hypot(dx, dy) > 8) start();
      if (drag.current.on) move(dx, dy);
    },
    onResponderRelease: () => (drag.current.on ? drop() : tap()),
    onResponderTerminate: () => { if (drag.current.on) drop(); },
  };

  // Each time Home comes into view: load your pick and his spot, say today's line, start hopping
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const y = new Date();
      y.setDate(y.getDate() - 1);
      Promise.all([getBuddy(), getSettings(), getMoods()]).then(([b, s, moods]) => {
        if (!alive) return;
        context.current = { faith: s.faith, amount: s.faithAmount, tiredYesterday: moods.some((m) => m.date === dayKey(y) && m.feeling === 'Pagod') };
        setSaved({ ...b, pick: pickFor(b, s) });
        setVisit((v) => v + 1);
      });
      return () => {
        alive = false;
        anim.current?.stop();
        Object.values(timers.current).forEach(clearTimeout);
        setLine('');
        setAsleep(false);
        setRestStage(0);
        setPartner(false);
        setFace('look');
      };
    }, []),
  );
  const shown = !!saved && saved.pick !== 'none' && box.h > 0;
  useEffect(() => {
    if (!shown) return;
    pos.setValue(placeOf(saved));
    idle();
    awake();
    // Merienda (2 to 5 PM): the other one peeks in for a moment; any other time, today's line
    const hello = setTimeout(() => {
      const h = new Date().getHours();
      if (h < 14 || h >= 17 || merienda.current === dayKey()) return speak();
      merienda.current = dayKey();
      setPartner(true);
      speak('Merienda na! Kape at puto tayo.');
      clearTimeout(timers.current.partner);
      timers.current.partner = setTimeout(() => setPartner(false), 4000);
    }, 800);
    return () => clearTimeout(hello);
    // Runs when he appears, or when the pick or the screen size changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, saved?.pick, box.w, box.h, visit]);

  // Asleep, his nap goes on a little more every moment: more coffee spills, more cheese melts
  useEffect(() => {
    if (!asleep || reduce) return;
    const t = setInterval(() => setRestStage((n) => Math.min(4, n + 1)), 1400);
    return () => clearInterval(t);
  }, [asleep, reduce]);

  // A blink every few seconds while he's just looking at you
  useEffect(() => {
    if (!shown || face !== 'look') return;
    const t = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 140); }, 4500);
    return () => clearInterval(t);
  }, [shown, face]);

  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  // Squash and stretch from his feet, not his middle
  const lift = sy.interpolate({ inputRange: [0, 2], outputRange: [ART_H / 2, -ART_H / 2] });
  const rotate = tilt.interpolate({ inputRange: [-30, 30], outputRange: ['-30deg', '30deg'] });
  const left = spot.x + W / 2 < box.w / 2;
  const low = spot.y < 90;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {held && (
        <View pointerEvents="none" style={[styles.trash, { left: trash.x - 38, top: trash.y - 38, backgroundColor: over ? '#c4664a' : 'rgba(255,255,255,0.92)', borderColor: over ? '#c4664a' : c.muted }]}>
          <Text style={{ color: over ? '#ffffff' : c.muted, fontFamily: FONT.title, fontSize: 18 }}>✕</Text>
          <Text style={{ color: over ? '#ffffff' : c.muted, fontFamily: FONT.title, fontSize: 12 }}>Hide</Text>
        </View>
      )}

      {shown && (
        <Animated.View
          {...touch}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Your buddy. Tap for a kind word, or drag to move him"
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={() => tap()}
          style={[styles.buddy, { transform: [{ translateX: pos.x }, { translateY: pos.y }] }]}
        >
          {!!line && (
            <View
              pointerEvents="none"
              style={[
                styles.bubble,
                // While Kape naps the coffee pot is above him, so the bubble sits beside him instead
                asleep && who === 'kape'
                  ? [{ bottom: 6 }, left ? { left: W + 4 } : { right: W + 4 }]
                  : [low ? { top: H_BOX + 2 } : { bottom: H_BOX + 2 }, left ? { left: 0, borderBottomLeftRadius: 6 } : { right: 0, borderBottomRightRadius: 6 }],
              ]}
            >
              <Text style={{ color: c.text, fontFamily: FONT.bold, fontSize: 14, lineHeight: 20 }}>{line}</Text>
            </View>
          )}
          {partner && (
            <View pointerEvents="none" style={[styles.partner, left ? { right: -44 } : { left: -44 }]}>
              <BuddyArt who={who === 'kape' ? 'puto' : 'kape'} face="happy" size={48} />
            </View>
          )}
          {asleep && who === 'kape' && (
            <View pointerEvents="none" style={styles.pot}><CoffeePot /></View>
          )}
          <View style={[styles.shadow, { opacity: held ? 0.5 : 1, transform: [{ scaleX: held ? 0.6 : 1 }] }]} />
          <Animated.View style={{ position: 'absolute', left: (W - ART) / 2, bottom: 2, transform: [{ translateY: Animated.add(hopY, lift) }, { rotate }, { scaleX: sx }, { scaleY: sy }] }}>
            <BuddyArt who={who} face={face === 'look' && blink ? 'blink' : face} rest={asleep ? (reduce ? 4 : restStage) : 0} />
          </Animated.View>
        </Animated.View>
      )}

      {resting && (
        <View pointerEvents="none" style={[styles.toast, { top: barTop - 60, backgroundColor: c.text }]}>
          <Text style={{ color: '#ffffff', fontFamily: FONT.bold, fontSize: 14, textAlign: 'center' }}>Your buddy is resting. Pick one again anytime in You.</Text>
        </View>
      )}
    </View>
  );
}

// "Your buddy on Home" in You: Kape, Puto, or none
const PICKS: [BuddyPick, string, string][] = [
  ['kape', 'Kape', 'Mainit at gising'],
  ['puto', 'Puto', 'Malambot at masaya'],
  ['none', 'No buddy', 'Just a calm Home'],
];
export function BuddyPicker() {
  const c = useColors();
  const [pick, setPick] = useState<BuddyPick | null>(null);
  useFocusEffect(useCallback(() => { Promise.all([getBuddy(), getSettings()]).then(([b, s]) => setPick(pickFor(b, s))); }, []));
  const choose = async (p: BuddyPick) => {
    setPick(p);
    await saveBuddy({ pick: p }); // a new pick starts back in his corner
  };
  return (
    <>
      <H>Your buddy on Home</H>
      <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
        {PICKS.map(([p, name, line]) => {
          const on = pick === p;
          return (
            <Pressable key={p} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${name}. ${line}`} onPress={() => choose(p)} style={[styles.pick, { borderColor: on ? c.accent : 'transparent' }]}>
              {p === 'none' ? (
                <View style={styles.empty} />
              ) : (
                <BuddyArt who={p} size={56} />
              )}
              <Text style={{ color: c.text, fontFamily: FONT.title, fontSize: 14 }}>{name}</Text>
              <Text style={{ color: c.muted, fontFamily: FONT.body, fontSize: 12, textAlign: 'center' }}>{line}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  buddy: { position: 'absolute', left: 0, top: 0, width: W, height: H_BOX },
  shadow: { position: 'absolute', left: (W - 46) / 2, bottom: 0, width: 46, height: 8, borderRadius: 23, backgroundColor: 'rgba(60,40,50,0.18)' },
  bubble: { position: 'absolute', width: 196, backgroundColor: '#ffffff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, shadowColor: '#28463c', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  trash: { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', left: 24, right: 24, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  pick: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 22, backgroundColor: '#ffffff', borderWidth: 2 },
  partner: { position: 'absolute', bottom: 2 },
  pot: { position: 'absolute', left: -8, top: -50 },
  empty: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: '#a9b3ae', marginVertical: 5 },
});
