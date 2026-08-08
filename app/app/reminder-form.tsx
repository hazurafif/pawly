import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useActivePet } from '../src/hooks/useActivePet';
import { useRepoData } from '../src/hooks/useRepoData';
import { getRepository } from '../src/db/db';
import { goBack } from '../src/lib/navigation';
import { newId } from '../src/lib/id';
import { RULE_KINDS, ruleKindMeta } from '../src/lib/catalog';
import { Button, Card } from '../src/components/ui';
import type { ReminderRule } from '../src/db/types';
import { colors, radius, spacing } from '../src/lib/theme';

const REPEATS = ['once', 'daily', 'weekly', 'monthly'] as const;

export default function ReminderFormScreen() {
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

  const { data: rules } = useRepoData((r) => r.allRules());

  useEffect(() => {
    if (!ruleId || !rules) {
      return;
    }
    const found = rules.find((r) => r.id === ruleId);
    if (found) {
      setKind(found.kind);
      setTitle(found.title);
      setDue(found.due.slice(0, 10));
      setRepeat(found.repeat);
      setDose(found.dose ?? '');
      setNote(found.note ?? '');
    }
  }, [ruleId, rules]);

  const save = async () => {
    if (!activePet) {
      return;
    }
    if (!title.trim() || !due.trim()) {
      setError(t('petForm.nameRequired'));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due.trim())) {
      setError(t('petForm.birthDate'));
      return;
    }
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
            .then((repo) => repo.softDelete('reminder_rules', ruleId!))
            .then(() => goBack(router)),
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
      <Card>
        <Text style={styles.label}>{t('reminder.kind')}</Text>
        <View style={styles.chipRow}>
          {RULE_KINDS.map((k) => {
            const meta = ruleKindMeta(k);
            const active = k === kind;
            return (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
              >
                <Ionicons name={meta.icon as never} size={16} color={active ? colors.white : colors.primary} />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(`ruleKind.${k}` as never)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{t('reminder.ruleTitle')}</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} accessibilityLabel={t('reminder.ruleTitle')} />

        <Text style={styles.label}>{t('reminder.due')}</Text>
        <TextInput
          value={due}
          onChangeText={setDue}
          placeholder="2026-09-01"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={t('reminder.due')}
        />

        <Text style={styles.label}>{t('reminder.repeat')}</Text>
        {chipRow(REPEATS, repeat, setRepeat, 'reminder.repeat')}

        <Text style={styles.label}>{t('reminder.dose')}</Text>
        <TextInput value={dose} onChangeText={setDose} style={styles.input} accessibilityLabel={t('reminder.dose')} />

        <Text style={styles.label}>{t('reminder.note')}</Text>
        <TextInput value={note} onChangeText={setNote} multiline style={[styles.input, styles.multiline]} accessibilityLabel={t('reminder.note')} />
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label={t('common.save')} onPress={() => void save()} disabled={saving || !activePet} icon="checkmark" />
      {editing ? <Button label={t('reminder.deleteRule')} onPress={remove} variant="danger" icon="trash-outline" /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
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
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primaryDeep },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white },
  error: { color: colors.errorDeep, fontSize: 14, marginVertical: spacing.sm },
  pressed: { opacity: 0.7 },
});
