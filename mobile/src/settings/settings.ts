import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SERVER_URL = 'pawly.serverUrl';
const KEY_LANGUAGE = 'pawly.language';

export async function getServerUrl(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_SERVER_URL);
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
  await AsyncStorage.setItem(KEY_SERVER_URL, normalized);
}

export async function getLanguage(): Promise<'id' | 'en'> {
  const lang = await AsyncStorage.getItem(KEY_LANGUAGE);
  return lang === 'en' ? 'en' : 'id';
}

export async function setLanguage(lang: 'id' | 'en'): Promise<void> {
  await AsyncStorage.setItem(KEY_LANGUAGE, lang);
}
