import { useMemo } from 'react';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { type Palette } from '../src/lib/theme';
import { useAppColors } from '../src/hooks/useTheme';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>{t('common.back')}</Text>
        </Link>
      </View>
    </>
  );
}

const createStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 20, fontFamily: 'Roboto_400Regular' },
  link: { marginTop: 15, paddingVertical: 15 },
  linkText: { fontFamily: 'Roboto_400Regular', fontSize: 14, color: colors.primaryDeep },
});
