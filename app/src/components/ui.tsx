import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { radius, shadow, spacing, type Palette } from '../lib/theme';
import { useAppColors, useStyles } from '../hooks/useTheme';

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    sectionTitle: { fontSize: 16, fontFamily: 'Roboto_700Bold', color: colors.text },
    sectionAction: { paddingVertical: 4, paddingHorizontal: 8 },
    sectionActionText: { color: colors.primaryDeep, fontSize: 14, fontFamily: 'Roboto_500Medium' },
    empty: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: { color: colors.textMuted, fontFamily: 'Roboto_400Regular', fontSize: 14, textAlign: 'center' },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
    chipText: { fontSize: 13, fontFamily: 'Roboto_500Medium', color: colors.textMuted },
    chipTextActive: { color: colors.white },
    chipGroupRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    formChip: {
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
    formChipActive: { backgroundColor: colors.primaryDeep },
    formChipText: { fontSize: 13, fontFamily: 'Roboto_500Medium', color: colors.textMuted },
    formChipTextActive: { color: colors.white },
    badge: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
    },
    badgeText: { fontSize: 11, fontFamily: 'Roboto_700Bold' },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: radius.pill,
      paddingVertical: 12,
      paddingHorizontal: 16,
      minHeight: 48,
    },
    buttonSecondaryBorder: { borderWidth: 1, borderColor: colors.border },
    buttonDangerGhostBorder: { borderWidth: 1, borderColor: colors.error },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontSize: 15, fontFamily: 'Roboto_700Bold' },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.xxl * 2 + spacing.xl,
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: colors.primaryDark,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primaryDark,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    fabPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
    pressed: { opacity: 0.7 },
  });

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const styles = useStyles(createStyles);
  return <View style={[styles.card, shadow.card, style]}>{children}</View>;
}

export function SectionHeader({
  icon,
  title,
  action,
}: {
  icon: string;
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  const styles = useStyles(createStyles);
  const colors = useAppColors();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon as never} size={18} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}
        >
          <Text style={styles.sectionActionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  const styles = useStyles(createStyles);
  const colors = useAppColors();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as never} size={24} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export interface ChipOption<T extends string = string> {
  value: T;
  label: string;
  icon?: string;
}

// Form picker: a wrapping row of selectable chips (one active). Labels are
// pre-translated; an optional Ionicons icon can prefix each option.
export function ChipGroup<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: readonly ChipOption<T>[];
  value: T;
  onSelect: (v: T) => void;
}) {
  const colors = useAppColors();
  const styles = useStyles(createStyles);
  return (
    <View style={styles.chipGroupRow}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onSelect(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.formChip,
              active && styles.formChipActive,
              pressed && styles.pressed,
            ]}
          >
            {o.icon ? (
              <Ionicons
                name={o.icon as never}
                size={16}
                color={active ? colors.white : colors.primary}
              />
            ) : null}
            <Text style={[styles.formChipText, active && styles.formChipTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({ text, tone = 'soft' }: { text: string; tone?: 'soft' | 'danger' | 'success' }) {
  const colors = useAppColors();
  const styles = useStyles(createStyles);
  const bg =
    tone === 'danger' ? colors.errorSoft : tone === 'success' ? colors.successSoft : colors.primarySoft;
  const fg =
    tone === 'danger' ? colors.errorDeep : tone === 'success' ? colors.successDeep : colors.primaryDeep;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'dangerGhost';
  disabled?: boolean;
  icon?: string;
}) {
  const colors = useAppColors();
  const styles = useStyles(createStyles);
  const bg =
    variant === 'primary'
      ? colors.primaryDark
      : variant === 'danger'
        ? colors.error
        : variant === 'ghost' || variant === 'dangerGhost'
          ? 'transparent'
          : colors.surfaceMuted;
  const fg =
    variant === 'ghost' ? colors.textMuted : variant === 'dangerGhost' ? colors.error : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        variant === 'secondary' && styles.buttonSecondaryBorder,
        variant === 'dangerGhost' && styles.buttonDangerGhostBorder,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon ? <Ionicons name={icon as never} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Fab({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const styles = useStyles(createStyles);
  const colors = useAppColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
    >
      <Ionicons name={icon as never} size={26} color={colors.white} />
    </Pressable>
  );
}
