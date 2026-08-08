import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SyncProvider } from '../src/hooks/useSync';
import { ActivePetProvider } from '../src/hooks/useActivePet';
import { colors } from '../src/lib/theme';
import '../src/i18n';

export default function RootLayout() {
  return (
    <SyncProvider>
      <ActivePetProvider>
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
          <Stack.Screen name="pet-form" options={{ presentation: 'modal' }} />
          <Stack.Screen name="entry-form" options={{ presentation: 'modal' }} />
          <Stack.Screen name="reminder-form" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="vet-report" options={{ title: 'Vet prep report' }} />
        </Stack>
      </ActivePetProvider>
    </SyncProvider>
  );
}
