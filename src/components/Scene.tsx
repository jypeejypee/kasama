import { Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { FONT, useColors } from '@/lib/theme';

// The view at the top of a screen: sea, mountains or rice fields, depending on your place.
// "dawn" is for the morning plan, so the sky turns warm.
export function Scene({ height, time = 'day' }: { height: number; time?: 'day' | 'dawn' }) {
  const c = useColors();
  const sky = time === 'dawn' ? '#f8ebe2' : c.sky;
  const sun = time === 'dawn' ? '#f4bf98' : '#f6cfae';
  const h = 200; // drawn at 390×200, stretched to fit
  return (
    <View style={{ height, width: '100%' }} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`0 0 390 ${h}`} preserveAspectRatio="none">
        <Rect width={390} height={h} fill={sky} />
        {c.place === 'dagat' && (
          <>
            <Circle cx={312} cy={112} r={30} fill={sun} />
            <Rect y={112} width={390} height={88} fill={c.sea1} />
            <Path d="M0 150 C 120 142, 260 158, 390 146 V200 H0 Z" fill={c.sea2} />
            <Path d="M290 124 H334 M300 136 H324" stroke="#f3cdb0" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
            <Path d="M-10 184 C 80 172, 170 194, 260 180 S 370 176, 400 184" stroke="#ffffff" strokeWidth={5} fill="none" strokeLinecap="round" />
            <Path d="M0 188 C 90 176, 200 198, 290 184 S 370 182, 390 188 V200 H0 Z" fill={c.ground} />
          </>
        )}
        {c.place === 'bundok' && (
          <>
            <Circle cx={300} cy={92} r={28} fill={sun} />
            <Path d="M0 160 L60 110 L120 140 L190 80 L260 136 L320 100 L390 140 V200 H0 Z" fill={c.sea1} />
            <Path d="M0 178 L80 140 L150 168 L230 130 L390 170 V200 H0 Z" fill={c.sea2} />
            <Path d="M24 200 L36 168 L48 200 Z M44 200 L56 172 L68 200 Z M330 200 L342 166 L354 200 Z M350 200 L362 172 L374 200 Z" fill="#5f8072" />
            <Ellipse cx={195} cy={194} rx={220} ry={14} fill="#ffffff" opacity={0.9} />
          </>
        )}
        {c.place === 'palayan' && (
          <>
            <Circle cx={310} cy={82} r={28} fill={sun} />
            <Path d="M0 120 C 90 108, 220 114, 390 104 V200 H0 Z" fill="#d6e2b6" />
            <Path d="M0 140 C 110 128, 230 136, 390 126 V200 H0 Z" fill="#c3d69c" />
            <Path d="M0 160 C 100 148, 240 156, 390 146 V200 H0 Z" fill="#adc886" />
            <Path d="M0 178 C 120 168, 230 176, 390 168 V200 H0 Z" fill="#97b872" />
            <Path d="M0 192 C 120 184, 230 190, 390 184 V200 H0 Z" fill={c.ground} />
          </>
        )}
      </Svg>
    </View>
  );
}

// One caught thought, carried the way your place carries things:
// a paraw on the sea, a cloud over the mountains, a kite over the rice fields.
export function Vessel({ label, tint, big }: { label: string; tint: string; big?: boolean }) {
  const c = useColors();
  const s = big ? 1.3 : 1;
  return (
    <View style={{ alignItems: 'center', maxWidth: 120 }} accessible accessibilityLabel={label}>
      {c.place === 'dagat' && (
        <Svg width={50 * s} height={42 * s} viewBox="0 0 100 84">
          <Path d="M4 74 L96 74" stroke="#c4a372" strokeWidth={3} strokeLinecap="round" />
          <Path d="M30 64 Q26 58 10 73 M70 64 Q74 58 90 73" stroke="#c4a372" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          <Path d="M16 62 Q50 72 86 60 L82 67 Q50 77 20 68 Z" fill="#ffffff" />
          <Path d="M50 62 L50 6" stroke="#8a6a4a" strokeWidth={2} />
          <Path d="M52 6 Q76 30 84 58 L52 58 Z" fill="#fbf6ec" />
          <Path d="M52 34 L76 34 L80 44 L52 44 Z" fill={tint} />
          <Path d="M48 14 Q34 36 26 58 L48 58 Z" fill="#e9e3d6" />
        </Svg>
      )}
      {c.place === 'bundok' && (
        <Svg width={58 * s} height={36 * s} viewBox="0 0 56 34">
          <Path d="M12 30 C 3 30, 2 20, 10 18 C 9 9, 20 6, 24 12 C 27 3, 42 4, 42 14 C 52 14, 54 28, 44 30 Z" fill="#ffffff" stroke="#c7d4d8" strokeWidth={1.4} />
        </Svg>
      )}
      {c.place === 'palayan' && (
        <Svg width={34 * s} height={50 * s} viewBox="0 0 38 56">
          <Path d="M19 2 L36 18 L19 38 L2 18 Z" fill={tint} />
          <Path d="M19 2 L19 38 M2 18 L36 18" stroke="#b39a84" strokeWidth={1.2} />
          <Path d="M19 38 Q 14 44 20 48 Q 26 52 21 56" stroke="#b39a84" strokeWidth={1.5} fill="none" />
        </Svg>
      )}
      <Text numberOfLines={1} style={{ fontFamily: FONT.title, fontSize: 14, color: '#24433f', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export const TINTS = ['#b9d4b2', '#f2c7a6', '#cbd9ee', '#e3d6ee'];
