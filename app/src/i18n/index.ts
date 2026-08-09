import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { getLanguage } from '../settings/settings';
import id from './id.json';
import en from './en.json';

i18n.use(initReactI18next).init({
  resources: {
    id: { translation: id },
    en: { translation: en },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// restore the stored language on startup (defaults to en)
void getLanguage().then((lang) => i18n.changeLanguage(lang));

export function detectLanguage(): 'id' | 'en' {
  const locale = getLocales()[0]?.languageCode;
  return locale === 'id' ? 'id' : 'en';
}

export async function setAppLanguage(lang: 'id' | 'en'): Promise<void> {
  await i18n.changeLanguage(lang);
}

export default i18n;
