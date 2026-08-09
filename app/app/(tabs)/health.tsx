import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useActivePet } from '../../src/hooks/useActivePet';
import { useRepoData } from '../../src/hooks/useRepoData';
import { Badge, Card, EmptyState, SectionHeader } from '../../src/components/ui';
import { WeightChart } from '../../src/components/WeightChart';
import { lastCompletionForRule, nextDueIso, ruleStatus } from '../../src/lib/rules';
import { formatDate, weightKg } from '../../src/lib/format';
import { MOOD_VALUES, kindMeta } from '../../src/lib/catalog';
import type { Event, ReminderRule } from '../../src/db/types';
import { radius, spacing, tabBarClearance, type Palette } from '../../src/lib/theme';
import { useAppColors } from '../../src/hooks/useTheme';

function checkinData(e: Event): { score: number; appetite: string | null; concerns: string | null } {
  if (!e.data) {
    return { score: 0, appetite: null, concerns: null };
  }
  try {
    const d = JSON.parse(e.data) as Record<string, unknown>;
    return {
      score: typeof d.score === 'number' ? d.score : 0,
      appetite: typeof d.appetite === 'string' ? d.appetite : null,
      concerns: typeof d.concerns === 'string' ? d.concerns : null,
    };
  } catch {
    return { score: 0, appetite: null, concerns: null };
  }
}

