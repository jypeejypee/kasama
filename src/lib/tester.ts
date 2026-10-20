import * as Updates from 'expo-updates';

// Extras only testers see: the APK friends installed (the preview channel) and development.
// The Play Store build uses the production channel, so it never shows them.
export const TESTER = __DEV__ || Updates.channel === 'preview';
