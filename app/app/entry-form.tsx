import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { useActivePet } from '../src/hooks/useActivePet';
import { useRepoData } from '../src/hooks/useRepoData';
import { getRepository } from '../src/db/db';
import { goBack } from '../src/lib/navigation';
import { confirmAction } from '../src/lib/confirm';
import { logEvent, logPhoto } from '../src/lib/entries';
import { APPETITE_VALUES, MOOD_VALUES, PICK_GROUPS, kindMeta } from '../src/lib/catalog';
import { Button, Card, ChipGroup } from '../src/components/ui';
import { DateField } from '../src/components/DateField';
import {
  CarePresets,
  FieldLabel,
  KindHero,
  MoodEmojiPicker,
  PhotoPicker,
  SeverityPicker,
  WeightField,
} from '../src/components/entry-fields';
import { dayKeyOfIso, parseLocalDateInput, weightKg } from '../src/lib/format';
import { radius, spacing, type Palette } from '../src/lib/theme';
import { useAppColors } from '../src/hooks/useTheme';
import type { Event } from '../src/db/types';

const CARE_KINDS = ['feed', 'water', 'walk', 'potty'];

export default function EntryFormScreen() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; kind?: string; title?: string }>();
  const editingId = params.id ?? null;
  // A kind preselected by another screen (?kind=) or an edit fixes the form;
  // otherwise the Journal flow shows the picker grid first.
  const [kind, setKind] = useState((params.kind ?? 'feed') as string);
  const [kindChosen, setKindChosen] = useState(Boolean(params.kind || editingId));
  const { activePet } = useActivePet();
  const petId = activePet?.id ?? null;

  const [title, setTitle] = useState((params.title ?? '') as string);
  const [text, setText] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [weight, setWeight] = useState('');
  const [dose, setDose] = useState('');
  const [severity, setSeverity] = useState('moderate');
  const [mood, setMood] = useState('good');
  const [appetite, setAppetite] = useState('normal');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A stale-render double tap runs save twice and queues two GO_BACKs —
  // the second one is unhandled and warns. Guard the work, not the UI.
  const savingRef = useRef(false);

  // Context for the weight form: the most recent weight other than the row
  // being edited, so the live delta compares against the true previous one.
  const { data: recentWeights } = useRepoData((r) =>
    petId ? r.eventsForPet(petId, { kinds: ['weight'], limit: 3 }) : Promise.resolve([] as Event[])
  );
  const lastWeightKg = useMemo(() => {
    const rows = recentWeights ?? [];
    const row = rows.find((w) => w.id !== editingId) ?? rows[0];
    return row ? weightKg(row.data) : null;
  }, [recentWeights, editingId]);

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
      setOccurredAt(found.occurred_at.slice(0, 10));
      if (found.data) {
        try {
          const d = JSON.parse(found.data) as Record<string, unknown>;
          if (typeof d.dose === 'string') setDose(d.dose);
          if (typeof d.severity === 'string') setSeverity(d.severity);
          if (typeof d.score === 'number') setMood(MOOD_VALUES[Math.max(0, Math.min(MOOD_VALUES.length - 1, d.score - 1))]);
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
    if (savingRef.current) {
      return;
    }
    if (!activePet) {
      return;
    }
    savingRef.current = true;
    setError(null);
    setSaving(true);
    try {
      const repo = await getRepository();

      // Empty means "now"; a filled value must be a real calendar date.
      let occurredAtIso: string | undefined;
      if (occurredAt.trim()) {
        const parsed = parseLocalDateInput(occurredAt);
        if (!parsed) {
          setError(t('entry.occurredAtInvalid'));
          return;
        }
        // Local noon: converting to UTC never shifts the calendar day.
        occurredAtIso = parsed;
      }

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
        data = { score: MOOD_VALUES.indexOf(mood as (typeof MOOD_VALUES)[number]) + 1 };
      } else if (kind === 'checkin') {
        // One check-in per pet per day: block a second entry on the same
        // calendar day (including backdated ones), unless it's the row
        // being edited.
        const day = dayKeyOfIso(occurredAtIso ?? new Date().toISOString());
        const checkins = await repo.eventsForPet(activePet.id, { kinds: ['checkin'] });
        const duplicate = checkins.find(
          (c) => c.id !== editingId && dayKeyOfIso(c.occurred_at) === day
        );
        if (duplicate) {
          setError(t('entry.checkinExists'));
          return;
        }
        data = {
          score: MOOD_VALUES.indexOf(mood as (typeof MOOD_VALUES)[number]) + 1,
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
            occurred_at: occurredAtIso ?? found.occurred_at,
            updated_at: new Date().toISOString(),
          });
        }
      } else {
        const event = await logEvent(repo, activePet.id, kind, {
          title: title.trim() || null,
          text: text.trim() || null,
          data,
          occurredAt: occurredAtIso,
        });
        if (photoUri) {
          await logPhoto(repo, activePet.id, { uri: photoUri, note: title.trim() || undefined });
        }
        void event;
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
      confirmLabel: t('common.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
      onConfirm: () =>
        void getRepository()
          .then((repo) => repo.softDelete('events', editingId!))
          .then(() => goBack(router)),
    });
  };

  const noteInput = (multiline = false) => (
    <TextInput
      value={text}
      onChangeText={setText}
      multiline={multiline}
      style={[styles.input, multiline && styles.multiline]}
      accessibilityLabel={t('entry.note')}
    />
  );

  return (
    <>
      <Stack.Screen options={{ title: editingId ? t('entry.editTitle') : t('entry.title') }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Kind picker: Journal flow only. Other screens preselect via ?kind=. */}
        {!kindChosen ? (
          <Card>
            <Text style={styles.pickTitle}>
              {t('entry.pickHint', { name: activePet?.name ?? '' })}
            </Text>
            {PICK_GROUPS.map((group) => (
              <View key={group.key} style={styles.group}>
                <Text style={styles.groupTitle}>
                  {t(`entry.pickGroup${group.key.charAt(0).toUpperCase()}${group.key.slice(1)}` as never)}
                </Text>
                <View style={styles.kindGrid}>
                  {group.kinds.map((k) => {
                    const meta = kindMeta(k);
                    return (
                      <Pressable
                        key={k}
                        onPress={() => {
                          setKind(k);
                          setKindChosen(true);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t(`event.kinds.${k}` as never)}
                        style={({ pressed }) => [styles.kindItem, pressed && styles.pressed]}
                      >
                        <View style={[styles.kindIcon, { backgroundColor: meta.color + '22' }]}>
                          <Ionicons name={meta.icon as never} size={20} color={meta.color} />
                        </View>
                        <View style={styles.kindInfo}>
                          <Text style={styles.kindLabel}>{t(`event.kinds.${k}` as never)}</Text>
                          <Text style={styles.kindDesc} numberOfLines={1}>
                            {t(`entry.hero.${k}` as never)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {kindChosen ? <KindHero kind={kind} /> : null}

        <Card>
          {kindChosen ? (
            <>
              {/* ── weight: big kg input + last-record context ── */}
              {kind === 'weight' ? <WeightField value={weight} onChange={setWeight} lastKg={lastWeightKg} /> : null}

              {/* ── everyday care: quick-note presets + one note field ── */}
              {kind === 'feed' || kind === 'walk' ? (
                <View style={styles.field}>
                  <CarePresets kind={kind} note={title} onPick={setTitle} />
                </View>
              ) : null}
              {CARE_KINDS.includes(kind) ? (
                <View style={styles.field}>
                  <FieldLabel>{t('entry.note')}</FieldLabel>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    style={styles.input}
                    accessibilityLabel={t('entry.note')}
                  />
                </View>
              ) : null}

              {/* ── mood / check-in: emoji picker ── */}
              {kind === 'mood' || kind === 'checkin' ? (
                <View style={styles.field}>
                  <FieldLabel>{t('entry.moodLabel')}</FieldLabel>
                  <MoodEmojiPicker value={mood} onChange={setMood} />
                </View>
              ) : null}
              {kind === 'mood' ? (
                <View style={styles.field}>
                  <FieldLabel>{t('entry.note')}</FieldLabel>
                  {noteInput(true)}
                </View>
              ) : null}
              {kind === 'checkin' ? (
                <>
                  <View style={styles.field}>
                    <FieldLabel>{t('entry.appetite')}</FieldLabel>
                    <ChipGroup
                      options={APPETITE_VALUES.map((v) => ({
                        value: v,
                        label: t(`entry.appetite${v.charAt(0).toUpperCase()}${v.slice(1)}` as never),
                      }))}
                      value={appetite}
                      onSelect={setAppetite}
                    />
                  </View>
                  <View style={styles.field}>
                    <FieldLabel>{t('entry.concerns')}</FieldLabel>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      multiline
                      style={[styles.input, styles.multiline]}
                      accessibilityLabel={t('entry.concerns')}
                    />
                  </View>
                </>
              ) : null}

              {/* ── symptom: colored severity picker ── */}
              {kind === 'symptom' ? (
                <>
                  <View style={styles.field}>
                    <FieldLabel>{t('entry.severity')}</FieldLabel>
                    <SeverityPicker value={severity} onChange={setSeverity} />
                  </View>
                  <View style={styles.field}>
                    <FieldLabel>{t('entry.symptomName')}</FieldLabel>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      style={styles.input}
                      accessibilityLabel={t('entry.symptomName')}
                    />
                  </View>
                  <View style={styles.field}>
                    <FieldLabel>{t('entry.note')}</FieldLabel>
                    {noteInput(true)}
                  </View>
                </>
              ) : null}

              {/* ── vaccine / med given: name + dose + note ── */}
              {kind === 'vaccine' || kind === 'med_given' ? (
                <>
                  <View style={styles.field}>
                    <FieldLabel>{t(kind === 'vaccine' ? 'entry.antigen' : 'entry.medName' as never)}</FieldLabel>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      style={styles.input}
                      accessibilityLabel={t(kind === 'vaccine' ? 'entry.antigen' : 'entry.medName' as never)}
                    />
                  </View>
                  <View style={styles.field}>
                    <FieldLabel>{t('entry.dose')}</FieldLabel>
                    <TextInput
                      value={dose}
                      onChangeText={setDose}
                      style={styles.input}
                      accessibilityLabel={t('entry.dose')}
                    />
                  </View>
                  <View style={styles.field}>
                    <FieldLabel>{t('entry.note')}</FieldLabel>
                    {noteInput(true)}
                  </View>
                </>
              ) : null}

              {/* ── vet visit: reason + details ── */}
              {kind === 'visit' ? (
                <>
                  <View style={styles.field}>
                    <FieldLabel>{t('entry.note')}</FieldLabel>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      style={styles.input}
                      accessibilityLabel={t('entry.note')}
                    />
                  </View>
                  <View style={styles.field}>
                    <FieldLabel>{t('entry.details')}</FieldLabel>
                    {noteInput(true)}
                  </View>
                </>
              ) : null}

              {/* ── milestone / photo: memory capture ── */}
              {kind === 'milestone' || kind === 'photo' ? (
                <>
                  {kind === 'photo' ? (
                    <PhotoPicker uri={photoUri} onPick={() => void pickPhoto()} label={t('entry.addPhoto')} />
                  ) : null}
                  <View style={styles.field}>
                    <FieldLabel>{t(kind === 'milestone' ? 'entry.milestoneTitle' : 'entry.note' as never)}</FieldLabel>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      style={styles.input}
                      accessibilityLabel={t(kind === 'milestone' ? 'entry.milestoneTitle' : 'entry.note' as never)}
                    />
                  </View>
                  {kind === 'milestone' ? (
                    <View style={styles.field}>
                      <FieldLabel>{t('entry.note')}</FieldLabel>
                      {noteInput(true)}
                    </View>
                  ) : null}
                </>
              ) : null}

              {/* photo attached on other kinds (editing) */}
              {photoUri && kind !== 'photo' && kind !== 'milestone' ? (
                <PhotoPicker uri={photoUri} onPick={() => void pickPhoto()} label={t('entry.addPhoto')} />
              ) : null}

            </>
          ) : null}
          <Text style={[styles.label, { marginTop: spacing.md }]}>{t('entry.occurredAt')}</Text>
          <DateField
            value={occurredAt}
            onChange={setOccurredAt}
            accessibilityLabel={t('entry.occurredAt')}
            placeholder={dayKeyOfIso(new Date().toISOString()) ?? ''}
          />
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label={t('common.save')} onPress={() => void save()} disabled={saving || !activePet} icon="checkmark" />
        {editingId ? <Button label={t('entry.deleteEntry')} onPress={remove} variant="danger" icon="trash-outline" /> : null}
      </ScrollView>
    </>
  );
}

const createStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  pickTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  group: { marginBottom: spacing.md },
  groupTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  field: { marginBottom: spacing.md },
  kindGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kindItem: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  kindIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  kindInfo: { flex: 1, minWidth: 0 },
  kindLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  kindDesc: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
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
  hint: { fontSize: 12, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.sm },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: colors.errorDeep, fontSize: 14, marginVertical: spacing.sm },
  pressed: { opacity: 0.7 },
});
