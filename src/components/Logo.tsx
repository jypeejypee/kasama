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
export function Logo({ width = 120, gap, place }: { width?: number; gap?: string; place?: keyof typeof YOU }) {
  const c = useColors();
  const [small, shade, light] = YOU[place ?? c.place];
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

// While Kasama opens: the same two stones as the splash, and the shadow under them is the loading bar.
// A slightly darker patch of the same shadow glides left to right and back until Kasama is ready.
// It runs on the native side, so it stays smooth even while Kasama is busy.
export function StoneLoader({ onShown }: { onShown?: () => void }) {
  const [move] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const glide = (to: number) => Animated.timing(move, { toValue: to, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([glide(1), glide(0)]));
    loop.start();
    return () => loop.stop();
  }, [move]);

  // Exactly where Android draws the splash stones (a 200dp image; measured from assets/splash-icon.png),
  // in the splash's own Dagat colors, so the hand-over from the still splash is invisible
  const width = 171.8;
  const height = (width * 170) / 200;
  const s = width / 200;
  // The shadow in the logo is an ellipse 168 wide and 14 tall, centered at (104, 156)
  const shadowW = 168 * s;
  const band = shadowW * 0.38;
  const x = move.interpolate({ inputRange: [0, 1], outputRange: [-band * 0.5, shadowW - band * 0.5] });
  return (
    <View onLayout={onShown} style={{ flex: 1, backgroundColor: '#f6f0e4', alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Kasama is opening">
      <View style={{ width, height, transform: [{ translateX: -4.33 }, { translateY: -0.75 }] }}>
        <Logo width={width} gap="#f6f0e4" place="dagat" />
        {/* A circle squashed flat into the shadow's ellipse; it clips the gliding band to the shadow's shape */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 20 * s, top: 156 * s - shadowW / 2, width: shadowW, height: shadowW, borderRadius: shadowW / 2, overflow: 'hidden', transform: [{ scaleY: 14 / 168 }] }}>
          <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: band, flexDirection: 'row', transform: [{ translateX: x }] }}>
            {[0.2, 0.45, 0.7, 0.45, 0.2].map((o, i) => <View key={i} style={{ flex: 1, backgroundColor: '#bfb196', opacity: o }} />)}
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
