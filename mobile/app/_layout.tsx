import { Stack } from 'expo-router';
import { SyncProvider } from '../src/hooks/useSync';

export default function RootLayout() {
  return (
    <SyncProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Pengaturan' }} />
      </Stack>
    </SyncProvider>
  );
}
