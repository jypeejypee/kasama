import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H } from '@/components/ui';
import { useReduceMotion } from '@/components/Motion';
import { FONT, useColors } from '@/lib/theme';
import { getBuddy, saveBuddy } from '@/lib/storage';
import { todaysLines } from '@/lib/buddyLines';
import type { BuddyPick, BuddyState } from '@/lib/types';

// A little friend on Home (testers only). He hops in the corner and says something kind when you tap him.
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

// The faces are drawn for Poring; on the Dino kid they sit a little smaller, inside his hood
const DINO_FACE = 'matrix(0.82,0,0,0.82,9,1.36)';

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

function PoringBody() {
  return (
    <G>
      <Circle cx={90} cy={6} r={5.5} fill="url(#ball)" stroke="#c9577f" strokeWidth={1} />
      <Circle cx={88.4} cy={4.2} r={1.6} fill="#ffffff" opacity={0.85} />
      <Path d="M50 10 C54 18 66 21 78 28 C92 36 98 50 95 62 C92 74 78 79 50 79 C22 79 8 74 5 62 C2 50 8 36 22 28 C34 21 46 18 50 10 Z" fill="url(#pink)" stroke="#c9577f" strokeWidth={1.6} strokeLinejoin="round" />
      <Ellipse cx={26} cy={38} rx={9} ry={5} fill="#ffffff" opacity={0.75} transform="rotate(-30 26 38)" />
      <Path d="M49 14 C47 19 43 22 39 24" fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" opacity={0.7} />
      <Ellipse cx={22} cy={58} rx={8} ry={5} fill="#ff6f98" opacity={0.4} />
      <Ellipse cx={78} cy={58} rx={8} ry={5} fill="#ff6f98" opacity={0.4} />
    </G>
  );
}

function DinoBody() {
  return (
    <G>
      <Path d="M30 70 C18 70 8 64 2 54 C10 60 20 62 30 62 Z" fill="#e59a8f" stroke="#c97a70" strokeWidth={1.2} strokeLinejoin="round" />
      <Path d="M7 58 l1 -6 l4 5 Z M14 61 l2 -6 l3 6 Z M21 62 l3 -6 l2 6 Z" fill="#8fc9c3" />
      <Ellipse cx={41} cy={80} rx={7} ry={3.4} fill="#d98a80" />
      <Ellipse cx={59} cy={80} rx={7} ry={3.4} fill="#d98a80" />
      <Ellipse cx={26} cy={68} rx={5} ry={7.5} fill="#f3e6d6" stroke="#d8c3ad" strokeWidth={1} transform="rotate(20 26 68)" />
      <Ellipse cx={74} cy={68} rx={5} ry={7.5} fill="#f3e6d6" stroke="#d8c3ad" strokeWidth={1} transform="rotate(-20 74 68)" />
      <Path d="M31 61 Q50 55 69 61 L72 77 Q50 83 28 77 Z" fill="#f3e6d6" stroke="#d8c3ad" strokeWidth={1.2} strokeLinejoin="round" />
      <Path d="M33 69 Q50 72 67 69 M50 61 V80" fill="none" stroke="#d8c3ad" strokeWidth={1} />
      <Circle cx={40} cy={74} r={2.4} fill="#e8836f" /><Circle cx={61} cy={66} r={2.2} fill="#e8836f" /><Circle cx={64} cy={75} r={1.8} fill="#e8836f" />
      <Path d="M45 60 L44 68 M55 60 L56 68" stroke="#c97a70" strokeWidth={1} strokeLinecap="round" />
      <Path d="M36 12 L40 0 L45 9 Z M55 9 L60 0 L64 12 Z" fill="#e59a8f" stroke="#c97a70" strokeWidth={1} strokeLinejoin="round" />
      <Path d="M76 18 L88 14 L82 25 Z M80 30 L92 30 L83 38 Z" fill="#8fc9c3" />
      <Circle cx={50} cy={37} r={30} fill="#e59a8f" stroke="#c97a70" strokeWidth={1.4} />
      <Circle cx={39} cy={15} r={3.6} fill="#ffffff" stroke="#c97a70" strokeWidth={0.8} /><Circle cx={39.6} cy={15.4} r={1.8} fill={INK} />
      <Circle cx={61} cy={15} r={3.6} fill="#ffffff" stroke="#c97a70" strokeWidth={0.8} /><Circle cx={61.6} cy={15.4} r={1.8} fill={INK} />
      <Ellipse cx={50} cy={43} rx={25} ry={23} fill="#f3e6d6" />
      <Ellipse cx={50} cy={45} rx={21} ry={19} fill="#ffe0cc" />
      <Path d="M29 41 Q33 26 50 26 Q67 26 71 41 Q65 34 58 37 Q54 31 49 36 Q44 31 40 37 Q35 34 29 41 Z" fill="#5a3a2a" />
      <Ellipse cx={36} cy={51} rx={4.6} ry={2.8} fill="#ff8f8f" opacity={0.45} />
      <Ellipse cx={64} cy={51} rx={4.6} ry={2.8} fill="#ff8f8f" opacity={0.45} />
    </G>
  );
}

