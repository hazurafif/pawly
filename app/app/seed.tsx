import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getRepository } from '../src/db/db';
import { newId } from '../src/lib/id';
import { radius, spacing, type Palette } from '../src/lib/theme';
import { useAppColors } from '../src/hooks/useTheme';

// DEV-ONLY sample data for screenshots and the TEST_SCRIPT walkthrough.
// Reachable at /seed; never shipped in production flows. Not for sync.
function iso(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

async function makePhotoUri(seed: number): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('canvas unavailable');
  }
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 240;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('canvas context unavailable');
  }
  const hues = [24, 160, 260, 320];
  const hue = hues[seed % hues.length];
  const grad = ctx.createLinearGradient(0, 0, 240, 240);
  grad.addColorStop(0, `hsl(${hue}, 70%, 82%)`);
  grad.addColorStop(1, `hsl(${(hue + 40) % 360}, 65%, 60%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 240, 240);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(120 + (seed % 3) * 14 - 14, 120 + ((seed >> 2) % 3) * 14 - 14, 58, 0, Math.PI * 2);
  ctx.fill();
  return canvas.toDataURL('image/jpeg', 0.85);
}

export default function SeedScreen() {
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ force?: string }>();
  const force = params.force === '1';
  const [status, setStatus] = useState<'seeding' | 'done' | 'error'>('seeding');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const repo = await getRepository();
        const existing = await repo.allPets();
        if (existing.length > 0 && !force) {
          setStatus('done');
          return;
        }

        // Miko — the well-documented pet.
        const mikoId = newId();
        await repo.upsertLocal('pets', {
          id: mikoId,
          name: 'Miko',
          species: 'cat',
          sex: 'male',
          birth_date: '2024-03-15',
          birth_date_is_estimated: 0,
          rescue_date: '2024-05-01',
          rescue_date_is_estimated: 0,
          is_neutered: 'yes',
          story: 'Found under the porch in May. Now owns the whole house.',
          status: 'alive',
          passed_away_date: null,
          vet_clinic: 'Klinik Hewan Sahabat',
          created_at: iso(200, 9),
          updated_at: iso(200, 9),
          deleted_at: null,
        });

        // Bella — second pet for the switcher.
        await repo.upsertLocal('pets', {
          id: newId(),
          name: 'Bella',
          species: 'dog',
          sex: 'female',
          birth_date: '2023-08-20',
          birth_date_is_estimated: 1,
          rescue_date: null,
          rescue_date_is_estimated: 0,
          is_neutered: 'yes',
          story: null,
          status: 'alive',
          passed_away_date: null,
          vet_clinic: null,
          created_at: iso(60, 9),
          updated_at: iso(60, 9),
          deleted_at: null,
        });

        // Reminder rules — one due today, one overdue, one upcoming.
        const ruleIds = [newId(), newId(), newId()];
        const mkRule = (id: string, title: string, kind: string, due: string, repeat: string, dose: string | null) =>
          repo.upsertLocal('reminder_rules', {
            id, pet_id: mikoId, title, kind, due, repeat, dose,
            note: null,
            created_at: iso(30, 9), updated_at: iso(30, 9), deleted_at: null,
          });
        await mkRule(ruleIds[0], 'Flea & worm treatment', 'flea', iso(2, 8), 'monthly', '1 tablet');
        await mkRule(ruleIds[1], 'Rabies booster', 'vaccine', iso(1, 9), 'yearly', null);
        await mkRule(ruleIds[2], 'Antibiotic course', 'med', iso(0, 20, 30), 'daily', '1 ml, 2× daily');

        const mkEvent = async (
          petId: string, kind: string, at: string,
          extra: { title?: string; text?: string; data?: Record<string, unknown>; favorite?: boolean } = {}
        ) => {
          const now = new Date().toISOString();
          const row = {
            id: newId(),
            pet_id: petId,
            kind,
            title: extra.title ?? null,
            text: extra.text ?? null,
            occurred_at: at,
            next_due_at: null,
            data: extra.data ? JSON.stringify(extra.data) : null,
            favorite: extra.favorite ? 1 : 0,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          };
          await repo.upsertLocal('events', row);
          return row;
        };

        // Today's care events (fill the checklist + today stream).
        await mkEvent(mikoId, 'feed', iso(0, 7, 30), { title: 'Breakfast', text: 'Wet food + dry mix' });
        await mkEvent(mikoId, 'feed', iso(0, 18, 5), { title: 'Dinner' });
        await mkEvent(mikoId, 'water', iso(0, 9, 15));
        await mkEvent(mikoId, 'water', iso(0, 13, 40));
        await mkEvent(mikoId, 'water', iso(0, 19, 30));
        await mkEvent(mikoId, 'potty', iso(0, 8, 10));
        await mkEvent(mikoId, 'potty', iso(0, 20, 10));
        await mkEvent(mikoId, 'walk', iso(0, 17, 30), { title: 'Evening walk', text: 'Around the block, met a squirrel' });
        await mkEvent(mikoId, 'mood', iso(0, 12, 0), { data: { score: 5 } });

        // Weight series for the chart + trend.
        const weights: [number, number][] = [
          [180, 3.1], [150, 3.4], [120, 3.6], [90, 3.9], [60, 4.1], [30, 4.2], [7, 4.3], [2, 4.3],
        ];
        for (const [daysAgo, kg] of weights) {
          await mkEvent(mikoId, 'weight', iso(daysAgo, 9, 30), { data: { kg } });
        }

        // Health history.
        await mkEvent(mikoId, 'vaccine', iso(220, 10), { title: 'FVRCP booster', text: '1 ml' });
        await mkEvent(mikoId, 'vaccine', iso(20, 10), { title: 'Rabies', text: '1 ml, 3-year' });
        await mkEvent(mikoId, 'visit', iso(45, 11), { title: 'Annual checkup', text: 'All good, teeth clean' });
        await mkEvent(mikoId, 'visit', iso(300, 14), { title: 'Ear infection', text: 'Prescribed drops' });
        await mkEvent(mikoId, 'med_given', iso(1, 20, 30), { title: 'Antibiotic', text: '1 ml' });
        await mkEvent(mikoId, 'checkin', iso(3, 8, 15), {
          data: { score: 4, appetite: 'normal', concerns: 'Sneezing this morning' },
        });
        await mkEvent(mikoId, 'checkin', iso(1, 8, 15), { data: { score: 5, appetite: 'high' } });
        await mkEvent(mikoId, 'symptom', iso(2, 9, 0), { title: 'Sneezing', data: { severity: 'mild' } });

        // Photos (canvas-generated data URIs) — favorites feed Memories.
        const photoEvents = [
          { days: 5, note: 'Sunbathing on the porch' },
          { days: 12, note: 'Gotcha day, one month in' },
          { days: 40, note: 'First time on the balcony' },
          { days: 90, note: 'Napping in the box' },
        ];
        for (let i = 0; i < photoEvents.length; i++) {
          const ev = await mkEvent(mikoId, 'photo', iso(photoEvents[i].days, 14), {
            title: photoEvents[i].note,
            favorite: i < 3,
          });
          const uri = await makePhotoUri(i);
          const photoId = newId();
          const now = new Date().toISOString();
          await repo.upsertLocal('photos', {
            id: photoId,
            event_id: ev.id,
            taken_at: ev.occurred_at,
            content_type: 'image/jpeg',
            created_at: now,
            updated_at: now,
            deleted_at: null,
          });
          await repo.addPendingPhoto(photoId, uri);
        }

        // Milestones.
        await mkEvent(mikoId, 'milestone', iso(150, 12), { title: 'First mouse caught', favorite: true });
        await mkEvent(mikoId, 'milestone', iso(50, 18), { title: 'First time on my lap for an hour' });

        // Default the active pet to the well-documented one for demos.
        try {
          localStorage.setItem('pawly.activePet', mikoId);
        } catch {
          // storage unavailable
        }

        setStatus('done');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    })();
  }, []);

  return (
    <View style={styles.center}>
      {status === 'seeding' ? (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.text}>Seeding sample data…</Text>
        </>
      ) : status === 'done' ? (
        <>
          <Text style={styles.done}>Sample data ready</Text>
          <Pressable
            onPress={() => router.replace('/')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.buttonText}>{t('common.done')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => router.replace('/')} accessibilityRole="button" style={styles.button}>
            <Text style={styles.buttonText}>Home</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const createStyles = (colors: Palette) => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.background },
  text: { fontFamily: 'Roboto_400Regular', fontSize: 14, color: colors.textMuted },
  done: { fontSize: 18, fontFamily: 'Roboto_700Bold', color: colors.text },
  error: { fontFamily: 'Roboto_400Regular', fontSize: 14, color: colors.errorDeep, paddingHorizontal: spacing.lg, textAlign: 'center' },
  button: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: { color: colors.white, fontSize: 15, fontFamily: 'Roboto_700Bold' },
});
