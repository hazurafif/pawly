import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import { useTranslation } from 'react-i18next';
import { SyncProvider } from '../src/hooks/useSync';
import { ActivePetProvider } from '../src/hooks/useActivePet';
import { ToastProvider } from '../src/components/Toast';
import { ThemeProvider, useAppColors } from '../src/hooks/useTheme';
import '../src/i18n';

function RootStack() {
  const scheme = useColorScheme();
  const colors = useAppColors();
  const { t } = useTranslation();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: 'Roboto_700Bold' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="pet-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="entry-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="reminder-form" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
        <Stack.Screen name="vet-report" options={{ title: t('health.vetReport') }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Material typeface (Roboto) — every text style references one of these
  // family names via the `fonts` tokens in src/lib/theme.ts.
  const [fontsLoaded] = useFonts({
    Roboto_400Regular: require('../assets/fonts/Roboto-Regular.ttf'),
    Roboto_500Medium: require('../assets/fonts/Roboto-Medium.ttf'),
    Roboto_700Bold: require('../assets/fonts/Roboto-Bold.ttf'),
  });
  if (!fontsLoaded) {
    return null;
  }
  return (
    <SyncProvider>
      <ActivePetProvider>
        <ThemeProvider>
          <ToastProvider>
            <RootStack />
          </ToastProvider>
        </ThemeProvider>
      </ActivePetProvider>
    </SyncProvider>
  );
}
