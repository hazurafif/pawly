import { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useActivePet } from '../../src/hooks/useActivePet';
import { PetBadge } from '../../src/components/PetBadge';
import { radius, shadow, spacing, type Palette } from '../../src/lib/theme';
import { useAppColors } from '../../src/hooks/useTheme';

export default function TabLayout() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activePet } = useActivePet();
  // Settings shortcut used by every tab header.
  const settingsButton = () => (
    <Link href="/settings" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('settings.title')}
        style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}
      >
        <View style={styles.settingsBadge}>
          <Ionicons name="settings-outline" size={20} color={colors.primary} />
        </View>
      </Pressable>
    </Link>
  );

  // Edit-pet shortcut (Health tab): opens the active pet's details form.
  const editPetButton = () => (
    <Pressable
      onPress={() => router.push(activePet ? `/pet-form?id=${activePet.id}` : '/pet-form')}
      accessibilityRole="button"
      accessibilityLabel={t('petForm.title')}
      style={({ pressed }) => [styles.settingsBadge, pressed && styles.settingsButtonPressed]}
    >
      <Ionicons name="pencil" size={18} color={colors.primary} />
    </Pressable>
  );

  // One header-right container for every tab, so the settings button sits
  // at the same distance from the screen edge everywhere. Journal/Health/
  // Memories additionally show the active pet as a floating pill before it;
  // tapping the pill switches pets. Health also gets a quick edit-pet
  // shortcut (replaces the old in-screen "Edit" header action).
  const headerRight = (withPetBadge: boolean, withEditPet = false) => () => (
    <View style={styles.headerRight}>
      {withPetBadge ? <PetBadge /> : null}
      {withEditPet ? editPetButton() : null}
      {settingsButton()}
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: 'Roboto_700Bold', color: colors.text },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: [styles.tabBar, { bottom: Math.max(16, insets.bottom + 8) }],
        tabBarLabelStyle: { fontFamily: 'Roboto_500Medium' },
        headerRight: headerRight(false),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: t('tabs.journal'),
          headerRight: headerRight(true),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: t('tabs.health'),
          headerRight: headerRight(true, true),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="memories"
        options={{
          title: t('tabs.memories'),
          headerRight: headerRight(true),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'images' : 'images-outline'} size={size} color={color} />
          ),
        }}
      />
      </Tabs>
  );
}

const createStyles = (colors: Palette) => StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    height: 64,
    backgroundColor: colors.glass,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.md,
    paddingBottom: 8,
    paddingTop: 6,
    ...shadow.md,
    elevation: 8,
  },
  settingsButton: {},
  settingsButtonPressed: { opacity: 0.6 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 16,
  },
  settingsBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