export default function HealthScreen() {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const locale = i18n.language === 'id' ? 'id' : 'en';
  const router = useRouter();
  const { activePet } = useActivePet();
  const petId = activePet?.id ?? null;

  const { data: weightEvents } = useRepoData((r) =>
    petId ? r.eventsForPet(petId, { kinds: ['weight'] }) : Promise.resolve([] as Event[])
  );
  const { data: vaccineEvents } = useRepoData((r) =>
    petId ? r.eventsForPet(petId, { kinds: ['vaccine'] }) : Promise.resolve([] as Event[])
  );
  const { data: visitEvents } = useRepoData((r) =>
    petId ? r.eventsForPet(petId, { kinds: ['visit'] }) : Promise.resolve([] as Event[])
  );
  const { data: checkinEvents } = useRepoData((r) =>
    petId ? r.eventsForPet(petId, { kinds: ['checkin'] }) : Promise.resolve([] as Event[])
  );
  const { data: medGiven } = useRepoData((r) =>
    petId ? r.eventsForPet(petId, { kinds: ['med_given'] }) : Promise.resolve([] as Event[])
  );
  const { data: taskEvents } = useRepoData((r) =>
    petId ? r.eventsForPet(petId, { kinds: ['task'] }) : Promise.resolve([] as Event[])
  );
  const { data: rules } = useRepoData((r) =>
    petId ? r.rulesForPet(petId) : Promise.resolve([] as ReminderRule[])
  );

  const weights = weightEvents ?? [];
  const latest = weights[0] ? weightKg(weights[0].data) : null;
  const chartEvents = weights.slice(0, 8).reverse();

  // Alert: >= 5% loss between the newest weight and any weight >= 30 days ago.
  const weightAlert = useMemo(() => {
    if (weights.length < 2 || latest == null) {
      return null;
    }
    const cutoff = Date.now() - 30 * 86_400_000;
    const old = weights.find((w) => new Date(w.occurred_at).getTime() <= cutoff);
    if (!old) {
      return null;
    }
    const oldKg = weightKg(old.data);
    if (oldKg == null || oldKg === 0) {
      return null;
    }
    const pct = ((oldKg - latest) / oldKg) * 100;
    if (pct >= 5) {
      return { pct: pct.toFixed(0), days: 30 };
    }
    return null;
  }, [weights, latest]);

  const medRules = useMemo(() => (rules ?? []).filter((r) => r.kind === 'med'), [rules]);
  const vaccineRules = useMemo(() => (rules ?? []).filter((r) => r.kind === 'vaccine'), [rules]);

  const nowIso = new Date().toISOString();
  const vaccineDue = vaccineRules
    .map((r) => ({ rule: r, next: nextDueIso(r, lastCompletionForRule(taskEvents ?? [], r.id)) }))
    .filter((r) => r.next && ruleStatus(r.next, nowIso) === 'overdue');

  const rowsFor = (events: Event[] | null) => events ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!petId ? (
        <Card>
          <EmptyState icon="heart-outline" text={t('home.petsEmpty')} />
        </Card>
      ) : weightEvents === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <>
          {/* Weight */}
          <SectionHeader
            icon="scale-outline"
            title={t('health.weight')}
            action={{ label: t('common.add'), onPress: () => router.push('/entry-form?kind=weight') }}
          />
          <Card>
            {latest != null ? (
              <View style={styles.weightRow}>
                <Text style={styles.weightValue}>{latest} kg</Text>
                <Badge text={t('health.latest')} />
              </View>
            ) : (
              <EmptyState icon="scale-outline" text={t('health.weightEmpty')} />
            )}
            <WeightChart events={chartEvents} />
            {weightAlert ? (
              <View style={styles.alert}>
                <Ionicons name="warning-outline" size={16} color={colors.error} />
                <Text style={styles.alertText}>
                  {t('health.weightAlert', {
                    name: activePet?.name ?? '',
                    pct: weightAlert.pct,
                    days: weightAlert.days,
                  })}
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Vaccines */}
          <SectionHeader
            icon="shield-checkmark-outline"
            title={t('health.vaccines')}
            action={{ label: t('common.add'), onPress: () => router.push('/entry-form?kind=vaccine') }}
          />
          {rowsFor(vaccineEvents).length === 0 && vaccineRules.length === 0 ? (
            <Card>
              <EmptyState icon="shield-checkmark-outline" text={t('health.vaccinesEmpty')} />
            </Card>
          ) : (
            <>
              {vaccineDue.map(({ rule, next }) => (
                <Card key={rule.id} style={styles.rowCard}>
                  <View style={styles.rowIcon}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.error} />
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{rule.title}</Text>
                    <Badge text={t('health.overdue')} tone="danger" />
                  </View>
                  <Text style={styles.rowMeta}>
                    {next ? formatDate(next, locale) : ''}
                  </Text>
                </Card>
              ))}
              {rowsFor(vaccineEvents).map((e) => (
                <Card key={e.id} style={styles.rowCard}>
                  <View style={styles.rowIcon}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>{e.title || t('event.kinds.vaccine')}</Text>
                    {e.text ? <Text style={styles.rowSub} numberOfLines={1}>{e.text}</Text> : null}
                  </View>
                  <Text style={styles.rowMeta}>{formatDate(e.occurred_at, locale)}</Text>
                </Card>
              ))}
            </>
          )}

          {/* Medications */}
          <SectionHeader
            icon="bandage-outline"
            title={t('health.meds')}
            action={{ label: t('common.add'), onPress: () => router.push('/reminder-form?kind=med') }}
          />
          {medRules.length === 0 && rowsFor(medGiven).length === 0 ? (
            <Card>
              <EmptyState icon="bandage-outline" text={t('health.medsEmpty')} />
            </Card>
          ) : (
            <>
              {medRules.map((r) => {
                const next = nextDueIso(r, lastCompletionForRule(taskEvents ?? [], r.id));
                return (
                  <Card key={r.id} style={styles.medCard}>
                    <View style={styles.rowIcon}>
                      <Ionicons name="bandage-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{r.title}</Text>
                      {r.dose ? <Text style={styles.rowSub}>{r.dose}</Text> : null}
                      <Text style={styles.rowMeta}>
                        {next && ruleStatus(next, nowIso) === 'overdue'
                          ? t('health.overdue')
                          : next
                            ? t('health.nextDue', { date: formatDate(next, locale) })
                            : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/entry-form?kind=med_given&title=${encodeURIComponent(r.title)}`
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={t('health.logMed')}
                      style={({ pressed }) => [styles.medLogButton, pressed && styles.pressed]}
                    >
                      <Ionicons name="add" size={14} color={colors.primaryDeep} />
                      <Text style={styles.medLogText}>{t('health.logMed')}</Text>
                    </Pressable>
                  </Card>
                );
              })}
              {rowsFor(medGiven).length > 0 ? (
                <>
                  <Text style={styles.subHeader}>{t('health.recentlyGiven')}</Text>
                  {rowsFor(medGiven).slice(0, 5).map((e) => (
                    <Card key={e.id} style={styles.rowCard}>
                      <View style={styles.rowIcon}>
                        <Ionicons name="bandage-outline" size={18} color={colors.primary} />
                      </View>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowTitle}>{e.title || t('event.kinds.med_given')}</Text>
                      </View>
                      <Text style={styles.rowMeta}>{formatDate(e.occurred_at, locale)}</Text>
                    </Card>
                  ))}
                </>
              ) : null}
            </>
          )}

          {/* Vet visits */}
          <SectionHeader
            icon="medkit-outline"
            title={t('health.visits')}
            action={{ label: t('common.add'), onPress: () => router.push('/entry-form?kind=visit') }}
          />
          {rowsFor(visitEvents).length === 0 ? (
            <Card>
              <EmptyState icon="medkit-outline" text={t('health.visitsEmpty')} />
            </Card>
          ) : (
            rowsFor(visitEvents).map((e) => (
              <Card key={e.id} style={styles.rowCard}>
                <View style={styles.rowIcon}>
                  <Ionicons name="medkit-outline" size={18} color={colors.success} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>{e.title || t('event.kinds.visit')}</Text>
                  {e.text ? <Text style={styles.rowSub} numberOfLines={1}>{e.text}</Text> : null}
                </View>
                <Text style={styles.rowMeta}>{formatDate(e.occurred_at, locale)}</Text>
              </Card>
            ))
          )}

          {/* Check-ins */}
          <SectionHeader
            icon="clipboard-outline"
            title={t('health.checkins')}
            action={{ label: t('common.add'), onPress: () => router.push('/entry-form?kind=checkin') }}
          />
          {rowsFor(checkinEvents).length === 0 ? (
            <Card>
              <EmptyState icon="clipboard-outline" text={t('health.checkinsEmpty')} />
            </Card>
          ) : (
            rowsFor(checkinEvents).slice(0, 5).map((e) => {
              const d = checkinData(e);
              return (
                <Card key={e.id} style={styles.rowCard}>
                  <View style={styles.rowIcon}>
                    <Ionicons
                      name={kindMeta('checkin').icon as never}
                      size={18}
                      color={kindMeta('checkin').color}
                    />
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle}>
                      {d.score > 0 ? t(`mood.${MOOD_VALUES[d.score - 1]}`) : t('event.kinds.checkin')}
                      {d.appetite ? ` · ${t(`entry.appetite${d.appetite[0].toUpperCase()}${d.appetite.slice(1)}`)}` : ''}
                    </Text>
                    {d.concerns ? <Text style={styles.rowSub} numberOfLines={1}>{d.concerns}</Text> : null}
                  </View>
                  <Text style={styles.rowMeta}>{formatDate(e.occurred_at, locale)}</Text>
                </Card>
              );
            })
          )}

          {/* Vet prep report */}
          <SectionHeader icon="document-text-outline" title={t('health.vetReport')} />
          <Pressable
            onPress={() => router.push('/vet-report')}
            accessibilityRole="button"
            accessibilityLabel={t('health.vetReport')}
            style={({ pressed }) => [styles.reportCard, pressed && styles.pressed]}
          >
            <View style={styles.reportIcon}>
              <Ionicons name="document-text-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.reportInfo}>
              <Text style={styles.reportTitle}>{t('health.generateReport')}</Text>
              <Text style={styles.reportHint}>{t('health.vetReportHint')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.border} />
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: tabBarClearance },
  loading: { marginTop: spacing.xl },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weightValue: { fontSize: 28, fontFamily: 'Roboto_700Bold', color: colors.text },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  alertText: { flex: 1, fontSize: 13, color: colors.errorDeep, fontFamily: 'Roboto_500Medium' },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  medCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  medLogButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  medLogText: { fontSize: 13, fontFamily: 'Roboto_700Bold', color: colors.primaryDeep },
  subHeader: {
    fontSize: 13,
    fontFamily: 'Roboto_700Bold',
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  rowIcon: { width: 40, height: 40, borderRadius: radius.sm + 2, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontFamily: 'Roboto_700Bold', color: colors.text },
  rowSub: { fontFamily: 'Roboto_400Regular', fontSize: 13, color: colors.textMuted, marginTop: 1 },
  rowMeta: { fontSize: 12, color: colors.textMuted, fontFamily: 'Roboto_500Medium' },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reportIcon: { width: 44, height: 44, borderRadius: radius.sm + 2, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  reportInfo: { flex: 1 },
  reportTitle: { fontSize: 15, fontFamily: 'Roboto_700Bold', color: colors.text },
  reportHint: { fontFamily: 'Roboto_400Regular', fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pressed: { opacity: 0.7 },
});
