import Svg, { Circle, Path } from 'react-native-svg';
import type { Mood } from '@/lib/types';

const SUN = '#e9b44c';
const MOON = '#9d8ac0';
const EMPTY = '#d8d1c3';

// A little sky for each day: sun when you were happy, sun behind a cloud when it was okay,
// a calm moon when you were tired. Readable without a legend, and a tired day looks restful, not bad.
export function MoodSky({ feeling, size = 32 }: { feeling?: Mood['feeling']; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {!feeling && <Circle cx={16} cy={16} r={13} fill="none" stroke={EMPTY} strokeWidth={2} strokeDasharray="3 3" />}
      {feeling === 'Masaya' && (
        <>
          <Circle cx={16} cy={16} r={13} fill={SUN} opacity={0.25} />
          <Circle cx={16} cy={16} r={9} fill={SUN} />
        </>
      )}
      {feeling === 'Okay lang' && (
        <>
          <Circle cx={19} cy={12} r={11} fill={SUN} opacity={0.25} />
          <Circle cx={19} cy={12} r={7} fill={SUN} />
          <Path d="M7 26a5 5 0 0 1 1-9.9A7 7 0 0 1 21.5 17 4.5 4.5 0 0 1 22 26Z" fill="#ffffff" stroke="#d9d2c4" strokeWidth={1.2} />
        </>
      )}
      {feeling === 'Pagod' && (
        <>
          <Path d="M20 5a11 11 0 1 0 8 17A9 9 0 0 1 20 5Z" fill={MOON} />
          <Circle cx={25} cy={8} r={1.4} fill={MOON} />
          <Circle cx={28} cy={14} r={1} fill={MOON} />
        </>
      )}
    </Svg>
  );
}
