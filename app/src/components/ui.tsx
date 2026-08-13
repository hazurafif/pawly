import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { radius, shadow, spacing, typeScale, withAlpha, type M3Roles, type Palette } from '../lib/theme';
import { useM3Roles, useStyles } from '../hooks/useTheme';

// Shared primitives, styled with Material 3 semantic roles: filled/outlined
// buttons, filter chips, elevated cards, a primary-container FAB, and the
// M3 type scale. Legacy screens that style themselves from `colors.*`
// still work — the back-compat palette tokens are unchanged.

const createStyles = (colors: Palette, roles: M3Roles) =>
  StyleSheet.create({
    card: {
      backgroundColor: roles.surfaceContainerLow, // M3 elevated card, level 1
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
    sectionTitle: {
      fontSize: typeScale.titleMedium.fontSize,
      lineHeight: typeScale.titleMedium.lineHeight,
      fontFamily: typeScale.titleMedium.fontFamily,
      color: roles.onSurface,
    },
    sectionAction: { paddingVertical: 4, paddingHorizontal: 8 },
    sectionActionText: {
      color: roles.primary,
      fontSize: typeScale.labelLarge.fontSize,
      fontFamily: typeScale.labelLarge.fontFamily,
    },
    empty: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.pill,
      backgroundColor: roles.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      color: roles.onSurfaceVariant,
      fontFamily: typeScale.bodyMedium.fontFamily,
      fontSize: typeScale.bodyMedium.fontSize,
      lineHeight: typeScale.bodyMedium.lineHeight,
      textAlign: 'center',
    },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: roles.surfaceContainerLow,
      borderWidth: 1,
      borderColor: roles.outline,
    },
    chipActive: {
      backgroundColor: roles.secondaryContainer,
      borderColor: roles.secondaryContainer,
    },
    chipText: {
      fontSize: typeScale.labelLarge.fontSize,
      fontFamily: typeScale.labelLarge.fontFamily,
      color: roles.onSurfaceVariant,
    },
    chipTextActive: { color: roles.onSecondaryContainer },
    chipGroupRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    formChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: roles.surfaceContainerLow,
      minHeight: 40,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: roles.outline,
    },
    formChipActive: { backgroundColor: roles.secondaryContainer, borderColor: roles.secondaryContainer },
    formChipText: {
      fontSize: typeScale.labelLarge.fontSize,
      fontFamily: typeScale.labelLarge.fontFamily,
      color: roles.onSurfaceVariant,
    },
    formChipTextActive: { color: roles.onSecondaryContainer },
    badge: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
    },
    badgeText: { fontSize: typeScale.labelSmall.fontSize, fontFamily: typeScale.labelSmall.fontFamily },
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
    buttonSecondaryBorder: { borderWidth: 1, borderColor: 'transparent' },
    buttonDangerGhostBorder: { borderWidth: 1, borderColor: 'transparent' },
    buttonDisabled: { opacity: 0.5 },
    buttonText: {
      fontSize: typeScale.labelLarge.fontSize,
      lineHeight: typeScale.labelLarge.lineHeight,
      fontFamily: typeScale.labelLarge.fontFamily,
      letterSpacing: typeScale.labelLarge.letterSpacing,
    },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.xxl * 2 + spacing.xl,
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: roles.primaryContainer,
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
  const roles = useM3Roles();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Ionicons name={icon as never} size={18} color={roles.primary} />
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
  const roles = useM3Roles();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon as never} size={24} color={roles.onSurfaceVariant} />
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
  const roles = useM3Roles();
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
                color={active ? roles.onSecondaryContainer : roles.primary}
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
  const colors = useM3Roles();
  const styles = useStyles(createStyles);
  const bg =
    tone === 'danger' ? colors.errorContainer : tone === 'success' ? colors.tertiaryContainer : colors.primaryContainer;
  const fg =
    tone === 'danger' ? colors.onErrorContainer : tone === 'success' ? colors.onTertiaryContainer : colors.onPrimaryContainer;
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
  const roles = useM3Roles();
  const styles = useStyles(createStyles);
  // M3 button variants: filled (primary), outlined (secondary), text
  // (ghost), filled-error (danger), text-error (dangerGhost). Disabled
  // uses onSurface at 12% background / 38% foreground.
  const bg =
    variant === 'primary'
      ? roles.primary
      : variant === 'danger'
        ? roles.error
        : variant === 'ghost' || variant === 'dangerGhost'
          ? 'transparent'
          : 'transparent';
  const fg =
    variant === 'primary'
      ? roles.onPrimary
      : variant === 'danger'
        ? roles.onError
        : variant === 'dangerGhost'
          ? roles.error
          : variant === 'ghost'
            ? roles.primary
            : roles.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: disabled ? withAlpha(roles.onSurface, 0.12) : bg },
        variant === 'secondary' && styles.buttonSecondaryBorder,
        variant === 'secondary' && { borderColor: roles.outline },
        variant === 'dangerGhost' && styles.buttonDangerGhostBorder,
        variant === 'dangerGhost' && { borderColor: roles.error },
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon as never}
          size={18}
          color={disabled ? withAlpha(roles.onSurface, 0.38) : fg}
        />
      ) : null}
      <Text style={[styles.buttonText, { color: disabled ? withAlpha(roles.onSurface, 0.38) : fg }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Fab({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const styles = useStyles(createStyles);
  const roles = useM3Roles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
    >
      <Ionicons name={icon as never} size={26} color={roles.onPrimaryContainer} />
    </Pressable>
  );
}
