import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
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

// The Kasama screen tells us how to read and write its text box
type Target = { get: () => string; put: (text: string) => void; focus: () => void };
let target: Target | null = null;
export function voiceTarget(t: Target) {
  target = t;
  return () => { if (target === t) target = null; };
}

const NO_SERVICE = "This phone has no voice service I can use. Install or turn on Google's \"Speech Recognition & Synthesis\" (or the Google app), then try again.";

let kept = ''; // what was already in the box, plus everything you finished saying
const join = (a: string, b: string) => (a.trim() ? `${a.trim()}${/[,.!?]$/.test(a.trim()) ? '' : ','} ${b}` : b);

// Filipino recognition also understands English words, so Taglish works; English is the fallback
let lang = 'fil-PH';
// Google's voice services, best first; phones differ in which one they have
const SERVICES = ['com.google.android.tts', 'com.google.android.googlequicksearchbox', 'com.google.android.as'];

function begin() {
  if (!Speech) return;
  const m = Speech.ExpoSpeechRecognitionModule;
  let service: string | undefined;
  if (Platform.OS === 'android') {
    try {
      const have = m.getSpeechRecognitionServices();
      service = SERVICES.find((p) => have.includes(p));
    } catch {
      service = undefined; // let the phone use its default
    }
  }
  m.start({
    lang,
    interimResults: true,
    // Continuous listening needs Android 13+; older phones stop after a pause, which is fine
    continuous: Platform.OS !== 'android' || Number(Platform.Version) >= 33,
    ...(service ? { androidRecognitionServicePackage: service } : {}),
  });
}

if (Speech) {
  const m = Speech.ExpoSpeechRecognitionModule;
  m.addListener('start', () => set({ listening: true, note: "I'm listening… tap the mic again when you're done." }));
  m.addListener('end', () => set({ listening: false, note: state.note.startsWith("I'm listening") ? '' : state.note }));
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
    // This phone can't do Filipino recognition: try again in English (it still catches most Taglish)
    if (e.error === 'language-not-supported' && lang !== 'en-US') {
      lang = 'en-US';
      begin();
      return;
    }
    const note = e.error === 'not-allowed' ? 'I need the microphone to hear you. Allow it in your phone settings.'
      : e.error === 'no-speech' || e.error === 'speech-timeout' ? "I didn't catch anything. Tap the mic and try again."
      : e.error === 'aborted' ? ''
      : e.error === 'network' ? 'Voice needs internet on this phone. Try again when you are online, or type instead.'
      : e.error === 'service-not-allowed' || e.error === 'language-not-supported' ? NO_SERVICE
      : `I couldn't hear you just now (${e.error}). Try again, or type instead.`;
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
  if (!m.isRecognitionAvailable()) {
    set({ note: NO_SERVICE });
    return;
  }
  kept = target?.get() ?? '';
  lang = 'fil-PH';
  begin();
}

export const clearVoiceNote = () => set({ note: '' });

// "Test my mic" in You: what this phone offers, in plain words, so a problem can be found from a screenshot
export async function voiceReport(): Promise<string[]> {
  if (!Speech) return ['Voice part: missing in this version of the app (Expo Go, or an old install).'];
  const m = Speech.ExpoSpeechRecognitionModule;
  const lines: string[] = [];
  try {
    const perm = await m.getPermissionsAsync();
    lines.push(`Microphone permission: ${perm.granted ? 'allowed' : perm.canAskAgain ? 'not yet allowed' : 'blocked (allow it in phone settings)'}`);
  } catch (e) {
    lines.push(`Microphone permission: could not check (${(e as Error).message})`);
  }
  try {
    lines.push(`Voice service available: ${m.isRecognitionAvailable() ? 'yes' : 'no'}`);
  } catch (e) {
    lines.push(`Voice service available: could not check (${(e as Error).message})`);
  }
  if (Platform.OS === 'android') {
    try {
      const have = m.getSpeechRecognitionServices();
      lines.push(`Voice services on this phone: ${have.length ? have.join(', ') : 'none found'}`);
      lines.push(`Kasama will use: ${SERVICES.find((p) => have.includes(p)) ?? 'the phone default'}`);
    } catch (e) {
      lines.push(`Voice services: could not check (${(e as Error).message})`);
    }
    try {
      lines.push(`Phone default: ${m.getDefaultRecognitionService().packageName || 'none'}`);
    } catch {
      lines.push('Phone default: unknown');
    }
    lines.push(`Android version: ${Platform.Version}`);
  }
  if (state.note) lines.push(`Last voice message: ${state.note}`);
  return lines;
}
