import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

// Slow, calm motion, at the pace of breathing. Turned off when the phone asks for reduced motion.
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

function useLoop(duration: number, delay = 0) {
  const reduce = useReduceMotion();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce) return;
    const ease = Easing.inOut(Easing.sin);
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: duration / 2, easing: ease, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: duration / 2, easing: ease, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay, reduce]);
  return v;
}

// The logo breathes in and out
export function Breathe({ children }: { children: React.ReactNode }) {
  const v = useLoop(6000);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

// Boats rock, clouds and kites drift; each one a little out of step with the others
export function Drift({ children, index = 0 }: { children: React.ReactNode; index?: number }) {
  const v = useLoop(5200 + index * 700, index * 600);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const rotate = v.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });
  return <Animated.View style={{ transform: [{ translateY }, { rotate }] }}>{children}</Animated.View>;
}
