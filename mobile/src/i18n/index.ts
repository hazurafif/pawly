import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import id from './id.json';
import en from './en.json';

i18n.use(initReactI18next).init({
  resources: {
    id: { translation: id },
    en: { translation: en },
  },
  lng: 'id',
  fallbackLng: 'id',
  interpolation: { escapeValue: false },
});

export function detectLanguage(): 'id' | 'en' {
  const locale = getLocales()[0]?.languageCode ?? 'id';
  return locale === 'en' ? 'en' : 'id';
}

export async function setAppLanguage(lang: 'id' | 'en'): Promise<void> {
  await i18n.changeLanguage(lang);
}

export default i18n;
