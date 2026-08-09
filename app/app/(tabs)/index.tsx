import { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useActivePet } from '../../src/hooks/useActivePet';
import { useRepoData } from '../../src/hooks/useRepoData';
import { Badge, Button, Card, EmptyState, SectionHeader } from '../../src/components/ui';
import { PetSwitcher } from '../../src/components/PetSwitcher';
import { useToast } from '../../src/components/Toast';
import { QUICK_KINDS, kindMeta } from '../../src/lib/catalog';
import { checklistProgress } from '../../src/lib/checklist';
import { logEvent } from '../../src/lib/entries';
import { lastCompletionForRule, nextDueIso, ruleStatus } from '../../src/lib/rules';
import { formatTime, startOfTodayIso, weightKg } from '../../src/lib/format';
import { petAgeLabel } from '../../src/lib/entries';
import { radius, spacing, tabBarClearance, type Palette } from '../../src/lib/theme';
import { useAppColors } from '../../src/hooks/useTheme';
import type { Event, ReminderRule } from '../../src/db/types';

function speciesLabel(t: (k: string) => string, species: string): string {
  if (species === 'dog') return t('petForm.speciesDog');
  if (species === 'cat') return t('petForm.speciesCat');
  return t('petForm.speciesOther');
}

function sexLabel(t: (k: string) => string, sex: string): string {
  if (sex === 'male') return t('petForm.sexMale');
  if (sex === 'female') return t('petForm.sexFemale');
  return t('petForm.sexUnknown');
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { pets, activePet, setActivePetId, loading } = useActivePet();
  const { showToast } = useToast();

  const petId = activePet?.id ?? null;
  const { data: todayEvents } = useRepoData((r) =>
    petId ? r.eventsSince(petId, startOfTodayIso()) : Promise.resolve([] as Event[])
  );
  const { data: taskEvents } = useRepoData((r) =>
    petId ? r.eventsForPet(petId, { kinds: ['task'] }) : Promise.resolve([] as Event[])
  );
  const { data: weightEvents } = useRepoData((r) =>
    petId ? r.eventsForPet(petId, { kinds: ['weight'], limit: 1 }) : Promise.resolve([] as Event[])
  );
  const { data: rules } = useRepoData((r) =>
    petId ? r.rulesForPet(petId) : Promise.resolve([] as ReminderRule[])
  );
  const { data: favorites } = useRepoData((r) =>
    petId ? r.favoritesForPet(petId) : Promise.resolve([] as Event[])
  );
  const { data: photo } = useRepoData((r) =>
    petId ? r.latestPhotoForPet(petId) : Promise.resolve(null)
  );

  const checklist = useMemo(
    () => checklistProgress(todayEvents ?? []),
    [todayEvents]
  );
  const latestWeight = weightEvents && weightEvents.length > 0 ? weightKg(weightEvents[0].data) : null;
  const latestWeightAt = weightEvents && weightEvents.length > 0 ? weightEvents[0].occurred_at : null;

  const dueRules = useMemo(() => {
    const now = new Date().toISOString();
    const horizon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    return (rules ?? [])
      .map((rule) => {
        const last = lastCompletionForRule(taskEvents ?? [], rule.id);
        const next = nextDueIso(rule, last);
        return { rule, nextDue: next, status: next ? ruleStatus(next, now) : 'upcoming' };
      })
      .filter((r) => r.nextDue && (r.status === 'overdue' || (r.nextDue as string) <= horizon))
      .sort((a, b) => (a.nextDue as string).localeCompare(b.nextDue as string));
  }, [rules, taskEvents]);

  const quickLog = async (kind: string) => {
    if (!petId) {
      return;
    }
    const row = await logEvent(await import('../../src/db/db').then((m) => m.getRepository()), petId, kind);
    showToast({
      message: `${t('entry.undoLogged')} ${formatTime(row.occurred_at)} · ${t(`event.kinds.${kind}` as never)}`,
      undoLabel: t('common.undo'),
      undo: () =>
        void import('../../src/db/db')
          .then((m) => m.getRepository())
          .then((repo) => repo.softDelete('events', row.id)),
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!activePet) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="paw" size={30} color={colors.white} />
          </View>
          <Text style={styles.appName}>Pawly</Text>
          <Text style={styles.tagline}>{t('home.tagline')}</Text>
        </View>
        <Card>
          <EmptyState icon="paw-outline" text={t('home.petsEmpty')} />
          <Button label={t('home.addPet')} onPress={() => router.push('/pet-form')} icon="add" />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PetSwitcher pets={pets} activeId={activePet.id} onSelect={setActivePetId} />

      {/* Pet card */}
      <Card style={styles.petCard}>
        <View style={styles.petRow}>
          {photo?.local_uri ? (
            <Image
              source={{ uri: photo.local_uri }}
              style={styles.petPhoto}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={styles.petPhotoFallback}>
              <Ionicons name="paw" size={32} color={colors.primary} />
            </View>
          )}
          <View style={styles.petInfo}>
            <Text style={styles.petName}>{activePet.name}</Text>
            <Text style={styles.petSubtitle}>
              {speciesLabel(t, activePet.species)} · {sexLabel(t, activePet.sex)}
            </Text>
            <View style={styles.badgeRow}>
              {petAgeLabel(activePet) ? <Badge text={petAgeLabel(activePet)!} /> : null}
              {activePet.is_neutered === 'yes' ? <Badge text={t('petForm.neuteredYes')} tone="success" /> : null}
              {latestWeight != null ? (
                <Badge text={`${latestWeight} kg`} />
              ) : null}
            </View>
          </View>
          <Pressable
            onPress={() => router.push(`/pet-form?id=${activePet.id}`)}
            accessibilityRole="button"
            accessibilityLabel={t('petForm.title')}
            hitSlop={8}
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <Ionicons name="pencil" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </Card>

      {/* Quick log */}
      <SectionHeader icon="flash-outline" title={t('home.quickLog')} />
      <View style={styles.quickRow}>
        {QUICK_KINDS.map((kind) => {
          const meta = kindMeta(kind);
          return (
            <Pressable
              key={kind}
              onPress={() => void quickLog(kind)}
              accessibilityRole="button"
              accessibilityLabel={t(`event.kinds.${kind}` as never)}
              style={({ pressed }) => [styles.quickItem, pressed && styles.quickPressed]}
            >
              <View style={[styles.quickIcon, { backgroundColor: meta.color + '22' }]}>
                <Ionicons name={meta.icon as never} size={24} color={meta.color} />
              </View>
              <Text style={styles.quickLabel}>{t(`event.kinds.${kind}` as never)}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => router.push('/entry-form')}
          accessibilityRole="button"
          accessibilityLabel={t('home.moreActions')}
          style={({ pressed }) => [styles.quickItem, pressed && styles.quickPressed]}
        >
          <View style={[styles.quickIcon, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.textMuted} />
          </View>
          <Text style={styles.quickLabel}>{t('home.moreActions')}</Text>
        </Pressable>
      </View>

      {/* Care checklist */}
      <SectionHeader icon="checkmark-done-outline" title={t('home.checklist')} />
      <Card>
        <View style={styles.checklistHeader}>
          <Text style={styles.checklistProgress}>
            {t('home.checklistDone', { done: checklist.done, total: checklist.total })}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${checklist.total === 0 ? 0 : (checklist.done / checklist.total) * 100}%` },
              ]}
            />
          </View>
        </View>
        <View style={styles.checklistItems}>
          {checklist.items.map((item) => {
            const complete = item.done >= item.target;
            const label = t(`event.kinds.${item.kind}` as never);
            return (
              <Pressable
                key={item.kind}
                onPress={() => {
                  if (!complete) {
                    void quickLog(item.kind);
                  }
                }}
                disabled={complete}
                accessibilityRole="button"
                accessibilityLabel={`${label} ${item.done}/${item.target}`}
                style={({ pressed }) => [
                  styles.checklistItem,
                  pressed && !complete && styles.quickPressed,
                ]}
              >
                <Ionicons
                  name={complete ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={complete ? colors.success : colors.border}
                />
                <Text style={[styles.checklistItemText, complete && styles.checklistItemDone]}>
                  {label}
                </Text>
                <Text style={styles.checklistItemCount}>
                  {item.done}/{item.target}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Due reminders */}
      <SectionHeader
        icon="alarm-outline"
        title={t('home.dueToday')}
        action={{ label: t('common.add'), onPress: () => router.push('/reminder-form') }}
      />
      {dueRules.length === 0 ? (
        <Card>
          <EmptyState icon="alarm-outline" text={t('home.noDue')} />
        </Card>
      ) : (
        dueRules.map(({ rule, nextDue, status }) => (
          <Card key={rule.id} style={styles.ruleCard}>
            <View style={styles.ruleIcon}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.ruleInfo}>
              <Text style={styles.ruleTitle}>{rule.title}</Text>
              <Text style={styles.ruleMeta}>
                {status === 'overdue' ? t('health.overdue') : nextDue ? t('health.nextDue', { date: formatTime(nextDue) }) : ''}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                void (async () => {
                  const repo = await import('../../src/db/db').then((m) => m.getRepository());
                  const row = await logEvent(repo, petId!, 'task', {
                    title: rule.title,
                    data: { rule_id: rule.id },
                  });
                  showToast({
                    message: `${t('entry.undoLogged')} · ${rule.title}`,
                    undoLabel: t('common.undo'),
                    undo: () => void repo.softDelete('events', row.id),
                  });
                })()
              }
              accessibilityRole="button"
              accessibilityLabel={t('reminder.markDone')}
              hitSlop={8}
              style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
            >
              <Ionicons name="checkmark" size={18} color={colors.success} />
            </Pressable>
          </Card>
        ))
      )}

      {/* Today's entries */}
      <SectionHeader
        icon="time-outline"
        title={t('home.todayEntries')}
        action={{ label: t('home.seeAll'), onPress: () => router.push('/(tabs)/journal') }}
      />
      {(todayEvents ?? []).length === 0 ? (
        <Card>
          <EmptyState icon="time-outline" text={t('home.noEntriesToday')} />
        </Card>
      ) : (
        (todayEvents ?? []).slice(0, 3).map((e) => (
          <Card key={e.id} style={styles.entryCard}>
            <View style={[styles.entryIcon, { backgroundColor: kindMeta(e.kind).color + '22' }]}>
              <Ionicons name={kindMeta(e.kind).icon as never} size={18} color={kindMeta(e.kind).color} />
            </View>
            <View style={styles.ruleInfo}>
              <Text style={styles.entryTitle}>{e.title || t(`event.kinds.${e.kind}` as never)}</Text>
              {e.text ? <Text style={styles.entryText} numberOfLines={1}>{e.text}</Text> : null}
            </View>
            <Text style={styles.entryTime}>{formatTime(e.occurred_at)}</Text>
          </Card>
        ))
      )}

      {/* Memory teaser */}
      {(favorites ?? []).length > 0 ? (
        <Pressable
          onPress={() => router.push('/(tabs)/memories')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.memoryTeaser, pressed && styles.pressed]}
        >
          <Ionicons name="heart" size={18} color={colors.error} />
          <Text style={styles.memoryTeaserText}>
            {t('memories.favorites')} · {(favorites ?? []).length}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}

    </ScrollView>
  );
}

const createStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: tabBarClearance },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  hero: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  appName: { fontSize: 26, fontFamily: 'Roboto_700Bold', color: colors.text, marginTop: spacing.sm },
  tagline: { fontFamily: 'Roboto_400Regular', fontSize: 14, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  petCard: {},
  petRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  petPhoto: { width: 84, height: 84, borderRadius: radius.lg },
  petPhotoFallback: {
    width: 84,
    height: 84,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petInfo: { flex: 1 },
  petName: { fontSize: 24, fontFamily: 'Roboto_700Bold', color: colors.text },
  petSubtitle: { fontFamily: 'Roboto_400Regular', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  quickItem: { alignItems: 'center', gap: 6, flex: 1, minHeight: 72 },
  quickPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { fontSize: 12, fontFamily: 'Roboto_500Medium', color: colors.text },
  checklistHeader: { marginBottom: spacing.sm },
  checklistProgress: { fontSize: 13, fontFamily: 'Roboto_500Medium', color: colors.textMuted, marginBottom: spacing.sm },
  progressTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.success },
  checklistItems: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  checklistItem: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: '45%' },
  checklistItemText: { fontSize: 13, fontFamily: 'Roboto_500Medium', color: colors.text, flex: 1 },
  checklistItemDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  checklistItemCount: { fontSize: 12, fontFamily: 'Roboto_700Bold', color: colors.textMuted },
  ruleCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  ruleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleInfo: { flex: 1 },
  ruleTitle: { fontSize: 15, fontFamily: 'Roboto_700Bold', color: colors.text },
  ruleMeta: { fontFamily: 'Roboto_400Regular', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  doneButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  entryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  entryIcon: { width: 40, height: 40, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  entryTitle: { fontSize: 15, fontFamily: 'Roboto_700Bold', color: colors.text },
  entryText: { fontFamily: 'Roboto_400Regular', fontSize: 13, color: colors.textMuted, marginTop: 1 },
  entryTime: { fontSize: 12, color: colors.textMuted, fontFamily: 'Roboto_500Medium' },
  memoryTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  memoryTeaserText: { fontSize: 14, fontFamily: 'Roboto_700Bold', color: colors.text },
  pressed: { opacity: 0.7 },
});
