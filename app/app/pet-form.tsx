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
import { useRepoData } from '../src/hooks/useRepoData';
import { getRepository } from '../src/db/db';
import { goBack } from '../src/lib/navigation';
import { logPhoto } from '../src/lib/entries';
import { newId } from '../src/lib/id';
import { Button, Card } from '../src/components/ui';
import type { Pet } from '../src/db/types';
import { colors, radius, spacing } from '../src/lib/theme';

const SEXES = ['male', 'female', 'unknown'] as const;
const NEUTERED = ['yes', 'no', 'unknown'] as const;

function chipOptions<T extends string>(t: (k: string) => string, prefix: string, values: readonly T[]) {
  return values.map((v) => ({
    value: v,
    label: t(`${prefix}${v.charAt(0).toUpperCase()}${v.slice(1)}`),
  }));
}

export default function PetFormScreen() {
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setSpecies(existing.species);
      setSex(existing.sex);
      setBirthDate(existing.birth_date ?? '');
      setRescueDate(existing.rescue_date ?? '');
      setNeutered(existing.is_neutered);
      setStory(existing.story ?? '');
      setVetClinic(existing.vet_clinic ?? '');
    }
  }, [existing]);

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
    if (name.trim() === '') {
      setError(t('petForm.nameRequired'));
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
      if (photoUri && !editing) {
        await logPhoto(repo, row.id, { uri: photoUri });
      }
      goBack(router);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    Alert.alert(t('common.confirmDelete'), t('petForm.deleteConfirm', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          void getRepository()
            .then((repo) => repo.deletePetCascade(petId!))
            .then(() => goBack(router)),
      },
    ]);
  };

  const pickerRow = (values: { value: string; label: string }[], selected: string, onSelect: (v: string) => void) => (
    <View style={styles.chipRow}>
      {values.map((v) => (
        <Pressable
          key={v.value}
          onPress={() => onSelect(v.value)}
          accessibilityRole="button"
          accessibilityState={{ selected: v.value === selected }}
          style={({ pressed }) => [
            styles.chip,
            v.value === selected && styles.chipActive,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.chipText, v.value === selected && styles.chipTextActive]}>{v.label}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>{editing ? t('petForm.title') : t('petForm.addPet')}</Text>

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
        {pickerRow(chipOptions(t, 'petForm.species', ['cat', 'dog', 'other'] as const), species, setSpecies)}

        <Text style={styles.label}>{t('petForm.sex')}</Text>
        {pickerRow(chipOptions(t, 'petForm.sex', SEXES), sex, setSex)}

        <Text style={styles.label}>{t('petForm.birthDate')}</Text>
        <TextInput
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="2024-03-15"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={t('petForm.birthDate')}
        />
        <Text style={styles.hint}>{t('petForm.birthDateHint')}</Text>

        <Text style={styles.label}>{t('petForm.rescueDate')}</Text>
        <TextInput
          value={rescueDate}
          onChangeText={setRescueDate}
          placeholder="2024-05-01"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={t('petForm.rescueDate')}
        />
        <Text style={styles.hint}>{t('petForm.rescueDateHint')}</Text>

        <Text style={styles.label}>{t('petForm.neutered')}</Text>
        {pickerRow(chipOptions(t, 'petForm.neutered', NEUTERED), neutered, setNeutered)}

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
        <Button label={t('common.delete')} onPress={remove} variant="danger" icon="trash-outline" />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  heading: { fontSize: 22, fontWeight: '800', color: colors.text, marginVertical: spacing.md },
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
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primaryDeep },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white },
  error: { color: colors.errorDeep, fontSize: 14, marginVertical: spacing.sm },
  pressed: { opacity: 0.7 },
});
