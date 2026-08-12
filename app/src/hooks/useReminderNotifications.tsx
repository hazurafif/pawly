import { useCallback, useEffect, useRef, useState } from 'react';
import { useRepoData } from './useRepoData';
import { lastCompletionForRule } from '../lib/rules';
import { ensureNotificationPermission, rescheduleRuleNotifications, subscribeNotificationEvents } from '../notifications/platform';

// Keeps OS notifications in lockstep with reminder rules: requests
// permission once, then reschedules whenever the rule set or its
// completions change (local edits AND sync pulls from other devices), and
// replenishes the trigger chain when a notification fires or is tapped.
// Web is a no-op (expo-notifications is native-only).
export function useReminderNotifications(): void {
  const { data: rules } = useRepoData((r) => r.allRules());
  const { data: allEvents } = useRepoData((r) => r.allEvents());
  const [ready, setReady] = useState(false);
  const requestedRef = useRef(false);
  // Latest values behind a stable reschedule callback.
  const readyRef = useRef(false);
  const rulesRef = useRef(rules);
  const eventsRef = useRef(allEvents);
  readyRef.current = ready;
  rulesRef.current = rules;
  eventsRef.current = allEvents;
  // Signature of (rule, last completion). Rescheduling on every repo change
  // would churn the notification store on every journal entry. `null`
  // means "not yet scheduled" — always reschedule once ready, even when
  // the (empty) signature matches.
  const signatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (requestedRef.current) {
      return;
    }
    requestedRef.current = true;
    void ensureNotificationPermission().then(setReady);
  }, []);

  const reschedule = useCallback(async (): Promise<boolean> => {
    if (!readyRef.current || !rulesRef.current) {
      return false;
    }
    const tasks = (eventsRef.current ?? []).filter((e) => e.kind === 'task');
    const lastCompletedByRule = new Map<string, string | null>();
    for (const rule of rulesRef.current) {
      lastCompletedByRule.set(rule.id, lastCompletionForRule(tasks, rule.id));
    }
    try {
      await rescheduleRuleNotifications(rulesRef.current, lastCompletedByRule);
      return true;
    } catch {
      // Permission revoked mid-session or platform hiccup — try again on
      // the next rule/event change.
      return false;
    }
  }, []);

  useEffect(() => {
    if (!ready || !rules) {
      return;
    }
    const tasks = (allEvents ?? []).filter((e) => e.kind === 'task');
    const signature = rules
      .map((r) => `${r.id}:${r.due}:${r.repeat}:${r.title}:${lastCompletionForRule(tasks, r.id) ?? ''}`)
      .join('|');
    if (signatureRef.current === signature) {
      return;
    }
    void reschedule().then((ok) => {
      if (ok) {
        signatureRef.current = signature;
      }
    });
  }, [rules, allEvents, ready, reschedule]);

  useEffect(() => subscribeNotificationEvents(() => void reschedule()), [reschedule]);
}
