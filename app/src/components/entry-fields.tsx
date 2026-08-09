import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppColors, useStyles } from '../hooks/useTheme';
import { MOOD_VALUES, kindMeta } from '../lib/catalog';
import { radius, spacing, type Palette } from '../lib/theme';

const MOOD_EMOJI: Record<string, string> = {
  great: '😄',
  good: '🙂',
  ok: '😐',
  low: '😕',
  bad: '😢',
};

const PRESET_KEYS: Record<string, string[]> = {
  feed: ['breakfast', 'lunch', 'dinner', 'snack'],
  walk: ['morningWalk', 'eveningWalk'],
};

const SEVERITY_ORDER = [
  { value: 'mild', icon: 'shield-checkmark-outline' },
  { value: 'moderate', icon: 'warning-outline' },
  { value: 'severe', icon: 'alert-circle-outline' },
] as const;

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    label: { fontSize: 13, fontFamily: 'Roboto_700Bold', color: colors.text, marginBottom: spacing.xs },
    hero: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      borderRadius: radius.md,
      marginBottom: spacing.md,
      gap: spacing.xs,
    },
    heroIcon: {
      width: 56,
      height: 56,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    heroTitle: { fontSize: 18, fontFamily: 'Roboto_700Bold', color: colors.text },
    heroSub: { fontFamily: 'Roboto_400Regular', fontSize: 13, color: colors.textMuted, textAlign: 'center' },
    presetHint: { fontSize: 12, fontFamily: 'Roboto_700Bold', color: colors.textMuted, marginBottom: spacing.xs },
    presetRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    presetChip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    presetChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    presetText: { fontSize: 13, fontFamily: 'Roboto_500Medium', color: colors.textMuted },
    presetTextActive: { color: colors.primaryDeep },
    moodRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
    moodItem: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    moodItemActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    moodEmoji: { fontFamily: 'Roboto_400Regular', fontSize: 30 },
    moodLabel: { fontSize: 12, fontFamily: 'Roboto_500Medium', color: colors.textMuted },
    moodLabelActive: { color: colors.primaryDeep, fontFamily: 'Roboto_700Bold' },
    severityRow: { flexDirection: 'row', gap: spacing.sm },
    severityItem: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    severityLabel: { fontSize: 13, fontFamily: 'Roboto_700Bold' },
    weightBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
    },
    weightInput: {
      fontSize: 44,
      fontFamily: 'Roboto_700Bold',
      color: colors.text,
      minWidth: 130,
      textAlign: 'center',
      padding: 0,
    },
    weightUnit: { fontSize: 20, fontFamily: 'Roboto_700Bold', color: colors.textMuted },
    lastRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    lastText: { fontSize: 13, color: colors.textMuted, fontFamily: 'Roboto_500Medium' },
    deltaBadge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.pill },
    deltaText: { fontSize: 12, fontFamily: 'Roboto_700Bold' },
    photoButton: { alignItems: 'center', marginVertical: spacing.sm },
    photoFallback: {
      width: 120,
      height: 96,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    photoHint: { fontSize: 12, color: colors.textMuted, fontFamily: 'Roboto_500Medium' },
    photoPreview: { width: 160, height: 120, borderRadius: radius.md },
    pressed: { opacity: 0.7 },
  });

export function FieldLabel({ children }: { children: ReactNode }) {
  const styles = useStyles(createStyles);
  return <Text style={styles.label}>{children}</Text>;
}

// Colored header per kind: icon tile + title + one-line subtitle.
export function KindHero({ kind }: { kind: string }) {
  const { t } = useTranslation();
  const styles = useStyles(createStyles);
  const meta = kindMeta(kind);
  return (
    <View style={[styles.hero, { backgroundColor: meta.color + '14' }]}>
      <View style={[styles.heroIcon, { backgroundColor: meta.color + '26' }]}>
        <Ionicons name={meta.icon as never} size={30} color={meta.color} />
      </View>
      <Text style={styles.heroTitle}>{t(`event.kinds.${kind}` as never)}</Text>
      <Text style={styles.heroSub}>{t(`entry.hero.${kind}` as never)}</Text>
    </View>
  );
}

