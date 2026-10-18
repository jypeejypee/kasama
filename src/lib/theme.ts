import { useSyncExternalStore } from 'react';
import type { Place } from './types';

// Kasama lives in one calm place you choose: by the sea, in the mountains or over the rice fields.
const PLACES = {
  dagat: { sky: '#eaf3f0', ground: '#f6f0e4', band: '#d6eae6', sea1: '#cfe6e2', sea2: '#bddcd7', accent: '#557564', edge: '#a7c4bd', verb: 'sailing' },
  bundok: { sky: '#edf1f3', ground: '#eef1ee', band: '#e1e8ea', sea1: '#c7d4d8', sea2: '#9fb5ae', accent: '#4c6b62', edge: '#a9bcc2', verb: 'drifting' },
  palayan: { sky: '#f3f2e4', ground: '#f4f1e2', band: '#e6edd2', sea1: '#d6e2b6', sea2: '#adc886', accent: '#5a6e3c', edge: '#a6c27f', verb: 'flying' },
} as const;

const BASE = { text: '#2f3d38', muted: '#4a5a54', line: '#dcd6c8', card: 'rgba(255,255,255,0.88)', accentText: '#ffffff', high: '#c0392b', medium: '#c27c0e', low: '#9aa59f', peach: '#f2b48a', sand: '#f6f0e4' };

// The evening check-in always happens at night
export const NIGHT = { bg: '#232a40', text: '#e9ebf3', muted: '#c9cee0', line: '#535b80', moon: '#f1e3c6' };

export const FONT = {
  title: 'Nunito_800ExtraBold',
  bold: 'Nunito_700Bold',
  body: 'NunitoSans_400Regular',
  semi: 'NunitoSans_600SemiBold',
  strong: 'NunitoSans_700Bold',
};

// The chosen place lives here so every screen changes the moment you pick a new one
let place: Place = 'dagat';
const listeners = new Set<() => void>();
export function setPlace(p: Place | undefined) {
  const next = p ?? 'dagat';
  if (next === place) return;
  place = next;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useColors() {
  const p = useSyncExternalStore(subscribe, () => place, () => place);
  return { ...BASE, ...PLACES[p], place: p, bg: PLACES[p].sky };
}
export type Colors = ReturnType<typeof useColors>;
