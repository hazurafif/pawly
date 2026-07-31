import { Tabs, Link } from 'expo-router';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable style={{ marginRight: 16 }}>
                <Ionicons name="settings-outline" size={22} color="#4a6cf7" />
              </Pressable>
            </Link>
          ),
        }}
      />
    </Tabs>
  );
}
