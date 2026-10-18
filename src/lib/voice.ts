import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type * as SpeechLib from 'expo-speech-recognition';
import { getSettings } from './storage';
import type { VoiceLang } from './types';

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
let lang: VoiceLang = 'fil-PH';
let fellBack = false; // true when the phone had no Filipino voice and Kasama switched to English
// Google's voice services, best first; phones differ in which one they have
const SERVICES = ['com.google.android.tts', 'com.google.android.googlequicksearchbox', 'com.google.android.as'];

// Which voice service to try, in order: Google's that this phone has, then the phone's own default.
// If one is busy (another app holds it), Kasama quietly moves to the next.
let options: (string | undefined)[] = [undefined];
let attempt = 0;
let starting = false; // one tap = one listening session, never two

function pickOptions() {
  if (!Speech || Platform.OS !== 'android') return [undefined];
  try {
    const have = Speech.ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
    return [...SERVICES.filter((p) => have.includes(p)), undefined];
  } catch {
    return [undefined];
  }
}

// Close anything still open, give the phone a moment, then listen
async function begin() {
  if (!Speech) return;
  const m = Speech.ExpoSpeechRecognitionModule;
  try { m.abort(); } catch { /* nothing was open */ }
  await new Promise((r) => setTimeout(r, 300));
  const service = options[attempt];
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
  m.addListener('start', () => {
    starting = false;
    const how = fellBack ? 'in English, because this phone has no Filipino voice yet' : lang === 'fil-PH' ? 'in Filipino' : 'in English';
    set({ listening: true, note: `I'm listening ${how}… tap the mic again when you're done.` });
  });
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
      fellBack = true;
      begin();
      return;
    }
    // This voice service is busy or broke off: try the next one before giving up
    if ((e.error === 'busy' || e.error === 'client' || e.error === 'service-not-allowed') && attempt < options.length - 1) {
      attempt += 1;
      begin();
      return;
    }
    starting = false;
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
  if (starting) return; // already getting ready from an earlier tap
  starting = true;
  setTimeout(() => { starting = false; }, 8000); // never stay stuck if the phone stays silent
  const perm = await m.requestPermissionsAsync();
  if (!perm.granted) {
    starting = false;
    set({ note: 'I need the microphone to hear you. Allow it in your phone settings.' });
    return;
  }
  if (!m.isRecognitionAvailable()) {
    starting = false;
    set({ note: NO_SERVICE });
    return;
  }
  kept = target?.get() ?? '';
  lang = (await getSettings()).voiceLang ?? 'fil-PH'; // chosen in You → Voice
  fellBack = false;
  options = pickOptions();
  attempt = 0;
  set({ note: 'Getting ready to listen…' });
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
  // Can this phone hear Filipino? (Android 13+ can tell us; older phones just try it)
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) < 33) {
      lines.push("Filipino voice: can't check on this Android version. I'll try Filipino first and switch to English if needed.");
    } else {
      try {
        const have = m.getSpeechRecognitionServices();
        const service = SERVICES.find((p) => have.includes(p));
        const { locales, installedLocales } = await m.getSupportedLocales(service ? { androidRecognitionServicePackage: service } : {});
        const isFil = (l: string) => /^(fil|tl)\b/i.test(l);
        lines.push(
          installedLocales.some(isFil) ? 'Filipino voice: supported, even offline'
            : locales.some(isFil) ? 'Filipino voice: supported (needs internet)'
            : locales.length ? "Filipino voice: not on this phone, so I'll listen in English"
            : "Filipino voice: the phone didn't say. I'll try Filipino first.",
        );
      } catch {
        lines.push("Filipino voice: the phone didn't say. I'll try Filipino first.");
      }
    }
  }
  if (state.note) lines.push(`Last voice message: ${state.note}`);
  return lines;
}
