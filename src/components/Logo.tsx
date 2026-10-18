import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useColors } from '@/lib/theme';

const BIG = 'M112 22 C 140 14, 170 28, 176 62 C 182 96, 176 132, 150 146 C 128 158, 96 154, 84 136 C 72 116, 74 70, 84 46 C 90 32, 100 25, 112 22 Z';
const BIG_SHADE = 'M84 46 C 74 70, 72 116, 84 136 C 96 154, 128 158, 150 146 C 120 150, 100 140, 96 118 C 92 96, 94 66, 104 30 C 96 32, 88 38, 84 46 Z';
const BIG_LIGHT = 'M126 21 C 150 20, 168 36, 173 58 C 161 44, 146 32, 126 21 Z';
const VEIN = 'M98 100 C 120 98, 148 92, 171 82';
const SMALL = 'M54 74 C 74 66, 98 76, 102 100 C 106 126, 92 148, 70 150 C 48 152, 32 138, 30 116 C 28 96, 36 80, 54 74 Z';
const SMALL_SHADE = 'M30 116 C 28 96, 36 80, 54 74 C 46 88, 44 106, 48 124 C 52 140, 62 148, 70 150 C 48 152, 32 138, 30 116 Z';
const SMALL_LIGHT = 'M70 75 C 86 77, 97 88, 101 101 C 92 92, 82 83, 70 75 Z';

// Your stone takes the color of your place; Kasama's stays the same
const YOU = {
  dagat: ['#8cc5b8', '#6aaa9b', '#bfe2da'],
  bundok: ['#a9bcc8', '#8aa1b0', '#d3dee5'],
  palayan: ['#b5cf8f', '#97b872', '#d9e8c3'],
} as const;

// Kasama's logo: a big, steady stone (Kasama) and a small one resting close (you)
export function Logo({ width = 120, gap }: { width?: number; gap?: string }) {
  const c = useColors();
  const [small, shade, light] = YOU[c.place];
  return (
    <Svg width={width} height={(width * 170) / 200} viewBox="0 0 200 170" accessibilityLabel="Kasama: a big calm stone with a small stone resting beside it">
      <Ellipse cx={104} cy={156} rx={84} ry={7} fill="#ddd3c1" opacity={0.8} />
      <Path d={BIG} fill="#ece5d8" />
      <Path d={BIG_SHADE} fill="#d8cfbd" />
      <Path d={BIG_LIGHT} fill="#ffffff" />
      <Path d={VEIN} stroke="#ddd4c3" strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <Circle cx={136} cy={118} r={2.6} fill="#cfc5b2" />
      <Circle cx={149} cy={107} r={2} fill="#cfc5b2" />
      <Path d={SMALL} fill="none" stroke={gap ?? c.sky} strokeWidth={7} />
      <Path d={SMALL} fill={small} />
      <Path d={SMALL_SHADE} fill={shade} />
      <Path d={SMALL_LIGHT} fill={light} />
    </Svg>
  );
}

// While Kasama opens: the same two stones as the splash, with their shadows slowly
// warming and cooling, like light moving over them. It runs on the native side, so it stays smooth.
export function StoneLoader({ onShown }: { onShown?: () => void }) {
  const c = useColors();
  const [, shade] = YOU[c.place];
  const [glow] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glow]);
  const width = 184; // matches the stones on the splash screen, so the change is seamless
  const height = (width * 170) / 200;
  return (
    <View onLayout={onShown} style={{ flex: 1, backgroundColor: '#f6f0e4', alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Kasama is opening">
      <View style={{ width, height }}>
        <Logo width={width} gap="#f6f0e4" />
        <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: glow }}>
          <Svg width={width} height={height} viewBox="0 0 200 170">
            <Ellipse cx={104} cy={156} rx={90} ry={8} fill="#cdbfa6" opacity={0.8} />
            <Path d={BIG_SHADE} fill="#c8b89c" />
            <Path d={SMALL_SHADE} fill={shade} />
            <Path d={SMALL_SHADE} fill="#2f5d55" opacity={0.18} />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}
