import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';
import { weightKg } from '../lib/format';
import type { Event } from '../db/types';

// Hand-rolled, zero-dependency bar chart: relative to the visible min/max,
// so small fluctuations still read clearly. Reads fine on web and native.
export function WeightChart({ events }: { events: Event[] }) {
  const points = events
    .map((e) => ({ at: e.occurred_at, kg: weightKg(e.data) }))
    .filter((p): p is { at: string; kg: number } => p.kg != null)
    .reverse();
  if (points.length === 0) {
    return null;
  }
  const min = Math.min(...points.map((p) => p.kg));
  const max = Math.max(...points.map((p) => p.kg));
  const span = max - min === 0 ? 1 : max - min;
  const chartHeight = 96;

  return (
    <View style={styles.wrap}>
      <View style={styles.chart} accessibilityLabel={`weight chart, ${points.length} records`}>
        {points.map((p, i) => {
          const h = Math.max(10, ((p.kg - min) / span) * chartHeight);
          return (
            <View key={i} style={styles.barCol}>
              <View style={[styles.bar, { height: h }]} />
              <Text style={styles.barLabel}>
                {p.at.slice(5, 10).replace('-', '/')}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.range}>
        {min.toFixed(1)} – {max.toFixed(1)} kg
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 120,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  bar: {
    width: '100%',
    maxWidth: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryDeep,
    minHeight: 10,
  },
  barLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  range: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm, fontWeight: '600' },
});
