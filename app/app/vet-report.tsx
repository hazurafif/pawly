import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useActivePet } from '../src/hooks/useActivePet';
import { useRepoData } from '../src/hooks/useRepoData';
import { useToast } from '../src/components/Toast';
import { Button, Card, EmptyState, SectionHeader } from '../src/components/ui';
import { MOOD_VALUES } from '../src/lib/catalog';
import { formatDate, formatKg, formatTime, weightKg } from '../src/lib/format';
import { lastCompletionForRule, nextDueIso, ruleStatus } from '../src/lib/rules';
import { reportMarkdown, type ReportData } from '../src/lib/report';
import { shareText } from '../src/lib/share';
import type { Event } from '../src/db/types';
import { radius, spacing, type Palette } from '../src/lib/theme';
import { useAppColors } from '../src/hooks/useTheme';

function sinceIso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

// Human summary of a daily check-in: mood score + appetite, if present.
function checkinSummary(e: Event, t: TFunction): string {
  let summary = t('event.kinds.checkin');
  if (e.data) {
    try {
      const d = JSON.parse(e.data) as Record<string, unknown>;
      if (typeof d.score === 'number' && d.score > 0) {
        summary = t(`mood.${MOOD_VALUES[Math.min(MOOD_VALUES.length - 1, d.score - 1)]}`);
      }
      if (typeof d.appetite === 'string') {
        summary += ` · ${t(`entry.appetite${d.appetite[0].toUpperCase()}${d.appetite.slice(1)}`)}`;
      }
    } catch {
      // ignore malformed payload
    }
  }
  return summary;
}