// The drawing alone: also used, smaller, for the choices in You
export function BuddyArt({ who, face = 'look', size = ART }: { who: Exclude<BuddyPick, 'none'>; face?: Face; size?: number }) {
  return (
    <Svg width={size} height={(size * 100) / 112} viewBox="-6 -18 112 100">
      <Defs>
        <RadialGradient id="pink" cx="0.45" cy="0.55" r="0.68">
          <Stop offset="0" stopColor="#ffc6d6" />
          <Stop offset="0.6" stopColor="#f7a0b9" />
          <Stop offset="1" stopColor="#e57d9e" />
        </RadialGradient>
        <RadialGradient id="ball" cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#ffd6e3" />
          <Stop offset="1" stopColor="#ef8aab" />
        </RadialGradient>
      </Defs>
      {who === 'poring' ? <PoringBody /> : <DinoBody />}
      <G transform={who === 'dino' ? DINO_FACE : undefined}><FaceArt face={face} /></G>
    </Svg>
  );
}

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

  // Where he stands (the drag moves this) and how he hops (scale and tilt for squash, stretch and wiggle)
  const [pos] = useState(() => new Animated.ValueXY());
  const [hopY] = useState(() => new Animated.Value(0));
  const [sx] = useState(() => new Animated.Value(1));
  const [sy] = useState(() => new Animated.Value(1));
  const [tilt] = useState(() => new Animated.Value(0));
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const timers = useRef<{ face?: ReturnType<typeof setTimeout>; line?: ReturnType<typeof setTimeout>; sleep?: ReturnType<typeof setTimeout>; rest?: ReturnType<typeof setTimeout> }>({});
  const lines = useRef({ list: todaysLines(), i: 0 });
  const taps = useRef<number[]>([]);
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
      const fresh = todaysLines();
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
      setLine('');
      showFace('sleep');
      breathe();
    }, SLEEP_AFTER);
  };

  const tap = () => {
    if (asleep) {
      setAsleep(false);
      showFace('whoa', 1200);
      speak('Uy! Nandito ka na pala.');
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
    const next: BuddyState = { pick: saved?.pick ?? 'poring', x, y };
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
      getBuddy().then((b) => { if (alive) { setSaved(b); setVisit((v) => v + 1); } });
      return () => {
        alive = false;
        anim.current?.stop();
        Object.values(timers.current).forEach(clearTimeout);
        setLine('');
        setAsleep(false);
        setFace('look');
      };
    }, []),
  );
  const shown = !!saved && saved.pick !== 'none' && box.h > 0;
  const who = saved?.pick === 'dino' ? 'dino' : 'poring';
  useEffect(() => {
    if (!shown) return;
    pos.setValue(placeOf(saved));
    idle();
    awake();
    const hello = setTimeout(() => speak(), 800);
    return () => clearTimeout(hello);
    // Runs when he appears, or when the pick or the screen size changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, saved?.pick, box.w, box.h, visit]);

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
            <View pointerEvents="none" style={[styles.bubble, low ? { top: H_BOX + 2 } : { bottom: H_BOX + 2 }, left ? { left: 0, borderBottomLeftRadius: 6 } : { right: 0, borderBottomRightRadius: 6 }]}>
              <Text style={{ color: c.text, fontFamily: FONT.bold, fontSize: 14, lineHeight: 20 }}>{line}</Text>
            </View>
          )}
          <View style={[styles.shadow, { opacity: held ? 0.5 : 1, transform: [{ scaleX: held ? 0.6 : 1 }] }]} />
          <Animated.View style={{ position: 'absolute', left: (W - ART) / 2, bottom: 2, transform: [{ translateY: Animated.add(hopY, lift) }, { rotate }, { scaleX: sx }, { scaleY: sy }] }}>
            <BuddyArt who={who} face={face === 'look' && blink ? 'blink' : face} />
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

// "Your buddy on Home" in You: Poring, the Dino kid, or none
const PICKS: [BuddyPick, string, string][] = [
  ['poring', 'Poring', 'Bouncy and pink'],
  ['dino', 'Dino kid', 'Small and brave'],
  ['none', 'No buddy', 'Just a calm Home'],
];
export function BuddyPicker() {
  const c = useColors();
  const [pick, setPick] = useState<BuddyPick | null>(null);
  useFocusEffect(useCallback(() => { getBuddy().then((b) => setPick(b.pick)); }, []));
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
  empty: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: '#a9b3ae', marginVertical: 5 },
});
