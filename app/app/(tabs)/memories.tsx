import { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useActivePet } from '../../src/hooks/useActivePet';
import { useRepoData } from '../../src/hooks/useRepoData';
import { Card, EmptyState, SectionHeader } from '../../src/components/ui';
import { formatDate } from '../../src/lib/format';
import { petAgeLabel } from '../../src/lib/entries';
import { kindMeta } from '../../src/lib/catalog';
import type { Event, PhotoWithUri } from '../../src/db/types';
import { radius, spacing, tabBarClearance, type Palette } from '../../src/lib/theme';
import { useAppColors } from '../../src/hooks/useTheme';

export default function MemoriesScreen() {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const locale = i18n.language === 'id' ? 'id' : 'en';
  const router = useRouter();
  const { activePet } = useActivePet();
  const petId = activePet?.id ?? null;

  const { data: favorites } = useRepoData((r) =>
    petId ? r.favoritesForPet(petId) : Promise.resolve([] as Event[])
  );
  const { data: photos } = useRepoData((r) =>
    petId ? r.photosForPet(petId) : Promise.resolve([] as PhotoWithUri[])
  );

  // Favorited events that carry photos, plus a fallback list for the rest.
  const { favWithPhotos, favOthers } = useMemo(() => {
    const photoEventIds = new Set((photos ?? []).map((p) => p.event_id));
    const withPhotos: Event[] = [];
    const others: Event[] = [];
    for (const e of favorites ?? []) {
      if (photoEventIds.has(e.id)) {
        withPhotos.push(e);
      } else {
        others.push(e);
      }
    }
    return { favWithPhotos: withPhotos, favOthers: others };
  }, [favorites, photos]);

  const photoByEvent = useMemo(() => {
    const map = new Map<string, PhotoWithUri>();
    for (const p of photos ?? []) {
      if (p.event_id && !map.has(p.event_id)) {
        map.set(p.event_id, p);
      }
    }
    return map;
  }, [photos]);

  const gotcha = activePet?.rescue_date ?? null;
  const years = gotcha ? petAgeLabel({ ...activePet, birth_date: gotcha } as never) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionHeader icon="images-outline" title={t('memories.title')} />

      {!petId ? (
        <Card>
          <EmptyState icon="images-outline" text={t('home.petsEmpty')} />
        </Card>
      ) : favorites === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <>
          {/* Gotcha day */}
          {gotcha ? (
            <Pressable
              onPress={() => router.push(`/pet-form?id=${petId}`)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.gotchaCard, pressed && styles.pressed]}
            >
              <View style={styles.gotchaIcon}>
                <Ionicons name="home-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.gotchaInfo}>
                <Text style={styles.gotchaTitle}>{t('memories.gotchaDay')}</Text>
                <Text style={styles.gotchaSub}>
                  {t('memories.cameHomeOn', { date: formatDate(gotcha, locale) })}
                </Text>
                {years ? <Text style={styles.gotchaAge}>{years}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.border} />
            </Pressable>
          ) : null}

          {/* Favorite photos grid */}
          {favWithPhotos.length > 0 ? (
            <>
              <SectionHeader icon="heart-outline" title={t('memories.favorites')} />
              <View style={styles.grid}>
                {favWithPhotos.map((e) => {
                  const photo = photoByEvent.get(e.id);
                  if (!photo?.local_uri) {
                    return null;
                  }
                  return (
                    <Pressable
                      key={e.id}
                      onPress={() => router.push(`/entry-form?id=${e.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={e.title || t('memories.favorites')}
                      style={({ pressed }) => [styles.gridItem, pressed && styles.pressed]}
                    >
                      <Image
                        source={{ uri: photo.local_uri }}
                        style={styles.gridImage}
                        accessibilityIgnoresInvertColors
                      />
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {/* Favorite entries */}
          {favOthers.length > 0 ? (
            <Card>
              {favOthers.map((e) => {
                const meta = kindMeta(e.kind);
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => router.push(`/entry-form?id=${e.id}`)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.favRow, pressed && styles.pressed]}
                  >
                    <View style={[styles.favIcon, { backgroundColor: meta.color + '22' }]}>
                      <Ionicons name={meta.icon as never} size={18} color={meta.color} />
                    </View>
                    <View style={styles.favInfo}>
                      <Text style={styles.favTitle}>{e.title || t(`event.kinds.${e.kind}` as never)}</Text>
                      <Text style={styles.favMeta}>{formatDate(e.occurred_at, locale)}</Text>
                    </View>
                    <Ionicons name="heart" size={16} color={colors.error} />
                  </Pressable>
                );
              })}
            </Card>
          ) : null}

          {favorites.length === 0 ? (
            <Card>
              <EmptyState icon="heart-outline" text={t('memories.favoritesEmpty')} />
            </Card>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const createStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: tabBarClearance },
  loading: { marginTop: spacing.xl },
  gotchaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  gotchaIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotchaInfo: { flex: 1 },
  gotchaTitle: { fontSize: 16, fontFamily: 'Roboto_700Bold', color: colors.text },
  gotchaSub: { fontFamily: 'Roboto_400Regular', fontSize: 13, color: colors.textMuted, marginTop: 2 },
  gotchaAge: { fontSize: 13, color: colors.primaryDark, fontFamily: 'Roboto_700Bold', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: { width: '31%', flexGrow: 1, aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  favIcon: { width: 40, height: 40, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  favInfo: { flex: 1 },
  favTitle: { fontSize: 15, fontFamily: 'Roboto_700Bold', color: colors.text },
  favMeta: { fontFamily: 'Roboto_400Regular', fontSize: 12, color: colors.textMuted, marginTop: 1 },
  pressed: { opacity: 0.7 },
});
