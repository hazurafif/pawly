import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SERVER_URL = 'pawly.serverUrl';
const KEY_LANGUAGE = 'pawly.language';

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

export async function getServerUrl(): Promise<string | null> {
  return safeGet(KEY_SERVER_URL);
}

// Normalizes: adds http:// when the scheme is missing, strips trailing
// slashes. Rejects anything that still isn't a valid http(s) URL.
export async function setServerUrl(value: string): Promise<void> {
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
  await safeSet(KEY_SERVER_URL, normalized);
}

export async function getLanguage(): Promise<'id' | 'en'> {
  const lang = await safeGet(KEY_LANGUAGE);
  return lang === 'en' ? 'en' : 'id';
}

export async function setLanguage(lang: 'id' | 'en'): Promise<void> {
  await safeSet(KEY_LANGUAGE, lang);
}
