import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Stack } from 'expo-router';
import { getLanguage, getServerUrl, setLanguage, setServerUrl } from '../src/settings/settings';
import { setAppLanguage } from '../src/i18n';
import { useSync } from '../src/hooks/useSync';
import { colors, radius, shadow, spacing } from '../src/lib/theme';

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

  const syncing = status.state === 'syncing';
  const lastSync = status.lastSync
    ? t('settings.synced', { time: new Date(status.lastSync).toLocaleTimeString() })
    : t('settings.never');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <Section icon="server-outline" title={t('settings.serverUrl')}>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder={t('settings.serverUrlHint')}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </Section>

      <Section icon="language-outline" title={t('settings.language')}>
        <View style={styles.row}>
          {(['id', 'en'] as const).map((l) => (
            <Pressable
              key={l}
              style={[styles.chip, lang === l && styles.chipActive]}
              onPress={() => setLang(l)}
            >
              <Text style={[styles.chipText, lang === l && styles.chipTextActive]}>
                {l === 'id' ? 'Bahasa Indonesia' : 'English'}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Pressable
        style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
        onPress={() => void save()}
      >
        <Ionicons name="checkmark" size={18} color={colors.white} />
        <Text style={styles.saveButtonText}>{t('common.save')}</Text>
      </Pressable>
      {saved && (
        <View style={styles.savedBanner}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.savedText}>{t('settings.saved')}</Text>
        </View>
      )}

      <Section icon="sync-outline" title={t('settings.syncStatus')}>
        <View style={styles.syncRow}>
          <View
            style={[styles.statusDot, { backgroundColor: status.state === 'error' ? colors.error : colors.success }]}
          />
          {syncing ? (
            <>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.hint}>{t('settings.syncing')}</Text>
            </>
          ) : (
            <Text style={[styles.hint, status.state === 'error' && styles.errorText]}>
              {status.state === 'error' ? t('settings.serverOffline') : lastSync}
            </Text>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.syncButton, pressed && styles.syncButtonPressed]}
          onPress={() => void syncNow()}
          disabled={syncing}
        >
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={styles.syncButtonText}>{t('settings.sync')}</Text>
        </Pressable>
      </Section>
    </ScrollView>
  );
}

function Section({ icon, title, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; children: React.ReactNode }) {
  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={16} color={colors.primary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
  },
  saveButtonPressed: { backgroundColor: colors.primaryDark },
  saveButtonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    paddingVertical: 10,
  },
  savedText: { color: colors.success, fontWeight: '600', fontSize: 14 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: radius.pill },
  hint: { color: colors.textMuted, fontSize: 14, flexShrink: 1 },
  errorText: { color: colors.error },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 11,
    marginTop: spacing.md,
  },
  syncButtonPressed: { backgroundColor: colors.primarySoft },
  syncButtonText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});
