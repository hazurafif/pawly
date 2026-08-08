import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, spacing } from '../lib/theme';

// Gentle confirmation toast with an undo action — the safety net for
// one-tap quick logging. Fades and slides up; auto-dismisses after 5s.
export function Toast({
  message,
  undoLabel,
  onUndo,
  onDone,
}: {
  message: string | null;
  undoLabel?: string;
  onUndo?: () => void;
  onDone: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!message) {
      return;
    }
    opacity.setValue(reduceMotion ? 1 : 0);
    if (!reduceMotion) {
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
    const timer = setTimeout(onDone, 5000);
    return () => {
      clearTimeout(timer);
      if (!reduceMotion) {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, reduceMotion]);

  if (!message) {
    return null;
  }

  return (
    <Animated.View style={[styles.toast, { opacity }]} accessibilityLiveRegion="polite">
      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
      <Text style={styles.message} numberOfLines={1}>
        {message}
      </Text>
      {undoLabel && onUndo ? (
        <Pressable
          onPress={() => {
            onUndo();
            onDone();
          }}
          accessibilityRole="button"
          accessibilityLabel={undoLabel}
          hitSlop={8}
          style={({ pressed }) => [styles.undo, pressed && styles.pressed]}
        >
          <Text style={styles.undoText}>{undoLabel}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xxl * 2 + spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    ...shadow.card,
  },
  message: { flex: 1, color: colors.white, fontSize: 14, fontWeight: '600' },
  undo: { paddingVertical: 4, paddingHorizontal: 8 },
  undoText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.7 },
});
