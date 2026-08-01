import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SyncProvider } from '../src/hooks/useSync';
import { colors } from '../src/lib/theme';

export default function RootLayout() {
  return (
    <SyncProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Pengaturan' }} />
      </Stack>
    </SyncProvider>
  );
}
