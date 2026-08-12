import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppColors, useStyles } from '../hooks/useTheme';
import { radius, spacing, type Palette } from '../lib/theme';
import { cellDayKey, monthGrid, type MonthPosition } from '../lib/calendar';

const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Month calendar grid: dots mark days that have journal entries; tapping a
// day selects it (the caller shows that day's entries below).
export function CalendarView({
  position,
  label,
  marked,
  selected,
  onSelect,
  onPrev,
  onNext,
}: {
  position: MonthPosition;
  label: string;
  /** Day keys (YYYY-MM-DD) that have entries. */
  marked: Set<string>;
  /** Selected day key, if any. */
  selected: string | null;
  onSelect: (dayKey: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const colors = useAppColors();
  const styles = useStyles(createStyles);
  const cells = monthGrid(position.year, position.month);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable onPress={onPrev} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={8} style={({ pressed }) => [styles.nav, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.month}>{label}</Text>
        <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel="Next month" hitSlop={8} style={({ pressed }) => [styles.nav, pressed && styles.pressed]}>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {WEEKDAY_HEADERS.map((w, i) => (
          <Text key={i} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((date, i) => {
          if (!date) {
            return <View key={`blank-${i}`} style={styles.cell} />;
          }
          const key = cellDayKey(date);
          const has = marked.has(key);
          const active = key === selected;
          return (
            <Pressable
              key={key}
              onPress={() => onSelect(key)}
              accessibilityRole="button"
              accessibilityLabel={key}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
            >
              <View style={[styles.day, active && styles.dayActive]}>
                <Text style={[styles.dayText, active && styles.dayTextActive]}>{date.getUTCDate()}</Text>
              </View>
              {has ? <View style={[styles.dot, active && styles.dotActive]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
      marginBottom: spacing.md,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
    nav: { padding: spacing.xs },
    month: { fontSize: 15, fontFamily: 'Roboto_700Bold', color: colors.text },
    weekRow: { flexDirection: 'row', marginBottom: 2 },
    weekday: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      fontSize: 11,
      fontFamily: 'Roboto_500Medium',
      color: colors.textMuted,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
    day: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayActive: { backgroundColor: colors.primary },
    dayText: { fontSize: 13, fontFamily: 'Roboto_500Medium', color: colors.text },
    dayTextActive: { color: colors.white, fontFamily: 'Roboto_700Bold' },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 1 },
    dotActive: { backgroundColor: colors.white },
    pressed: { opacity: 0.7 },
  });
