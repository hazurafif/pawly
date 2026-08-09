import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { useRepoData } from '../src/hooks/useRepoData';
import { getRepository } from '../src/db/db';
import { goBack } from '../src/lib/navigation';
import { confirmAction } from '../src/lib/confirm';
import { logPhoto } from '../src/lib/entries';
import { newId } from '../src/lib/id';
import { parseLocalDateInput } from '../src/lib/format';
import { Button, Card, ChipGroup } from '../src/components/ui';
import { DateField } from '../src/components/DateField';
import type { Pet } from '../src/db/types';
import { radius, spacing, type Palette } from '../src/lib/theme';
import { useAppColors } from '../src/hooks/useTheme';

const SEXES = ['male', 'female', 'unknown'] as const;
const NEUTERED = ['yes', 'no', 'unknown'] as const;

function labelsFor<T extends string>(t: (k: string) => string, prefix: string, values: readonly T[]) {
  return values.map((v) => ({ value: v, label: t(`${prefix}${v.charAt(0).toUpperCase()}${v.slice(1)}`) }));
}

export default function PetFormScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const petId = params.id ?? null;
  const editing = petId != null;

  const { data: existing } = useRepoData((r) =>
    petId ? r.getPet(petId) : Promise.resolve(null as Pet | null)
  );

  const [name, setName] = useState('');
  const [species, setSpecies] = useState('cat');
  const [sex, setSex] = useState('unknown');
  const [birthDate, setBirthDate] = useState('');
  const [rescueDate, setRescueDate] = useState('');
  const [neutered, setNeutered] = useState('unknown');
  const [story, setStory] = useState('');
  const [vetClinic, setVetClinic] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [existingPhotoUri, setExistingPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A stale-render double tap runs save twice and queues two GO_BACKs —
  // the second one is unhandled and warns. Guard the work, not the UI.
  const savingRef = useRef(false);

  // Seed the form once per pet. existing reloads on every data change
  // (including background sync pulls); reseeding mid-edit would wipe input.
  const [seededPetId, setSeededPetId] = useState<string | null>(null);

  useEffect(() => {
    if (existing && existing.id !== seededPetId) {
      setSeededPetId(existing.id);
      setName(existing.name);
      setSpecies(existing.species);
      setSex(existing.sex);
      setBirthDate(existing.birth_date ?? '');
      setRescueDate(existing.rescue_date ?? '');
      setNeutered(existing.is_neutered);
      setStory(existing.story ?? '');
      setVetClinic(existing.vet_clinic ?? '');
      // Show the current photo when editing so it can be replaced.
      void getRepository()
        .then((r) => r.latestPhotoForPet(existing.id))
        .then((p) => {
          if (p?.local_uri) {
            setPhotoUri(p.local_uri);
            setExistingPhotoUri(p.local_uri);
          }
        });
    }
  }, [existing, seededPetId]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const save = async () => {
    if (savingRef.current) {
      return;
    }
    savingRef.current = true;
    if (name.trim() === '') {
      setError(t('petForm.nameRequired'));
      savingRef.current = false;
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const repo = await getRepository();
      const now = new Date().toISOString();
      const base = existing ?? ({
        id: newId(),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      } as Partial<Pet>);
      const row: Pet = {
        id: base.id!,
        name: name.trim(),
        species,
        sex,
        birth_date: birthDate.trim() || null,
        birth_date_is_estimated: existing?.birth_date_is_estimated ?? 0,
        rescue_date: rescueDate.trim() || null,
        rescue_date_is_estimated: existing?.rescue_date_is_estimated ?? 0,
        is_neutered: neutered,
        story: story.trim() || null,
        status: existing?.status ?? 'alive',
        passed_away_date: existing?.passed_away_date ?? null,
        vet_clinic: vetClinic.trim() || null,
        created_at: base.created_at!,
        updated_at: now,
        deleted_at: null,
      };
      await repo.upsertLocal('pets', row);
      // Log a photo for new pets, or when the editing user picked a new one.
      if (photoUri && photoUri !== existingPhotoUri) {
        await logPhoto(repo, row.id, { uri: photoUri });
      }
      goBack(router);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save failed');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const remove = () => {
    confirmAction({
      title: t('common.confirmDelete'),
      message: t('petForm.deleteConfirm', { name }),
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
      onConfirm: () =>
        void getRepository()
          .then((repo) => repo.deletePetCascade(petId!))
          .then(() => goBack(router)),
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: editing ? t('petForm.title') : t('petForm.addPet') }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* Photo */}
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
            <Ionicons name="camera-outline" size={28} color={colors.primary} />
            <Text style={styles.photoHint}>{t('entry.addPhoto')}</Text>
          </View>
        )}
      </Pressable>

      <Card>
        <Text style={styles.label}>{t('petForm.name')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Miko"
          style={styles.input}
          accessibilityLabel={t('petForm.name')}
        />

        <Text style={styles.label}>{t('petForm.species')}</Text>
        <ChipGroup options={labelsFor(t, 'petForm.species', ['cat', 'dog', 'other'] as const)} value={species} onSelect={setSpecies} />

        <Text style={styles.label}>{t('petForm.sex')}</Text>
        <ChipGroup options={labelsFor(t, 'petForm.sex', SEXES)} value={sex} onSelect={setSex} />

        <Text style={styles.label}>{t('petForm.birthDate')}</Text>
        <DateField value={birthDate} onChange={setBirthDate} accessibilityLabel={t('petForm.birthDate')} placeholder={t('common.selectDate')} />
        <Text style={styles.hint}>{t('petForm.birthDateHint')}</Text>

        <Text style={styles.label}>{t('petForm.rescueDate')}</Text>
        <DateField value={rescueDate} onChange={setRescueDate} accessibilityLabel={t('petForm.rescueDate')} placeholder={t('common.selectDate')} />
        <Text style={styles.hint}>{t('petForm.rescueDateHint')}</Text>

        <Text style={styles.label}>{t('petForm.neutered')}</Text>
        <ChipGroup options={labelsFor(t, 'petForm.neutered', NEUTERED)} value={neutered} onSelect={setNeutered} />

        <Text style={styles.label}>{t('petForm.vetClinic')}</Text>
        <TextInput
          value={vetClinic}
          onChangeText={setVetClinic}
          style={styles.input}
          accessibilityLabel={t('petForm.vetClinic')}
        />

        <Text style={styles.label}>{t('petForm.story')}</Text>
        <TextInput
          value={story}
          onChangeText={setStory}
          multiline
          style={[styles.input, styles.multiline]}
          accessibilityLabel={t('petForm.story')}
        />
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label={t('common.save')} onPress={() => void save()} disabled={saving} icon="checkmark" />
      {editing ? (
        <View style={styles.deleteWrap}>
          <Button label={t('common.delete')} onPress={remove} variant="dangerGhost" icon="trash-outline" />
        </View>
      ) : null}
      </ScrollView>
    </>
  );
}

const createStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  photoButton: { alignItems: 'center', marginBottom: spacing.md },
  photoFallback: {
    width: 96,
    height: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  photoHint: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  photoPreview: { width: 96, height: 96, borderRadius: radius.lg },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
    minHeight: 46,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: colors.errorDeep, fontSize: 14, marginVertical: spacing.sm },
  deleteWrap: { marginTop: spacing.sm },
  pressed: { opacity: 0.7 },
});
