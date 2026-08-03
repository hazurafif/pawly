import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Directory, File, Paths } from 'expo-file-system';
import { useSync } from '../src/hooks/useSync';
import { useActivePet } from '../src/hooks/useActivePet';
import { getRepository } from '../src/db/db';
import { getLanguage, getServerUrl, setLanguage, setServerUrl } from '../src/settings/settings';
import { setAppLanguage } from '../src/i18n';
import { Button, Card, EmptyState, SectionHeader } from '../src/components/ui';
import { colors, radius, spacing } from '../src/lib/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { status, syncNow } = useSync();
  const { pets, activePet } = useActivePet();

  const [serverUrl, setServerUrlText] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    void getServerUrl().then((v) => setServerUrlText(v ?? ''));
    void getLanguage().then((l) => setAppLanguage(l));
  }, []);

  const saveServer = async () => {
    setServerError(null);
    try {
      await setServerUrl(serverUrl);
      await syncNow();
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'invalid');
    }
  };

  const exportData = async () => {
    const repo = await getRepository();
    const dump = {
      exported_at: new Date().toISOString(),
      pets: await repo.allPets(),
      events: await repo.allEvents(),
      photos: await repo.photosForPet(activePet?.id ?? '') ?? [],
      reminder_rules: await repo.allRules(),
    };
    const json = JSON.stringify(dump, null, 2);
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pawly-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const dir = new Directory(Paths.cache);
      dir.create({ intermediates: true, idempotent: true });
      const file = new File(Paths.cache, 'pawly-export.json');
      await file.write(json);
      Alert.alert(t('settings.exportJson'), file.uri);
    }
  };

  const removePet = (id: string, name: string) => {
    Alert.alert(t('common.confirmDelete'), t('petForm.deleteConfirm', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          void getRepository()
            .then((repo) => repo.deletePetCascade(id))
            .then(() => syncNow()),
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: t('settings.title') }} />

      {/* Pets */}
      <SectionHeader
        icon="paw-outline"
        title={t('settings.pets')}
        action={{ label: t('common.add'), onPress: () => router.push('/pet-form') }}
      />
      <Card>
        {pets.length === 0 ? (
          <EmptyState icon="paw-outline" text={t('home.petsEmpty')} />
        ) : (
          pets.map((pet) => (
            <View key={pet.id} style={styles.petRow}>
              <Pressable
                onPress={() => router.push(`/pet-form?id=${pet.id}`)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.petMain, pressed && styles.pressed]}
              >
                <View style={styles.petIcon}>
                  <Ionicons name="paw" size={16} color={colors.primary} />
                </View>
                <View style={styles.petInfo}>
                  <Text style={styles.petName}>{pet.name}</Text>
                  <Text style={styles.petSub}>{pet.species}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.border} />
              </Pressable>
              <Pressable
                onPress={() => removePet(pet.id, pet.name)}
                accessibilityRole="button"
                accessibilityLabel={t('common.delete')}
                hitSlop={8}
                style={({ pressed }) => [styles.deleteIcon, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          ))
        )}
      </Card>

      {/* Sync */}
      <SectionHeader icon="sync-outline" title={t('settings.syncStatus')} />
      <Card>
        <View style={styles.syncRow}>
          <View style={[styles.dot, { backgroundColor: status.state === 'error' ? colors.error : colors.success }]} />
          <Text style={styles.syncText}>
            {status.state === 'error'
              ? t('settings.serverOffline')
              : status.lastSync
                ? t('settings.synced', { time: new Date(status.lastSync).toLocaleTimeString() })
                : t('settings.never')}
          </Text>
        </View>
        <Text style={styles.label}>{t('settings.serverUrl')}</Text>
        <TextInput
          value={serverUrl}
          onChangeText={setServerUrlText}
          placeholder={t('settings.serverUrlHint')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel={t('settings.serverUrl')}
        />
        {serverError ? <Text style={styles.error}>{serverError}</Text> : null}
        <Button label={t('settings.sync')} onPress={() => void saveServer()} icon="refresh" />
      </Card>

      {/* Backup */}
      <SectionHeader icon="archive-outline" title={t('settings.backup')} />
      <Card>
        <Text style={styles.hint}>{t('settings.exportHint')}</Text>
        <Button label={t('settings.exportJson')} onPress={() => void exportData()} variant="secondary" icon="download-outline" />
      </Card>

      {/* Language */}
      <SectionHeader icon="language-outline" title={t('settings.language')} />
      <Card style={styles.langRow}>
        {(['id', 'en'] as const).map((lang) => (
          <Pressable
            key={lang}
            onPress={() => void setAppLanguage(lang)}
            accessibilityRole="button"
            accessibilityState={{ selected: true }}
            style={({ pressed }) => [styles.langButton, pressed && styles.pressed]}
          >
            <Text style={styles.langText}>{lang === 'id' ? 'Bahasa Indonesia' : 'English'}</Text>
          </Pressable>
        ))}
      </Card>

      <Text style={styles.version}>{t('settings.about')} · Pawly 2.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  petRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  petMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  petIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petInfo: { flex: 1 },
  petName: { fontSize: 15, fontWeight: '700', color: colors.text },
  petSub: { fontSize: 12, color: colors.textMuted },
  deleteIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  syncText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
    minHeight: 46,
    marginBottom: spacing.sm,
  },
  error: { color: colors.error, fontSize: 13, marginBottom: spacing.sm },
  langRow: { flexDirection: 'row', gap: spacing.sm },
  langButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  langText: { fontSize: 14, fontWeight: '600', color: colors.text },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: spacing.xl },
  pressed: { opacity: 0.7 },
});
