import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors } from '../../src/lib/theme';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('home.title'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'paw' : 'paw-outline'} size={size} color={color} />
          ),
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable style={({ pressed }) => [styles.settingsButton, pressed && styles.settingsButtonPressed]}>
                <View style={styles.settingsBadge}>
                  <Ionicons name="settings-outline" size={20} color={colors.primary} />
                </View>
              </Pressable>
            </Link>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
  },
  settingsButton: { marginRight: 16 },
  settingsButtonPressed: { opacity: 0.6 },
  settingsBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