// One-tap quick notes (Breakfast/Lunch/... or Morning/Evening walk).
export function CarePresets({
  kind,
  note,
  onPick,
}: {
  kind: string;
  note: string;
  onPick: (note: string) => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles(createStyles);
  const keys = PRESET_KEYS[kind] ?? [];
  if (keys.length === 0) {
    return null;
  }
  return (
    <View>
      <Text style={styles.presetHint}>{t('entry.presetsHint')}</Text>
      <View style={styles.presetRow}>
        {keys.map((key) => {
          const label = t(`entry.preset${key.charAt(0).toUpperCase()}${key.slice(1)}` as never);
          const active = note === label;
          return (
            <Pressable
              key={key}
              onPress={() => onPick(active ? '' : label)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.presetChip,
                active && styles.presetChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.presetText, active && styles.presetTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Emoji mood picker — one tap, no typing.
export function MoodEmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.moodRow}>
      {MOOD_VALUES.map((m) => {
        const active = m === value;
        const label = t(`mood.${m}` as never);
        return (
          <Pressable
            key={m}
            onPress={() => onChange(m)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            style={({ pressed }) => [
              styles.moodItem,
              active && styles.moodItemActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.moodEmoji}>{MOOD_EMOJI[m]}</Text>
            <Text style={[styles.moodLabel, active && styles.moodLabelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Colored severity picker: mild (green) / moderate (amber) / severe (red).
export function SeverityPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles(createStyles);
  const tone = (v: string) =>
    v === 'mild'
      ? { fg: colors.success, soft: colors.successSoft, deep: colors.successDeep }
      : v === 'severe'
        ? { fg: colors.error, soft: colors.errorSoft, deep: colors.errorDeep }
        : { fg: colors.warning, soft: colors.warningSoft, deep: colors.warningDeep };
  return (
    <View style={styles.severityRow}>
      {SEVERITY_ORDER.map(({ value: v, icon }) => {
        const active = v === value;
        const c = tone(v);
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.severityItem,
              active && { backgroundColor: c.soft, borderColor: c.fg },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name={icon as never} size={22} color={active ? c.deep : c.fg} />
            <Text style={[styles.severityLabel, { color: active ? c.deep : c.fg }]}>
              {t(`entry.severity${v.charAt(0).toUpperCase()}${v.slice(1)}` as never)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Big weight entry with last-record context and a live delta badge.
export function WeightField({
  value,
  onChange,
  lastKg,
}: {
  value: string;
  onChange: (v: string) => void;
  lastKg: number | null;
}) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles(createStyles);
  const trimmed = value.trim();
  const parsed = trimmed === '' ? Number.NaN : Number(trimmed);
  const delta = !Number.isNaN(parsed) && lastKg != null ? parsed - lastKg : null;
  const showDelta = delta != null && Math.abs(delta) >= 0.01;
  return (
    <View>
      <View style={styles.weightBox}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder="4.2"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('entry.weightKg')}
          style={styles.weightInput}
        />
        <Text style={styles.weightUnit}>kg</Text>
      </View>
      {lastKg != null ? (
        <View style={styles.lastRow}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.lastText}>
            {t('entry.lastWeight')}: {lastKg} kg
          </Text>
          {showDelta ? (
            <View
              style={[
                styles.deltaBadge,
                { backgroundColor: delta! > 0 ? colors.successSoft : colors.warningSoft },
              ]}
            >
              <Text
                style={[
                  styles.deltaText,
                  { color: delta! > 0 ? colors.successDeep : colors.warningDeep },
                ]}
              >
                {delta! > 0 ? '▲' : '▼'} {Math.abs(delta!).toFixed(1)} kg
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function PhotoPicker({
  uri,
  onPick,
  label,
}: {
  uri: string | null;
  onPick: () => void;
  label: string;
}) {
  const colors = useAppColors();
  const styles = useStyles(createStyles);
  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.photoPreview} accessibilityIgnoresInvertColors />
      ) : (
        <View style={styles.photoFallback}>
          <Ionicons name="camera-outline" size={24} color={colors.primary} />
          <Text style={styles.photoHint}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
