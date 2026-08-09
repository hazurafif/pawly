import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useActivePet } from '../hooks/useActivePet';
import { useAppColors, useStyles } from '../hooks/useTheme';
import { radius, shadow, spacing, type Palette } from '../lib/theme';
import { PetAvatar } from './PetSwitcher';

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingLeft: 4,
      paddingRight: 10,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      maxWidth: 140,
    },
    badgeText: { fontSize: 13, fontWeight: '700', color: colors.text, flexShrink: 1 },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    sheet: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      ...shadow.lg,
    },
    sheetTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 8,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
    },
    rowActive: { backgroundColor: colors.primarySoft },
    rowName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
    rowNameActive: { color: colors.primaryDeep },
    pressed: { opacity: 0.7 },
  });

// Floating indicator of the active pet in the tab headers (journal, health,
// memories): a pill with the pet's avatar + name. Tapping it opens a small
// switcher modal so the pet being logged into is always visible.
export function PetBadge() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useStyles(createStyles);
  const { pets, activePet, setActivePetId } = useActivePet();
  const [open, setOpen] = useState(false);

  if (!activePet) {
    return null;
  }

  const pick = (id: string) => {
    setActivePetId(id);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('common.switchPet')}
        style={({ pressed }) => [styles.badge, pressed && styles.pressed]}
      >
        <PetAvatar pet={activePet} size={24} />
        <Text style={styles.badgeText} numberOfLines={1}>
          {activePet.name}
        </Text>
        <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
      </Pressable>
      <Modal
        transparent
        visible={open}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('common.switchPet')}</Text>
            {pets.map((pet) => {
              const active = pet.id === activePet.id;
              return (
                <Pressable
                  key={pet.id}
                  onPress={() => pick(pet.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('common.switchPet')} to ${pet.name}`}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.row,
                    active && styles.rowActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <PetAvatar pet={pet} size={36} />
                  <Text style={[styles.rowName, active && styles.rowNameActive]} numberOfLines={1}>
                    {pet.name}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
