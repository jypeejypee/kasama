import * as Updates from 'expo-updates';

// New versions of Kasama arrive over the internet, no reinstall needed.
// At start (while the splash is still up) Kasama checks, downloads and switches to the new
// version right away, so you never have to open the app twice to get it.
// Any problem (offline, slow network) just keeps the version you have.
export async function updateIfAvailable(timeoutMs = 4000) {
  if (!Updates.isEnabled || __DEV__) return; // Expo Go and development builds update differently
  try {
    const found = await Promise.race([
      Updates.checkForUpdateAsync(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!found?.isAvailable) return;
    const fetched = await Updates.fetchUpdateAsync();
    if (fetched.isNew) await Updates.reloadAsync();
  } catch {
    // keep going with the current version
  }
}

// When you come back to Kasama after a while, quietly download any update for the next start
export async function prefetchUpdate() {
  if (!Updates.isEnabled || __DEV__) return;
  try {
    if ((await Updates.checkForUpdateAsync()).isAvailable) await Updates.fetchUpdateAsync();
  } catch {
    // try again next time
  }
}
