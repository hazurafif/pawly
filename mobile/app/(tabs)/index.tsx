import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSync } from '../../src/hooks/useSync';
import { colors, radius, shadow, spacing } from '../../src/lib/theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { status, syncNow } = useSync();

  const syncing = status.state === 'syncing';
  const lastSync = status.lastSync
    ? t('settings.synced', { time: new Date(status.lastSync).toLocaleTimeString() })
    : t('settings.never');

  return (
    <LinearGradient colors={[colors.background, '#FBF3E9']} style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="paw" size={36} color={colors.white} />
        </View>
        <Text style={styles.appName}>Pawly</Text>
        <Text style={styles.tagline}>{t('home.tagline')}</Text>
      </View>

      <View style={[styles.card, shadow.card]}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusDot, { backgroundColor: status.state === 'error' ? colors.error : colors.success }]} />
          <Text style={styles.cardTitle}>{t('settings.syncStatus')}</Text>
        </View>
        {syncing ? (
          <View style={styles.syncRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.cardBody}>{t('settings.syncing')}</Text>
          </View>
        ) : (
          <Text style={[styles.cardBody, status.state === 'error' && styles.errorText]}>
            {status.state === 'error' ? t('settings.serverOffline') : lastSync}
          </Text>
        )}
        <Pressable
          style={({ pressed }) => [styles.syncButton, pressed && styles.syncButtonPressed]}
          onPress={() => void syncNow()}
          disabled={syncing}
        >
          <Ionicons name="refresh" size={18} color={colors.white} />
          <Text style={styles.syncButtonText}>{t('settings.sync')}</Text>
        </Pressable>
      </View>

      <View style={[styles.card, shadow.card]}>
        <Text style={styles.cardTitle}>{t('home.pets')}</Text>
        <Text style={styles.cardBody}>{t('home.petsEmpty')}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  hero: { alignItems: 'center', marginTop: spacing.xl + 24, marginBottom: spacing.xl },
  heroIcon: {
    width: 84,
    height: 84,
    borderRadius: radius.lg + 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  appName: { fontSize: 34, fontWeight: '800', color: colors.text, marginTop: spacing.md },
  tagline: { fontSize: 15, color: colors.textMuted, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: radius.pill },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardBody: { fontSize: 14, color: colors.textMuted, marginTop: spacing.xs },
  errorText: { color: colors.error },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    marginTop: spacing.md,
  },
  syncButtonPressed: { backgroundColor: colors.primaryDark },
  syncButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
