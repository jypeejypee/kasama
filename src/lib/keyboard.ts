import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

// Is the keyboard open? The bottom bar hides, and screens drop the space they kept for it.
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return open;
}

// Android draws apps edge to edge now, so the window no longer shrinks for the keyboard:
// KeyboardAvoidingView has to add the space itself on both platforms.
export const KEYBOARD_BEHAVIOR = 'padding' as const;
