import { Pressable, ScrollView, StyleSheet, Text, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRepoData } from '../hooks/useRepoData';
import { useAppColors, useStyles } from '../hooks/useTheme';
import { radius, spacing, type Palette } from '../lib/theme';
import type { Pet } from '../db/types';

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    row: { gap: spacing.sm, paddingVertical: spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 6,
      paddingLeft: 6,
      paddingRight: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    chipText: { fontSize: 14, fontFamily: 'Roboto_700Bold', color: colors.text, maxWidth: 120 },
    chipTextActive: { color: colors.primaryDeep },
    avatarFallback: {
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
  });

export function PetAvatar({ pet, size = 44 }: { pet: Pet; size?: number }) {
  const { data: photo } = useRepoData((r) => r.latestPhotoForPet(pet.id));
  const colors = useAppColors();
  const styles = useStyles(createStyles);
  if (photo?.local_uri) {
    return (
      <Image
        source={{ uri: photo.local_uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="paw" size={size * 0.45} color={colors.primary} />
    </View>
  );
}

export function PetSwitcher({
  pets,
  activeId,
  onSelect,
}: {
  pets: Pet[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const styles = useStyles(createStyles);
  if (pets.length === 0) {
    return null;
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {pets.map((pet) => {
        const active = pet.id === activeId;
        return (
          <Pressable
            key={pet.id}
            onPress={() => onSelect(pet.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={pet.name}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <PetAvatar pet={pet} size={32} />
            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
              {pet.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
