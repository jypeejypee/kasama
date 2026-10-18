import { useSyncExternalStore } from 'react';
import type * as SpeechLib from 'expo-speech-recognition';

// Talk to Kasama with the big mic in the middle of the bottom bar.
// Uses the phone's own speech engine (free, no Claude credit needed). It needs the installed app:
// in Expo Go the native part is missing, so Kasama falls back to the keyboard's mic.
let Speech: typeof SpeechLib | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Speech = require('expo-speech-recognition');
} catch {
  Speech = null;
}

type State = { listening: boolean; note: string };
let state: State = { listening: false, note: '' };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const useVoice = () => useSyncExternalStore(subscribe, () => state, () => state);

// The Let it out screen tells us how to read and write its text box
type Target = { get: () => string; put: (text: string) => void; focus: () => void };
let target: Target | null = null;
export function voiceTarget(t: Target) {
  target = t;
  return () => { if (target === t) target = null; };
}

let kept = ''; // what was already in the box, plus everything you finished saying
const join = (a: string, b: string) => (a.trim() ? `${a.trim()}${/[,.!?]$/.test(a.trim()) ? '' : ','} ${b}` : b);

if (Speech) {
  const m = Speech.ExpoSpeechRecognitionModule;
  m.addListener('start', () => set({ listening: true, note: "I'm listening… tap the mic again when you're done." }));
  m.addListener('end', () => set({ listening: false, note: '' }));
  m.addListener('result', (e) => {
    const said = e.results[0]?.transcript?.trim();
    if (!said) return;
    if (e.isFinal) {
      kept = join(kept, said);
      target?.put(kept);
    } else {
      target?.put(join(kept, said));
    }
  });
  m.addListener('error', (e) => {
    const note = e.error === 'not-allowed' ? 'I need the microphone to hear you. Allow it in your phone settings.'
      : e.error === 'no-speech' ? "I didn't catch anything. Tap the mic and try again."
      : e.error === 'aborted' ? ''
      : "I couldn't hear you just now. Try again, or type instead.";
    set({ listening: false, note });
  });
}

export async function toggleListening() {
  if (!Speech) {
    target?.focus();
    set({ note: 'Voice works in the installed app. For now, tap the microphone on your keyboard.' });
    return;
  }
  const m = Speech.ExpoSpeechRecognitionModule;
  if (state.listening) {
    m.stop();
    return;
  }
  const perm = await m.requestPermissionsAsync();
  if (!perm.granted) {
    set({ note: 'I need the microphone to hear you. Allow it in your phone settings.' });
    return;
  }
  kept = target?.get() ?? '';
  // Filipino recognition also understands English words, so Taglish works
  m.start({ lang: 'fil-PH', interimResults: true, continuous: true });
}

export const clearVoiceNote = () => set({ note: '' });
