import { useColorScheme } from 'react-native';

const light = { bg: '#f6f4ef', card: '#ffffff', text: '#1c2421', muted: '#5f6b66', line: '#e2ded4', accent: '#2f5d50', accentText: '#ffffff', high: '#c0392b', medium: '#c27c0e', low: '#9aa59f' };
const dark = { bg: '#121614', card: '#1c2220', text: '#e8ece9', muted: '#9aa8a2', line: '#2c3431', accent: '#7cc4a8', accentText: '#0f1a16', high: '#f0796b', medium: '#e5a84a', low: '#6d7a74' };

export type Colors = typeof light;
export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}
