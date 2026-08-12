import { Platform } from 'react-native';

// Shares a text document. Native: writes a temp file and opens the share
// sheet (expo-sharing). Web: navigator.share when available, else copies
// to the clipboard. Returns how the text was delivered.

export type ShareResult = 'shared' | 'copied' | 'unsupported';

export async function shareText(text: string, filename: string): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (typeof nav.share === 'function') {
      try {
        await nav.share({ text });
        return 'shared';
      } catch {
        // User dismissed the share sheet — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'unsupported';
    }
  }
  try {
    const [{ Directory, File, Paths }, Sharing] = await Promise.all([
      import('expo-file-system'),
      import('expo-sharing'),
    ]);
    const dir = new Directory(Paths.cache);
    dir.create({ intermediates: true, idempotent: true });
    const file = new File(Paths.cache, filename);
    await file.write(text);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'text/markdown', dialogTitle: filename });
      return 'shared';
    }
    return 'unsupported';
  } catch {
    return 'unsupported';
  }
}
