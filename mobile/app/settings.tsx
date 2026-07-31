import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { getLanguage, getServerUrl, setLanguage, setServerUrl } from '../src/settings/settings';
import { setAppLanguage } from '../src/i18n';
import { useSync } from '../src/hooks/useSync';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { status, syncNow } = useSync();
  const [url, setUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [lang, setLang] = useState<'id' | 'en'>('id');

  useEffect(() => {
    void (async () => {
      setUrl((await getServerUrl()) ?? '');
      setLang(await getLanguage());
    })();
  }, []);

  const save = async () => {
    try {
      await setServerUrl(url);
      await setLanguage(lang);
      await setAppLanguage(lang);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaved(false);
    }
  };

  const lastSync = status.lastSync
    ? t('settings.synced', { time: new Date(status.lastSync).toLocaleTimeString() })
    : t('settings.never');

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('settings.serverUrl')}</Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder={t('settings.serverUrlHint')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <Text style={styles.label}>{t('settings.language')}</Text>
      <View style={styles.row}>
        {(['id', 'en'] as const).map((l) => (
          <Pressable
            key={l}
            style={[styles.chip, lang === l && styles.chipActive]}
            onPress={() => setLang(l)}
          >
            <Text style={lang === l ? styles.chipActiveText : undefined}>
              {l === 'id' ? 'Bahasa Indonesia' : 'English'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.button} onPress={() => void save()}>
        <Text style={styles.buttonText}>{t('common.save')}</Text>
      </Pressable>
      {saved && <Text style={styles.hint}>{t('settings.saved')}</Text>}

      <Text style={styles.label}>{t('settings.syncStatus')}</Text>
      {status.state === 'syncing' ? (
        <ActivityIndicator />
      ) : (
        <Text style={styles.hint}>
          {status.state === 'error' ? t('settings.serverOffline') : lastSync}
        </Text>
      )}
      <Pressable style={styles.button} onPress={() => void syncNow()}>
        <Text style={styles.buttonText}>{t('settings.sync')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: '#ccc' },
  chipActive: { backgroundColor: '#4a6cf7', borderColor: '#4a6cf7' },
  chipActiveText: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: '#4a6cf7', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  hint: { color: '#666', fontSize: 13 },
});
