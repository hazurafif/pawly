import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SERVER_URL = 'pawly.serverUrl';
const KEY_LANGUAGE = 'pawly.language';

// Expo inlines process.env.EXPO_PUBLIC_* statically, so these must be
// referenced with dot notation inside each function body.
export function envServerUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_PAWLY_URL;
  if (!raw) {
    return null;
  }
  try {
    return normalizeServerUrl(raw);
  } catch {
    return null;
  }
}

// Auto-detection probes the LAN for a Pawly server when no URL is
// configured (stored or .env). Set to 'false' to disable the scan.
export function autoDetectEnabled(): boolean {
  const flag = process.env.EXPO_PUBLIC_PAWLY_AUTO_DETECT;
  return flag === undefined || flag.toLowerCase() !== 'false';
}

// Port probed during auto-detection; defaults to the server's PAWLY_PORT.
export function envServerPort(): number {
  const raw = process.env.EXPO_PUBLIC_PAWLY_PORT;
  if (!raw) {
    return 8080;
  }
  const port = Number.parseInt(raw, 10);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : 8080;
}

// AsyncStorage throws where there is no real storage (expo-router's static
// node render has no window). All access degrades to defaults instead.
async function safeGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // storage unavailable — nothing to persist
  }
}

// Adds http:// when the scheme is missing, strips trailing slashes, and
// rejects anything that still isn't a valid http(s) URL.
export function normalizeServerUrl(value: string): string {
  let normalized = value.trim();
  if (normalized === '') {
    throw new Error('invalid server URL');
  }
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'http://' + normalized;
  }
  normalized = normalized.replace(/\/+$/, '');
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('invalid server URL');
  }
  if (!parsed.hostname) {
    throw new Error('invalid server URL');
  }
  return normalized;
}

export async function getServerUrl(): Promise<string | null> {
  return (await safeGet(KEY_SERVER_URL)) ?? envServerUrl();
}

export async function setServerUrl(value: string): Promise<void> {
  const normalized = normalizeServerUrl(value);
  await safeSet(KEY_SERVER_URL, normalized);
}

export async function getLanguage(): Promise<'id' | 'en'> {
  const lang = await safeGet(KEY_LANGUAGE);
  return lang === 'en' ? 'en' : 'id';
}

export async function setLanguage(lang: 'id' | 'en'): Promise<void> {
  await safeSet(KEY_LANGUAGE, lang);
}