export default function VetReportScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const locale = i18n.language === 'id' ? 'id' : 'en';
  const { activePet } = useActivePet();
  const petId = activePet?.id ?? null;

  const { data: events } = useRepoData((r) =>
    petId ? r.eventsSince(petId, sinceIso(30)) : Promise.resolve([] as Event[])
  );
  const { data: allVaccines } = useRepoData((r) =>
    petId ? r.eventsForPet(petId, { kinds: ['vaccine'] }) : Promise.resolve([] as Event[])
  );
  const { data: rules } = useRepoData((r) =>
    petId ? r.rulesForPet(petId) : Promise.resolve([])
  );

  const report = useMemo(() => {
    const list = events ?? [];
    const weights = list
      .filter((e) => e.kind === 'weight')
      .map((e) => ({ at: e.occurred_at, kg: weightKg(e.data) }))
      .filter((p): p is { at: string; kg: number } => p.kg != null)
      .sort((a, b) => a.at.localeCompare(b.at));
    const checkins = list.filter((e) => e.kind === 'checkin');
    const symptoms = list.filter((e) => e.kind === 'symptom');
    const meds = list.filter((e) => e.kind === 'med_given');
    const visits = list.filter((e) => e.kind === 'visit');
    return { weights, checkins, symptoms, meds, visits, total: list.length };
  }, [events]);

  const share = async () => {
    if (!activePet) {
      return;
    }
    const list = events ?? [];
    const upcoming = (rules ?? []).map((r) => {
      const next = nextDueIso(r, lastCompletionForRule(list, r.id));
      const status = ruleStatus(next, new Date().toISOString());
      const when = status === 'overdue' ? t('health.overdue') : next ? formatTime(next) : '';
      return { at: when, text: r.title };
    });
    const data: ReportData = {
      petName: activePet.name,
      periodLabel: `${t('health.reportPeriod')} · ${formatDate(sinceIso(30), locale)} → ${formatDate(new Date().toISOString(), locale)}`,
      weights: report.weights.map((w) => ({ at: formatDate(w.at, locale), text: `${formatKg(w.kg)} kg` })),
      checkins: report.checkins.map((e) => ({ at: formatDate(e.occurred_at, locale), text: checkinSummary(e, t) })),
      symptoms: report.symptoms.map((e) => ({ at: formatDate(e.occurred_at, locale), text: e.title || t('event.kinds.symptom') })),
      meds: report.meds.map((e) => ({ at: formatDate(e.occurred_at, locale), text: e.title || t('event.kinds.med_given') })),
      vaccines: (allVaccines ?? []).map((e) => ({ at: formatDate(e.occurred_at, locale), text: e.title || t('event.kinds.vaccine') })),
      visits: report.visits.map((e) => ({ at: formatDate(e.occurred_at, locale), text: e.title || t('event.kinds.visit') })),
      upcoming,
    };
    const markdown = reportMarkdown(data, {
      title: t('health.reportTitle', { name: activePet.name }),
      weight: t('health.reportWeight'),
      checkins: t('health.reportCheckins'),
      symptoms: t('health.reportSymptoms'),
      meds: t('health.reportMeds'),
      vaccines: t('health.reportVaccines'),
      visits: t('health.reportVisits'),
      upcoming: t('health.reportUpcoming'),
    });
    const filename = `pawly-report-${activePet.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.md`;
    const result = await shareText(markdown, filename);
    if (result === 'copied') {
      showToast({ message: t('health.reportCopied') });
    } else if (result === 'unsupported') {
      showToast({ message: t('health.reportShareFailed') });
    }
  };

  if (!activePet) {
    return (
      <View style={styles.center}>
        <EmptyState icon="document-text-outline" text={t('home.petsEmpty')} />
      </View>
    );
  }

  const hasData = report.total > 0;

  return (
    <>
      <Stack.Screen options={{ title: t('health.vetReport') }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{t('health.reportTitle', { name: activePet.name })}</Text>
      <Text style={styles.period}>{t('health.reportPeriod')} · {formatDate(sinceIso(30), locale)} → today</Text>
      {hasData ? (
        <Button
          label={t('health.shareReport')}
          onPress={() => void share()}
          variant="secondary"
          icon="share-outline"
        />
      ) : null}

      {events === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : !hasData ? (
        <Card>
          <EmptyState icon="document-text-outline" text={t('health.reportEmpty')} />
        </Card>
      ) : (
        <>
          <SectionHeader icon="scale-outline" title={t('health.reportWeight')} />
          <Card>
            {report.weights.length === 0 ? (
              <Text style={styles.muted}>{t('health.weightEmpty')}</Text>
            ) : (
              <>
                {report.weights.map((w) => (
                  <View key={w.at} style={styles.line}>
                    <Text style={styles.lineText}>{formatDate(w.at, locale)}</Text>
                    <Text style={styles.lineValue}>{formatKg(w.kg)} kg</Text>
                  </View>
                ))}
                {report.weights.length > 1 ? (
                  <Text style={styles.muted}>
                    {t('health.latest')}: {report.weights[report.weights.length - 1].kg} kg
                  </Text>
                ) : null}
              </>
            )}
          </Card>

          <SectionHeader icon="clipboard-outline" title={t('health.reportCheckins')} />
          <Card>
            {report.checkins.length === 0 ? (
              <Text style={styles.muted}>{t('health.checkinsEmpty')}</Text>
            ) : (
              report.checkins.map((e) => {
                const summary = checkinSummary(e, t);
                return (
                  <View key={e.id} style={styles.line}>
                    <Text style={styles.lineText}>{formatDate(e.occurred_at, locale)}</Text>
                    <Text style={styles.lineValue}>{summary}</Text>
                  </View>
                );
              })
            )}
          </Card>

          <SectionHeader icon="medkit-outline" title={t('health.reportSymptoms')} />
          <Card>
            {report.symptoms.length === 0 ? (
              <Text style={styles.muted}>{t('health.reportNoSymptoms')}</Text>
            ) : (
              report.symptoms.map((e) => (
                <View key={e.id} style={styles.line}>
                  <Text style={styles.lineText}>{formatDate(e.occurred_at, locale)}</Text>
                  <Text style={styles.lineValue}>{e.title || t('event.kinds.symptom')}</Text>
                </View>
              ))
            )}
          </Card>

          <SectionHeader icon="bandage-outline" title={t('health.reportMeds')} />
          <Card>
            {report.meds.length === 0 ? (
              <Text style={styles.muted}>{t('health.reportNoMeds')}</Text>
            ) : (
              report.meds.map((e) => (
                <View key={e.id} style={styles.line}>
                  <Text style={styles.lineText}>{formatDate(e.occurred_at, locale)}</Text>
                  <Text style={styles.lineValue}>{e.title || t('event.kinds.med_given')}</Text>
                </View>
              ))
            )}
          </Card>

          <SectionHeader icon="shield-checkmark-outline" title={t('health.reportVaccines')} />
          <Card>
            {(allVaccines ?? []).map((e) => (
              <View key={e.id} style={styles.line}>
                <Text style={styles.lineText}>{formatDate(e.occurred_at, locale)}</Text>
                <Text style={styles.lineValue}>{e.title || t('event.kinds.vaccine')}</Text>
              </View>
            ))}
            {report.visits.length > 0 ? (
              <>
                {report.visits.map((e) => (
                  <View key={e.id} style={styles.line}>
                    <Text style={styles.lineText}>{formatDate(e.occurred_at, locale)}</Text>
                    <Text style={styles.lineValue}>{e.title || t('event.kinds.visit')}</Text>
                  </View>
                ))}
              </>
            ) : null}
            {rules && rules.length === 0 && (allVaccines ?? []).length === 0 ? (
              <Text style={styles.muted}>{t('health.vaccinesEmpty')}</Text>
            ) : null}
          </Card>
        </>
      )}
      </ScrollView>
    </>
  );
}

const createStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  heading: { fontSize: 22, fontFamily: 'Roboto_700Bold', color: colors.text, marginTop: spacing.md },
  period: { fontFamily: 'Roboto_400Regular', fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 6 },
  lineText: { fontSize: 14, color: colors.text, fontFamily: 'Roboto_500Medium' },
  lineValue: { fontFamily: 'Roboto_400Regular', fontSize: 14, color: colors.textMuted, flexShrink: 1, textAlign: 'right' },
  muted: { fontFamily: 'Roboto_400Regular', fontSize: 13, color: colors.textMuted },
});
