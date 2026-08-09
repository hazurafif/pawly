import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useActivePet } from '../../src/hooks/useActivePet';
import { useRepoData } from '../../src/hooks/useRepoData';
import { getRepository } from '../../src/db/db';
import { Chip, EmptyState } from '../../src/components/ui';
import { Fab } from '../../src/components/ui';
import { kindMeta } from '../../src/lib/catalog';
import { dayKeyOfIso, formatTime, relativeDayLabel, weightKg } from '../../src/lib/format';
import type { Event, PhotoWithUri } from '../../src/db/types';
import { radius, spacing, tabBarClearance, type Palette } from '../../src/lib/theme';
import { useAppColors } from '../../src/hooks/useTheme';

const CARE_KINDS = ['feed', 'water', 'walk', 'potty', 'mood', 'photo', 'milestone', 'task'];
const HEALTH_KINDS = ['checkin', 'symptom', 'med_given', 'vaccine', 'visit', 'weight', 'vet_bill'];

type ChipKey = 'all' | 'care' | 'health';

function eventTitle(t: (k: string) => string, e: Event): string {
  if (e.title) {
    return e.title;
  }
  if (e.kind === 'weight') {
    const kg = weightKg(e.data);
    return kg != null ? `${kg} kg` : t('event.kinds.weight');
  }
  return t(`event.kinds.${e.kind}` as never);
}

function eventSummary(e: Event): string | null {
  if (e.kind === 'checkin' && e.data) {
    try {
      const d = JSON.parse(e.data) as Record<string, unknown>;
      return typeof d.concerns === 'string' ? d.concerns : null;
    } catch {
      return null;
    }
  }
  return e.text;
}

export default function JournalScreen() {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const locale = i18n.language === 'id' ? 'id' : 'en';
  const router = useRouter();
  const { activePet } = useActivePet();
  const petId = activePet?.id ?? null;
  const [chip, setChip] = useState<ChipKey>('all');
  const [query, setQuery] = useState('');

  const { data: events, error } = useRepoData((r) =>
    petId ? r.eventsForPet(petId, { q: query.trim() || undefined }) : Promise.resolve([] as Event[])
  );
  const { data: photos } = useRepoData((r) =>
    petId ? r.photosForPet(petId) : Promise.resolve([] as PhotoWithUri[])
  );

  const photoByEvent = useMemo(() => {
    const map = new Map<string, PhotoWithUri>();
    for (const p of photos ?? []) {
      if (p.event_id && !map.has(p.event_id)) {
        map.set(p.event_id, p);
      }
    }
    return map;
  }, [photos]);

  const filtered = useMemo(() => {
    const list = events ?? [];
    if (chip === 'care') {
      return list.filter((e) => CARE_KINDS.includes(e.kind));
    }
    if (chip === 'health') {
      return list.filter((e) => HEALTH_KINDS.includes(e.kind));
    }
    return list;
  }, [events, chip]);

  // Group by local day, preserving newest-first order.
  const sections = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of filtered) {
      const key = dayKeyOfIso(e.occurred_at) ?? '?';
      const arr = map.get(key);
      if (arr) {
        arr.push(e);
      } else {
        map.set(key, [e]);
      }
    }
    return [...map.entries()];
  }, [filtered]);

  const toggleFavorite = (e: Event) => {
    const next = e.favorite !== 1;
    void getRepository()
      .then((repo) => repo.setFavorite(e.id, next))
      .catch(() => {
        // Revert the optimistic toggle when the write fails.
        void getRepository().then((repo) => repo.setFavorite(e.id, e.favorite === 1));
      });
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* No in-screen title: the tab header already says "Journal". */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('journal.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.search}
            accessibilityLabel={t('common.search')}
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel={t('journal.clearSearch')}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.chips}>
          {(['all', 'care', 'health'] as ChipKey[]).map((key) => (
            <Chip
              key={key}
              label={t(`journal.chip${key[0].toUpperCase()}${key.slice(1)}`)}
              active={chip === key}
              onPress={() => setChip(key)}
            />
          ))}
        </View>

        {error ? <Text style={styles.error}>{t('settings.serverOffline')}</Text> : null}

        {!petId ? (
          <EmptyState icon="book-outline" text={t('home.petsEmpty')} />
        ) : events === null ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState icon="book-outline" text={query ? t('journal.noResults') : t('journal.empty')} />
          </View>
        ) : (
          sections.map(([day, items]) => (
            <View key={day}>
              <Text style={styles.dayHeader}>{relativeDayLabel(items[0].occurred_at, locale)}</Text>
              {items.map((e) => {
                const meta = kindMeta(e.kind);
                const photo = photoByEvent.get(e.id);
                return (
                  // The heart is a sibling of the row button — a <button>
                  // nested inside another <button> is invalid HTML on web.
                  <View key={e.id} style={styles.row}>
                    <Pressable
                      onPress={() => router.push(`/entry-form?id=${e.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={eventTitle(t, e)}
                      style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                    >
                      <View style={[styles.icon, { backgroundColor: meta.color + '22' }]}>
                        <Ionicons name={meta.icon as never} size={20} color={meta.color} />
                      </View>
                      <View style={styles.info}>
                        <Text style={styles.title} numberOfLines={1}>
                          {eventTitle(t, e)}
                        </Text>
                        {eventSummary(e) ? (
                          <Text style={styles.summary} numberOfLines={1}>
                            {eventSummary(e)}
                          </Text>
                        ) : null}
                        <Text style={styles.meta}>{formatTime(e.occurred_at)}</Text>
                      </View>
                      {photo?.local_uri ? (
                        <Image source={{ uri: photo.local_uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
                      ) : null}
                    </Pressable>
                    <Pressable
                      onPress={() => toggleFavorite(e)}
                      accessibilityRole="button"
                      accessibilityLabel={e.favorite === 1 ? t('journal.unfavorite') : t('journal.favorite')}
                      hitSlop={10}
                      style={styles.heart}
                    >
                      <Ionicons
                        name={e.favorite === 1 ? 'heart' : 'heart-outline'}
                        size={20}
                        color={e.favorite === 1 ? colors.error : colors.textMuted}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
      <Fab icon="add" label={t('journal.addEntry')} onPress={() => router.push('/entry-form')} />
    </View>
  );
}

const createStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: tabBarClearance },
  loading: { marginTop: spacing.xl },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    minHeight: 48,
  },
  search: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Roboto_400Regular',
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  dayHeader: {
    fontSize: 13,
    fontFamily: 'Roboto_700Bold',
    color: colors.textMuted,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: { width: 42, height: 42, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  title: { fontSize: 15, fontFamily: 'Roboto_700Bold', color: colors.text },
  summary: { fontFamily: 'Roboto_400Regular', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 4, fontFamily: 'Roboto_500Medium' },
  thumb: { width: 44, height: 44, borderRadius: radius.sm + 2 },
  heart: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { marginTop: spacing.lg },
  error: { color: colors.errorDeep, marginVertical: spacing.sm },
  pressed: { opacity: 0.7 },
});
