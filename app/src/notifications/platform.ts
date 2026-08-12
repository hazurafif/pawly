import { Platform } from 'react-native';
import type { RuleWithPet } from '../db/types';
import { OCCURRENCES_AHEAD, notificationId, ruleTriggers } from './schedule';

// Thin wrapper around expo-notifications (native only — web is a no-op).
// All scheduling decisions live in schedule.ts; this file only translates
// rules into OS notifications and keeps the chain replenished.

export const NOTIFICATION_CHANNEL = 'pawly-reminders';

let configured = false;

// Registers the foreground presentation handler and the Android channel.
// Idempotent; must run before any schedule call.
export async function configureNotifications(): Promise<void> {
  if (Platform.OS === 'web' || configured) {
    return;
  }
  configured = true;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A73E8',
    });
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  await configureNotifications();
  const Notifications = await import('expo-notifications');
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Cancels everything and schedules the next `OCCURRENCES_AHEAD` triggers
// for each rule. Idempotent — safe to call on every rule/task change.
// Returns the number of scheduled notifications.
export async function rescheduleRuleNotifications(
  rules: RuleWithPet[],
  lastCompletedByRule: Map<string, string | null>,
  afterMs: number = Date.now()
): Promise<number> {
  if (Platform.OS === 'web') {
    return 0;
  }
  await configureNotifications();
  const Notifications = await import('expo-notifications');
  await Notifications.cancelAllScheduledNotificationsAsync();
  let scheduled = 0;
  for (const rule of rules) {
    const triggers = ruleTriggers(rule, {
      afterMs,
      count: OCCURRENCES_AHEAD,
      lastCompletedAt: lastCompletedByRule.get(rule.id),
    });
    const body = [rule.pet_name, rule.dose].filter(Boolean).join(' · ');
    for (let i = 0; i < triggers.length; i++) {
      await Notifications.scheduleNotificationAsync({
        identifier: notificationId(rule.id, i),
        content: {
          title: rule.title,
          body,
          sound: 'default',
          data: { ruleId: rule.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(triggers[i]),
        },
      });
      scheduled++;
    }
  }
  return scheduled;
}

// Calls `cb` when a scheduled notification fires while the app is open or
// is tapped. Used to replenish the trigger chain. Returns an unsubscribe fn.
export function subscribeNotificationEvents(cb: () => void): () => void {
  if (Platform.OS === 'web') {
    return () => {};
  }
  let received: { remove(): void } | null = null;
  let responded: { remove(): void } | null = null;
  void import('expo-notifications').then((Notifications) => {
    received = Notifications.addNotificationReceivedListener(() => cb());
    responded = Notifications.addNotificationResponseReceivedListener(() => cb());
  });
  return () => {
    received?.remove();
    responded?.remove();
  };
}
