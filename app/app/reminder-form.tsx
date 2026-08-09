import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useActivePet } from '../src/hooks/useActivePet';
import { useRepoData } from '../src/hooks/useRepoData';
import { getRepository } from '../src/db/db';
import { goBack } from '../src/lib/navigation';
import { confirmAction } from '../src/lib/confirm';
import { newId } from '../src/lib/id';
import { isIsoDateInput } from '../src/lib/format';
import { RULE_KINDS, ruleKindMeta } from '../src/lib/catalog';
import { Button, Card, ChipGroup } from '../src/components/ui';
import { DateField } from '../src/components/DateField';
import type { ReminderRule } from '../src/db/types';
import { radius, spacing, type Palette } from '../src/lib/theme';
import { useAppColors } from '../src/hooks/useTheme';

const REPEATS = ['once', 'daily', 'weekly', 'monthly'] as const;

export default function ReminderFormScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const ruleId = params.id ?? null;
  const editing = ruleId != null;
  const { activePet } = useActivePet();

  const [kind, setKind] = useState((params.kind ?? 'vaccine') as string);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [repeat, setRepeat] = useState('once');
  const [dose, setDose] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A stale-render double tap runs save twice and queues two GO_BACKs —
  // the second one is unhandled and warns. Guard the work, not the UI.
  const savingRef = useRef(false);

  const { data: rules } = useRepoData((r) => r.allRules());

  // Seed the form once per rule; `rules` reloads on every data change
  // (including background sync pulls), reseeding mid-edit would wipe input.
  const seededRuleRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ruleId || !rules || seededRuleRef.current === ruleId) {
      return;
    }
    const found = rules.find((r) => r.id === ruleId);
    if (found) {
      seededRuleRef.current = ruleId;
      setKind(found.kind);
      setTitle(found.title);
      setDue(found.due.slice(0, 10));
      setRepeat(found.repeat);
      setDose(found.dose ?? '');
      setNote(found.note ?? '');
    }
  }, [ruleId, rules]);

  const save = async () => {
    if (savingRef.current) {
      return;
    }
    if (!activePet) {
      return;
    }
    if (!title.trim()) {
      setError(t('reminder.titleRequired'));
      return;
    }
    if (!isIsoDateInput(due)) {
      setError(t('reminder.dueInvalid'));
      return;
    }
    savingRef.current = true;
    setError(null);
    setSaving(true);
    try {
      const repo = await getRepository();
      const now = new Date().toISOString();
      const dueIso = `${due.trim()}T00:00:00.000Z`;
      if (editing && ruleId) {
        const found = rules?.find((r) => r.id === ruleId);
        if (found) {
          await repo.upsertLocal('reminder_rules', {
            ...found,
            kind,
            title: title.trim(),
            due: dueIso,
            repeat,
            dose: dose.trim() || null,
            note: note.trim() || null,
            updated_at: now,
          });
        }
      } else {
        const row: ReminderRule = {
          id: newId(),
          pet_id: activePet.id,
          title: title.trim(),
          kind,
          due: dueIso,
          repeat,
          dose: dose.trim() || null,
          note: note.trim() || null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        };
        await repo.upsertLocal('reminder_rules', row);
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
          .then((repo) => repo.softDelete('reminder_rules', ruleId!))
          .then(() => goBack(router)),
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: t('reminder.title') }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.label}>{t('reminder.kind')}</Text>
        <ChipGroup
          options={RULE_KINDS.map((k) => ({
            value: k,
            label: t(`ruleKind.${k}` as never),
            icon: ruleKindMeta(k).icon,
          }))}
          value={kind}
          onSelect={setKind}
        />

        <Text style={styles.label}>{t('reminder.ruleTitle')}</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} accessibilityLabel={t('reminder.ruleTitle')} />

        <Text style={styles.label}>{t('reminder.due')}</Text>
        <DateField value={due} onChange={setDue} accessibilityLabel={t('reminder.due')} placeholder={t('common.selectDate')} />

        <Text style={styles.label}>{t('reminder.repeat')}</Text>
        <ChipGroup
          options={REPEATS.map((v) => ({
            value: v,
            label: t(`reminder.repeat${v.charAt(0).toUpperCase()}${v.slice(1)}` as never),
          }))}
          value={repeat}
          onSelect={setRepeat}
        />

        <Text style={styles.label}>{t('reminder.dose')}</Text>
        <TextInput value={dose} onChangeText={setDose} style={styles.input} accessibilityLabel={t('reminder.dose')} />

        <Text style={styles.label}>{t('reminder.note')}</Text>
        <TextInput value={note} onChangeText={setNote} multiline style={[styles.input, styles.multiline]} accessibilityLabel={t('reminder.note')} />
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label={t('common.save')} onPress={() => void save()} disabled={saving || !activePet} icon="checkmark" />
      {editing ? <Button label={t('reminder.deleteRule')} onPress={remove} variant="danger" icon="trash-outline" /> : null}
      </ScrollView>
    </>
  );
}

const createStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 13, fontFamily: 'Roboto_700Bold', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontFamily: 'Roboto_400Regular', fontSize: 15,
    color: colors.text,
    minHeight: 46,
    marginBottom: spacing.sm,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: colors.errorDeep, fontFamily: 'Roboto_400Regular', fontSize: 14, marginVertical: spacing.sm },
  pressed: { opacity: 0.7 },
});
