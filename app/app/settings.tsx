import { useEffect, useMemo, useState } from 'react';
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
import { autoDetectEnabled, getLanguage, getServerUrl, setLanguage, setServerUrl } from '../src/settings/settings';
import { discoverServerUrl } from '../src/lib/server';
import { confirmAction } from '../src/lib/confirm';
import { setAppLanguage } from '../src/i18n';
import { Button, Card, EmptyState, SectionHeader } from '../src/components/ui';
import { radius, spacing, typeScale, type M3Roles, type Palette } from '../src/lib/theme';
import { useAppColors, useStyles } from '../src/hooks/useTheme';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles(createStyles);
  const router = useRouter();
  const { status, syncNow } = useSync();
  const { pets, activePet } = useActivePet();

  const [serverUrl, setServerUrlText] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [autoDetecting, setAutoDetecting] = useState(false);

  useEffect(() => {
    void getServerUrl().then((v) => setServerUrlText(v ?? ''));
    void getLanguage().then((l) => setAppLanguage(l));
    // No server configured anywhere — look for one on the LAN and adopt it.
    void (async () => {
      if (await getServerUrl()) {
        return;
      }
      if (!autoDetectEnabled()) {
        return;
      }
      setAutoDetecting(true);
      const found = await discoverServerUrl();
      setAutoDetecting(false);
      if (found) {
        setServerUrlText(found);
        await syncNow();
      }
    })();
  }, [syncNow]);

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
    confirmAction({
      title: t('common.confirmDelete'),
      message: t('petForm.deleteConfirm', { name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
      onConfirm: () =>
        void getRepository()
          .then((repo) => repo.deletePetCascade(id))
          .then(() => syncNow()),
    });
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
        {autoDetecting ? <Text style={styles.hint}>{t('settings.autoDetect')}</Text> : null}
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
        {(['id', 'en'] as const).map((lang) => {
          const selected = i18n.language === lang;
          return (
            <Pressable
              key={lang}
              onPress={() => {
                void setLanguage(lang);
                void setAppLanguage(lang);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.langButton,
                selected && styles.langButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.langText, selected && styles.langTextActive]}>
                {lang === 'id' ? 'Bahasa Indonesia' : 'English'}
              </Text>
            </Pressable>
          );
        })}
      </Card>

      <Text style={styles.version}>{t('settings.about')} · Pawly 2.0</Text>
    </ScrollView>
  );
}

const createStyles = (colors: Palette, roles: M3Roles) => StyleSheet.create({
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
  petName: { fontSize: 15, fontFamily: 'Roboto_700Bold', color: colors.text },
  petSub: { fontFamily: 'Roboto_400Regular', fontSize: 12, color: colors.textMuted },
  deleteIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  syncText: { fontSize: 14, color: colors.textMuted, fontFamily: 'Roboto_500Medium' },
  label: { fontSize: typeScale.labelLarge.fontSize, lineHeight: typeScale.labelLarge.lineHeight, fontFamily: typeScale.labelLarge.fontFamily, color: roles.onSurface, marginTop: spacing.md, marginBottom: spacing.xs },
  hint: { fontFamily: 'Roboto_400Regular', fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  input: {
    backgroundColor: roles.surfaceContainerHigh,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: roles.outlineVariant,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontFamily: 'Roboto_400Regular', fontSize: 15,
    color: colors.text,
    minHeight: 46,
    marginBottom: spacing.sm,
  },
  error: { color: colors.errorDeep, fontFamily: 'Roboto_400Regular', fontSize: 13, marginBottom: spacing.sm },
  langRow: { flexDirection: 'row', gap: spacing.sm },
  langButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: roles.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  langButtonActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  langText: { fontSize: 14, fontFamily: 'Roboto_500Medium', color: colors.textMuted },
  langTextActive: { color: colors.primaryDeep, fontFamily: 'Roboto_700Bold' },
  version: { textAlign: 'center', color: colors.textMuted, fontFamily: 'Roboto_400Regular', fontSize: 12, marginTop: spacing.xl },
  pressed: { opacity: 0.7 },
});
