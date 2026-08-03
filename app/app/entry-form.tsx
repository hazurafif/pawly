import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { useActivePet } from '../src/hooks/useActivePet';
import { getRepository } from '../src/db/db';
import { logEvent, logPhoto } from '../src/lib/entries';
import { LOGGABLE_KINDS, kindMeta } from '../src/lib/catalog';
import { Button, Card } from '../src/components/ui';
import type { Event } from '../src/db/types';
import { colors, radius, spacing } from '../src/lib/theme';

const SEVERITIES = ['mild', 'moderate', 'severe'] as const;
const MOODS = ['great', 'good', 'ok', 'low', 'bad'] as const;
const APPETITES = ['normal', 'low', 'high'] as const;

// What the primary "title" input means per kind.
const TITLE_LABEL: Record<string, string> = {
  milestone: 'entry.milestoneTitle',
  feed: 'entry.note',
  water: 'entry.note',
  walk: 'entry.note',
  potty: 'entry.note',
  visit: 'entry.note',
  photo: 'entry.note',
  med_given: 'entry.medName',
  symptom: 'entry.symptomName',
  vaccine: 'entry.antigen',
  checkin: 'entry.concerns',
};

export default function EntryFormScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const editingId = params.id ?? null;
  const [kind, setKind] = useState((params.kind ?? 'feed') as string);
  const { activePet } = useActivePet();

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [weight, setWeight] = useState('');
  const [dose, setDose] = useState('');
  const [severity, setSeverity] = useState('moderate');
  const [mood, setMood] = useState('good');
  const [appetite, setAppetite] = useState('normal');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit mode: load the event and prefill. (allEvents is the simplest
  // cross-pet lookup; events are few and this screen is modal.)
  useEffect(() => {
    if (!editingId) {
      return;
    }
    void getRepository().then(async (repo) => {
      const rows = await repo.allEvents();
      const found = rows.find((e) => e.id === editingId);
      if (!found) {
        return;
      }
      setKind(found.kind);
      setTitle(found.title ?? '');
      setText(found.text ?? '');
      if (found.data) {
        try {
          const d = JSON.parse(found.data) as Record<string, unknown>;
          if (typeof d.dose === 'string') setDose(d.dose);
          if (typeof d.severity === 'string') setSeverity(d.severity);
          if (typeof d.score === 'number') setMood(MOODS[Math.max(0, Math.min(MOODS.length - 1, d.score - 1))]);
          if (typeof d.appetite === 'string') setAppetite(d.appetite);
          if (typeof d.kg === 'number') setWeight(String(d.kg));
        } catch {
          // malformed payload — keep defaults
        }
      }
      const photos = await repo.photosForEvent(found.id);
      if (photos[0]?.local_uri) {
        setPhotoUri(photos[0].local_uri);
      }
    });
  }, [editingId]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const save = async () => {
    if (!activePet) {
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const repo = await getRepository();

      let data: Record<string, unknown> | null = null;
      if (kind === 'weight') {
        const kg = Number(weight);
        if (!weight.trim() || !Number.isFinite(kg) || kg <= 0) {
          setError(t('entry.weightKg'));
          return;
        }
        data = { kg };
      } else if (kind === 'vaccine' || kind === 'med_given') {
        data = dose.trim() ? { dose: dose.trim() } : {};
      } else if (kind === 'symptom') {
        data = { severity };
      } else if (kind === 'mood') {
        data = { score: MOODS.indexOf(mood as (typeof MOODS)[number]) + 1 };
      } else if (kind === 'checkin') {
        data = {
          score: MOODS.indexOf(mood as (typeof MOODS)[number]) + 1,
          appetite,
          ...(title.trim() ? { concerns: title.trim() } : {}),
        };
      }

      if (editingId) {
        const rows = await repo.allEvents();
        const found = rows.find((e) => e.id === editingId);
        if (found) {
          await repo.upsertLocal('events', {
            ...found,
            title: title.trim() || null,
            text: text.trim() || null,
            data: data ? JSON.stringify(data) : null,
            updated_at: new Date().toISOString(),
          });
        }
      } else {
        const event = await logEvent(repo, activePet.id, kind, {
          title: title.trim() || null,
          text: text.trim() || null,
          data,
        });
        if (photoUri) {
          await logPhoto(repo, activePet.id, { uri: photoUri, note: title.trim() || undefined });
        }
        void event;
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert(t('common.confirmDelete'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          void getRepository()
            .then((repo) => repo.softDelete('events', editingId!))
            .then(() => router.back()),
      },
    ]);
  };

  const chipRow = (values: readonly string[], selected: string, onSelect: (v: string) => void, labelPrefix: string) => (
    <View style={styles.chipRow}>
      {values.map((v) => (
        <Pressable
          key={v}
          onPress={() => onSelect(v)}
          accessibilityRole="button"
          accessibilityState={{ selected: v === selected }}
          style={({ pressed }) => [styles.chip, v === selected && styles.chipActive, pressed && styles.pressed]}
        >
          <Text style={[styles.chipText, v === selected && styles.chipTextActive]}>
            {t(`${labelPrefix}${v}` as never)}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!editingId ? (
        <Card>
          <Text style={styles.label}>{t('entry.kind')}</Text>
          <View style={styles.kindGrid}>
            {LOGGABLE_KINDS.map((k) => {
              const meta = kindMeta(k);
              const active = k === kind;
              return (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.kindItem,
                    active && styles.kindItemActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name={meta.icon as never} size={22} color={active ? colors.white : meta.color} />
                  <Text style={[styles.kindLabel, active && styles.kindLabelActive]}>
                    {t(`event.kinds.${k}` as never)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      <Card>
        {kind !== 'mood' ? (
          <>
            <Text style={styles.label}>{t(TITLE_LABEL[kind] ?? 'entry.note' as never)}</Text>
            <TextInput value={title} onChangeText={setTitle} style={styles.input} accessibilityLabel={t('entry.note')} />
          </>
        ) : null}

        {kind === 'weight' ? (
          <>
            <Text style={styles.label}>{t('entry.weightKg')}</Text>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="4.2"
              style={styles.input}
              accessibilityLabel={t('entry.weightKg')}
            />
          </>
        ) : null}

        {['vaccine', 'med_given'].includes(kind) ? (
          <>
            <Text style={styles.label}>{t('entry.dose')}</Text>
            <TextInput value={dose} onChangeText={setDose} style={styles.input} accessibilityLabel={t('entry.dose')} />
          </>
        ) : null}

        {kind === 'symptom' ? (
          <>
            <Text style={styles.label}>{t('entry.severity')}</Text>
            {chipRow(SEVERITIES, severity, setSeverity, 'entry.severity')}
          </>
        ) : null}

        {['mood', 'checkin'].includes(kind) ? (
          <>
            <Text style={styles.label}>{t('entry.moodLabel')}</Text>
            {chipRow(MOODS, mood, setMood, 'mood.')}
          </>
        ) : null}

        {kind === 'checkin' ? (
          <>
            <Text style={styles.label}>{t('entry.appetite')}</Text>
            {chipRow(APPETITES, appetite, setAppetite, 'entry.appetite')}
          </>
        ) : null}

        {kind !== 'mood' && kind !== 'checkin' ? (
          <>
            <Text style={[styles.label, { marginTop: spacing.md }]}>{t('entry.note')}</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              style={[styles.input, styles.multiline]}
              accessibilityLabel={t('entry.note')}
            />
          </>
        ) : null}

        {kind === 'photo' || photoUri ? (
          <Pressable
            onPress={() => void pickPhoto()}
            accessibilityRole="button"
            accessibilityLabel={t('entry.addPhoto')}
            style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} accessibilityIgnoresInvertColors />
            ) : (
              <View style={styles.photoFallback}>
                <Ionicons name="camera-outline" size={24} color={colors.primary} />
                <Text style={styles.photoHint}>{t('entry.addPhoto')}</Text>
              </View>
            )}
          </Pressable>
        ) : null}
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label={t('common.save')} onPress={() => void save()} disabled={saving || !activePet} icon="checkmark" />
      {editingId ? <Button label={t('entry.deleteEntry')} onPress={remove} variant="danger" icon="trash-outline" /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  kindGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kindItem: {
    width: '30%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
  },
  kindItemActive: { backgroundColor: colors.primary },
  kindLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  kindLabelActive: { color: colors.white },
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
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.sm },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white },
  photoButton: { alignItems: 'center', marginVertical: spacing.sm },
  photoFallback: {
    width: 120,
    height: 96,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  photoHint: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  photoPreview: { width: 160, height: 120, borderRadius: radius.md },
  error: { color: colors.error, fontSize: 14, marginVertical: spacing.sm },
  pressed: { opacity: 0.7 },
});
